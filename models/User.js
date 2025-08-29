// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    learningPath: {
      currentStage: { type: String, default: 'stage-1' },
      completedStages: { type: [String], default: [] }
    },
    words: {
      mastered: { type: [String], default: [] },
      needsReview: { type: [String], default: [] }
    },
    savedStories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story'
    }],
    tests: [{
      testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test'
      },
      score: { type: Number, required: true },
      date: { type: Date, default: Date.now }
    }]
  },
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  }
});

// Optional: add a pre-save hook for updated streak
userSchema.pre('save', function(next) {
  const today = new Date();
  if (this.streak.lastActive) {
    const diff = today - this.streak.lastActive;
    if (diff < 1000 * 60 * 60 * 24 * 2) { // within 2 days
      this.streak.current = this.streak.current + 1;
      if (this.streak.current > this.streak.longest) {
        this.streak.longest = this.streak.current;
      }
    } else {
      this.streak.current = 1;
    }
  } else {
    this.streak.current = 1;
    this.streak.longest = 1;
  }
  this.streak.lastActive = today;
  next();
});

module.exports = mongoose.model('User', userSchema);
