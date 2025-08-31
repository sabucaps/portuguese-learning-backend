// models/Journal.js
const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  date: { 
    type: String, 
    required: true,
    index: true 
  },
  wordHistory: [{
    word: { type: String, required: true },
    sentence: { type: String, required: true }
  }],
  task1: { type: String },
  task2: { type: String },
  task3: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Journal', journalEntrySchema);
