// backend/models/Story.js
const mongoose = require('mongoose');

const storyParagraphSchema = new mongoose.Schema({
  portuguese: {
    type: String,
    required: true
  },
  english: {
    type: String,
    required: true
  }
});

const storySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  difficulty: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  category: {
    type: String,
    required: true
  },
  paragraphs: [storyParagraphSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('Story', storySchema);