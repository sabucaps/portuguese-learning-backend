// models/Journal.js
const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  wordHistory: [{
    word: { type: String, required: true },
    sentence: { type: String, required: true }
  }],
  task1: { type: String },
  task2: { type: String },
  task3: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Journal', journalEntrySchema);