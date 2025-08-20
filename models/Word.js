// backend/models/Word.js
const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  portuguese: {
    type: String,
    required: true,
    unique: true,
    set: function (value) {
      return value;
    }
  },
  english: {
    type: String,
    required: true
  },
  group: {
    type: String,
    default: 'Other'   // ✅ Always ensure words fall into a group
  },
  examples: [{
    type: String,
    set: function (value) {
      return value;
    }
  }],
  imageUrl: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: {
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('Word', wordSchema);
