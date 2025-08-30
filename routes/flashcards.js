// routes/flashcards.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Word = require('../models/Word');
const User = require('../models/User');

// Use authenticateToken exported from routes/auth.js
const { authenticateToken } = require('./auth');

// Helper to validate ObjectId
const isValidObjectId = (id) => {
  try {
    return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
  } catch (e) {
    return false;
  }
};

/**
 * Helpers to read/set progress in a backwards-compatible way.
 *
 * We support:
 *  - Newer shape: user.progress.words is a map/object keyed by wordId:
 *      user.progress.words[wordId] = { ease, interval, reviewCount, lastReviewed, nextReview }
 *  - Older shape: user.progress.words.mastered (array of ids), user.progress.words.needsReview (array)
 *    and/or user.progress.wordsHistory: [{ wordId, ease, interval, reviewCount, lastReviewed }]
 *
 * When writing, we update the map (preferred) and also push/update wordsHistory and mastered/needsReview arrays
 * so any UI depending on old fields continues to work.
 */

function getProgressEntry(user, wordId) {
  if (!user.progress) return null;

  // Ensure container shapes exist
  if (!user.progress.words) user.progress.words = {}; // preferred map
  if (!user.progress.wordsHistory) user.progress.wordsHistory = [];
  if (!user.progress.words.mastered) {
    // If words was an array in old shape (rare), keep that safe; ensure structure
    if (!Array.isArray(user.progress.words.mastered)) user.progress.words.mastered = [];
  }
  if (!user.progress.words.needsReview) {
    if (!Array.isArray(user.progress.words.needsReview)) user.progress.words.needsReview = [];
  }

  // Prefer map entry if present
  const mapEntry = user.progress.words[wordId];
  if (mapEntry) return mapEntry;

  // Fallback to history entry
  const historyEntry = (user.progress.wordsHistory || []).find(e => String(e.wordId) === String(wordId));
  if (historyEntry) {
    // Normalize keys
    return {
      ease: typeof historyEntry.ease === 'number' ? historyEntry.ease : 2.5,
      interval: typeof historyEntry.interval === 'number' ? historyEntry.interval : 0,
      reviewCount: historyEntry.reviewCount || 0,
      lastReviewed: historyEntry.lastReviewed,
      nextReview: historyEntry.nextReview
    };
  }

  // If neither exists, return default
  return {
    ease: 2.5,
    interval: 0,
    reviewCount: 0,
    lastReviewed: null,
    nextReview: null
  };
}

function setProgressEntry(user, wordId, entry) {
  if (!user.progress) user.progress = {};
  if (!user.progress.words) user.progress.words = {};
  if (!user.progress.wordsHistory) user.progress.wordsHistory = [];
  if (!Array.isArray(user.progress.words.mastered)) user.progress.words.mastered = [];
  if (!Array.isArray(user.progress.words.needsReview)) user.progress.words.needsReview = [];

  // Write preferred map entry
  user.progress.words[wordId] = {
    ease: entry.ease,
    interval: entry.interval,
    reviewCount: entry.reviewCount,
    lastReviewed: entry.lastReviewed,
    nextReview: entry.nextReview
  };

  // Maintain a history array entry (upsert)
  const idx = user.progress.wordsHistory.findIndex(e => String(e.wordId) === String(wordId));
  const historyObj = {
    wordId,
    ease: entry.ease,
    interval: entry.interval,
    reviewCount: entry.reviewCount,
    lastReviewed: entry.lastReviewed,
    nextReview: entry.nextReview
  };
  if (idx === -1) user.progress.wordsHistory.push(historyObj);
  else user.progress.wordsHistory[idx] = historyObj;

  // Update mastered / needsReview arrays for backwards compat:
  // simple heuristic:
  // - mastered if interval >= 7 and ease > 2.6
  // - needsReview if ease < 2.0 or interval < 7
  const masteredIdx = user.progress.words.mastered.findIndex(id => String(id) === String(wordId));
  const needsIdx = user.progress.words.needsReview.findIndex(id => String(id) === String(wordId));
  const isMastered = entry.interval >= 7 && entry.ease > 2.6;
  const isNeeds = entry.ease < 2.0 || entry.interval < 7;

  // Add/remove from arrays based on above
  if (isMastered) {
    if (masteredIdx === -1) user.progress.words.mastered.push(wordId);
    if (needsIdx !== -1) user.progress.words.needsReview.splice(needsIdx, 1);
  } else if (isNeeds) {
    if (needsIdx === -1) user.progress.words.needsReview.push(wordId);
    if (masteredIdx !== -1) user.progress.words.mastered.splice(masteredIdx, 1);
  } else {
    // neither; remove from both if present
    if (masteredIdx !== -1) user.progress.words.mastered.splice(masteredIdx, 1);
    if (needsIdx !== -1) user.progress.words.needsReview.splice(needsIdx, 1);
  }
}

/**
 * GET /api/flashcards
 * Returns all words merged with the logged-in user's progress.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!isValidObjectId(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const user = await User.findById(userId).lean(); // lean for read-only
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch words. You can add query filters later (due items only, groups, pagination).
    const words = await Word.find().sort({ portuguese: 1 });

    // Merge per-word progress in a stable manner
    const wordsWithProgress = words.map((w) => {
      const wordId = String(w._id);
      const progress = getProgressEntry(user, wordId) || {};

      return {
        ...w.toObject(),
        // Ensure client-friendly keys exist
        ease: typeof progress.ease === 'number' ? progress.ease : 2.5,
        interval: typeof progress.interval === 'number' ? progress.interval : 0,
        reviewCount: progress.reviewCount || 0,
        lastReviewed: progress.lastReviewed || null,
        nextReview: progress.nextReview || null
      };
    });

    res.json(wordsWithProgress);
  } catch (err) {
    console.error('Error fetching user flashcards:', err);
    res.status(500).json({ error: 'Server error fetching user flashcards', details: err.message });
  }
});

/**
 * POST /api/flashcards/review
 * Body: { wordId: string, difficulty: 'easy'|'medium'|'hard' }
 * Saves user-specific review/progress for that word. Updates map + history + arrays for backward compat.
 */
router.post('/review', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { wordId, difficulty } = req.body;

    if (!wordId || !difficulty) {
      return res.status(400).json({ error: 'wordId and difficulty are required' });
    }
    if (!isValidObjectId(userId) || !isValidObjectId(wordId)) {
      return res.status(400).json({ error: 'Invalid userId or wordId' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const word = await Word.findById(wordId);
    if (!word) return res.status(404).json({ error: 'Word not found' });

    // Read previous progress (normalize)
    const prev = getProgressEntry(user, wordId) || { ease: 2.5, interval: 0, reviewCount: 0 };

    let ease = typeof prev.ease === 'number' ? prev.ease : 2.5;
    let interval = typeof prev.interval === 'number' ? prev.interval : 0;

    if (difficulty === 'easy') {
      interval = Math.max(1, (interval || 1) * ease);
      ease = Math.min(3.0, ease + 0.15);
    } else if (difficulty === 'medium') {
      interval = Math.max(0.5, (interval || 1) * 0.8);
      ease = Math.max(1.3, ease - 0.15);
    } else {
      // hard
      interval = 0.1;
      ease = 1.8;
    }

    const now = new Date();
    const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    const updated = {
      ease,
      interval,
      reviewCount: (prev.reviewCount || 0) + 1,
      lastReviewed: now.toISOString(),
      nextReview: nextReview.toISOString()
    };

    // Persist using helper (updates map, history & mastered/needs arrays)
    setProgressEntry(user, wordId, updated);

    await user.save();

    return res.json({
      message: 'Review saved',
      wordId,
      progress: updated
    });
  } catch (err) {
    console.error('Error saving review:', err);
    res.status(500).json({ error: 'Error saving flashcard review', details: err.message });
  }
});

module.exports = router;
