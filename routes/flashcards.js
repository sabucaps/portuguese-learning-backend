// routes/flashcards.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Word = require('../models/Word');
const { authenticateToken } = require('./auth'); // use your existing auth middleware

// GET user-specific flashcards for review stats
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    const masteredIds = user.progress?.words?.mastered || [];
    const needsReviewIds = user.progress?.words?.needsReview || [];
    const allWordIds = [...new Set([...masteredIds, ...needsReviewIds])];

    // Fetch word details
    const words = await Word.find({ _id: { $in: allWordIds } });

    // Map user-specific stats to each word
    const wordData = words.map(w => {
      const idStr = w._id.toString();
      const isMastered = masteredIds.includes(idStr);
      const needsReview = needsReviewIds.includes(idStr);

      // If you track reviewCount, ease, interval, lastReviewed, you can include them here
      // For now we add basic placeholders
      return {
        ...w.toObject(),
        reviewCount: isMastered || needsReview ? 1 : 0,
        ease: 2.5,
        interval: isMastered ? 7 : 1,
        lastReviewed: new Date(),
      };
    });

    res.json(wordData);
  } catch (err) {
    console.error('Error fetching user flashcards:', err);
    res.status(500).json({ error: 'Server error fetching user flashcards' });
  }
});

module.exports = router;
