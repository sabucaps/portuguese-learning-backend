// routes/flashcards.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Word = require("../models/Word");
const auth = require("../auth");

// 📌 Get user-specific flashcards
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const masteredIds = user.progress.words.mastered || [];
    const needsReviewIds = user.progress.words.needsReview || [];
    const allWordIds = [...new Set([...masteredIds, ...needsReviewIds])];

    const words = await Word.find({ _id: { $in: allWordIds } });

    const wordData = words.map((w) => {
      const idStr = w._id.toString();

      const progressEntry = user.progress.words.map.get(idStr);

      return {
        ...w.toObject(),
        reviewCount: progressEntry?.reviewCount || 0,
        ease: progressEntry?.ease || 2.5,
        interval: progressEntry?.interval || 0,
        lastReviewed: progressEntry?.lastReviewed || null,
        nextReview: progressEntry?.nextReview || null,
      };
    });

    res.json(wordData);
  } catch (err) {
    console.error("❌ Error fetching flashcards:", err);
    res.status(500).json({ error: "Server error fetching flashcards" });
  }
});

// 📌 Save/update a user’s flashcard review progress
router.post("/review", auth, async (req, res) => {
  try {
    const { wordId, ease, interval } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Ensure map exists
    if (!user.progress.words.map) {
      user.progress.words.map = new Map();
    }

    const existing = user.progress.words.map.get(wordId);

    if (existing) {
      // update existing entry
      existing.reviewCount = (existing.reviewCount || 0) + 1;
      existing.ease = ease || existing.ease;
      existing.interval = interval || existing.interval;
      existing.lastReviewed = new Date();
      existing.nextReview = new Date(Date.now() + (interval || 1) * 86400000);
    } else {
      // add new entry
      user.progress.words.map.set(wordId, {
        reviewCount: 1,
        ease: ease || 2.5,
        interval: interval || 1,
        lastReviewed: new Date(),
        nextReview: new Date(Date.now() + (interval || 1) * 86400000),
      });
    }

    // Add to history (audit log)
    user.progress.words.history.push({
      wordId,
      ease: ease || 2.5,
      interval: interval || 1,
      reviewCount: (existing?.reviewCount || 0) + 1,
      lastReviewed: new Date(),
      nextReview: new Date(Date.now() + (interval || 1) * 86400000),
    });

    await user.save();

    res.json({ success: true, message: "Flashcard progress updated" });
  } catch (err) {
    console.error("❌ Error saving flashcard review:", err);
    res.status(500).json({ error: "Server error saving flashcard review" });
  }
});

module.exports = router;


