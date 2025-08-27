const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
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
    tests: [{
      testId: String,
      score: Number,
      date: Date
    }]
  },
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  }
});

module.exports = mongoose.model('User', userSchema);