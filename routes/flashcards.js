const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Word = require('../models/Word');
const auth = require('../middleware/auth');

// GET user-specific flashcards for review stats
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Combine mastered and needsReview word IDs
    const masteredIds = user.progress.words.mastered || [];
    const needsReviewIds = user.progress.words.needsReview || [];
    const allWordIds = [...new Set([...masteredIds, ...needsReviewIds])]; // unique IDs

    // Fetch word details
    const words = await Word.find({ _id: { $in: allWordIds } });

    // Map user-specific stats to each word
    const wordData = words.map(w => {
      const idStr = w._id.toString();
      const isMastered = masteredIds.includes(idStr);
      const needsReview = needsReviewIds.includes(idStr);

      // Optional: store actual reviewCount, ease, interval if you track them
      const progressEntry = (user.progress.wordsHistory || []).find(e => e.wordId.toString() === idStr);

      return {
        ...w.toObject(),
        reviewCount: progressEntry?.reviewCount || (isMastered || needsReview ? 1 : 0),
        ease: progressEntry?.ease || 2.5,
        interval: progressEntry?.interval || (isMastered ? 7 : 1),
        lastReviewed: progressEntry?.lastReviewed || new Date(), // fallback to today if not set
      };
    });

    res.json(wordData);
  } catch (err) {
    console.error('Error fetching user flashcards:', err);
    res.status(500).json({ error: 'Server error fetching user flashcards' });
  }
});

module.exports = router;
