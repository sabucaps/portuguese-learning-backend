// models/Journal.js
const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema({
  // ✅ Keep only what your app sends
  userId: { 
    type: String,  // Use String to match your auth system
    required: true,
    index: true 
  },
  date: { 
    type: String,  // "2025-08-31"
    required: true,
    index: true 
  },
  wordHistory: [{
    word: { type: String, required: true },      // e.g., "Beijar"
    sentence: { type: String, required: true }    // e.g., "Eu beijo você"
  }],
  task1: { type: String },  // Paragraph from one sentence
  task2: { type: String },  // Merged paragraph
  task3: { type: String }   // 3-paragraph story
}, {
  timestamps: true  // Adds createdAt automatically
});

module.exports = mongoose.model('Journal', journalEntrySchema);
