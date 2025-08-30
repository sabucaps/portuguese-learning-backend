// models/ImagePrompt.js
const mongoose = require('mongoose');

const imagePromptSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    trim: true,
    lowercase: true, // ✅ Case-insensitive
    unique: true,
    set: function (value) {
      return value;
    }
  },
  imageUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+|data:image\/[a-zA-Z]+;base64,.+$/i.test(v);
      },
      message: props => `${props.value} is not a valid URL or base64 image`
    }
  },
  category: {
    type: String,
    enum: ['Object', 'Nature', 'Animal', 'Place', 'Emotion', 'Action', 'Other'],
    default: 'Other'
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 3,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // ✅ For faster queries
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

// ✅ Pre-save hook to update timestamp
imagePromptSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ImagePrompt', imagePromptSchema);
