const mongoose = require('mongoose');

const conjugationSchema = new mongoose.Schema({
  eu: String,
  tu: String,
  eleEla: String,
  nos: String,
  vos: String,
  elesElas: String
});

const verbSchema = new mongoose.Schema({
  portuguese: {
    type: String,
    required: true,
    unique: true
  },
  english: {
    type: String,
    required: true
  },
  group: {
    type: String,
    default: 'Verbs'
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  irregular: {
    type: Boolean,
    default: false
  },
  conjugations: {
    present: conjugationSchema,
    preterite: conjugationSchema,
    imperfect: conjugationSchema,
    future: conjugationSchema,
    conditional: conjugationSchema,
    presentPerfect: conjugationSchema,
    pluperfect: conjugationSchema,
    futurePerfect: conjugationSchema,
    subjunctivePresent: conjugationSchema,
    subjunctiveImperfect: conjugationSchema,
    imperative: conjugationSchema
  },
  examples: [{
    portuguese: String,
    english: String
  }],
  tips: [String]
});

module.exports = mongoose.model('Verb', verbSchema);