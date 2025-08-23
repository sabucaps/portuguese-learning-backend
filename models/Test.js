// backend/models/Test.js
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Multiple Choice', 'Fill in the Blank', 'Translation', 'Word Order']
  },
  questionCount: {
    type: Number,
    required: true,
    min: 1
  },
  estimatedTime: {
    type: Number,
    required: true,
    min: 1
  },
  storyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story',
    required: true
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    options: [String],
    correctAnswer: {
      type: Number,
      required: true
    },
    explanation: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

testSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Test', testSchema);