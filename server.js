// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Models
const Word = require('./models/Word');
const Question = require('./models/Question');
const Story = require('./models/Story');
const GrammarLesson = require('./models/GrammarLesson');
const Test = require('./models/Test');
const Conjugation = require('./models/Conjugation');
const User = require('./models/User');

// Auth
const { router: authRoutes, authenticateToken } = require('./routes/auth');

const app = express();

// -----------------------
// Config
// -----------------------
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET not set');
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set');
  process.exit(1);
}

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// -----------------------
// MongoDB Connection
// -----------------------
mongoose.connect(MONGODB_URI, { family: 4 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// -----------------------
// Routes
// -----------------------
app.use('/api/auth', authRoutes);

// -----------------------
// WORDS & GROUPS
// -----------------------
app.get('/api/words', async (req, res) => {
  try {
    const words = await Word.find().sort({ portuguese: 1 });
    res.json(words);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching words' });
  }
});

app.post('/api/words', authenticateToken, async (req, res) => {
  try {
    const { portuguese, english, group, examples, imageUrl } = req.body;
    if (!portuguese || !english) return res.status(400).json({ error: 'Portuguese and English are required' });
    const word = new Word({ portuguese, english, group, examples, imageUrl });
    await word.save();
    res.status(201).json(word);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error saving word' });
  }
});

app.put('/api/words/:id', authenticateToken, async (req, res) => {
  try {
    const word = await Word.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.json(word);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error updating word' });
  }
});

app.delete('/api/words/:id', authenticateToken, async (req, res) => {
  try {
    const word = await Word.findByIdAndDelete(req.params.id);
    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.json({ message: 'Word deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting word' });
  }
});

// Groups
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Word.distinct('group');
    res.json(['Other', ...groups.filter(g => g && g !== 'Other')]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching groups' });
  }
});

app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name required' });
    const exists = await Word.findOne({ group: name.trim() });
    if (exists) return res.status(400).json({ error: 'Group already exists' });
    res.json({ message: 'Group created', name: name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error adding group' });
  }
});

app.put('/api/groups/:oldName', authenticateToken, async (req, res) => {
  try {
    const { oldName } = req.params;
    const { name: newName } = req.body;
    if (!newName || oldName === 'Other') return res.status(400).json({ error: 'Invalid group rename' });
    const exists = await Word.findOne({ group: newName.trim() });
    if (exists) return res.status(400).json({ error: 'Group already exists' });
    const result = await Word.updateMany({ group: oldName }, { $set: { group: newName.trim() } });
    res.json({ message: 'Group updated', oldName, newName: newName.trim(), wordsUpdated: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating group' });
  }
});

// -----------------------
// QUESTIONS
// -----------------------
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Question.find().sort({ question: 1 });
    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

app.post('/api/questions', authenticateToken, async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.status(201).json(question);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error saving question' });
  }
});

app.put('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error updating question' });
  }
});

app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting question' });
  }
});

// -----------------------
// STORIES & SAVED STORIES
// -----------------------
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ title: 1 });
    res.json(stories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching stories' });
  }
});

app.get('/api/stories/:id', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching story' });
  }
});

app.post('/api/stories', authenticateToken, async (req, res) => {
  try {
    const story = new Story(req.body);
    await story.save();
    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error creating story' });
  }
});

app.put('/api/stories/:id', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error updating story' });
  }
});

app.delete('/api/stories/:id', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findByIdAndDelete(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json({ message: 'Story deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting story' });
  }
});

// Saved Stories
app.get('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedStories');
    if (!user) return res.json([]);
    res.json(user.savedStories || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching saved stories' });
  }
});

app.post('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.savedStories.includes(storyId)) {
      user.savedStories.push(storyId);
      await user.save();
    }
    res.json({ message: 'Story saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error saving story' });
  }
});

app.delete('/api/saved-stories/:storyId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.savedStories = user.savedStories.filter(id => id.toString() !== req.params.storyId);
    await user.save();
    res.json({ message: 'Story removed from saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error removing saved story' });
  }
});

// -----------------------
// GRAMMAR LESSONS
// -----------------------
app.get('/api/grammar', async (req, res) => {
  try {
    const lessons = await GrammarLesson.find().sort({ title: 1 });
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching grammar lessons' });
  }
});

app.post('/api/grammar', authenticateToken, async (req, res) => {
  try {
    const lesson = new GrammarLesson(req.body);
    await lesson.save();
    res.status(201).json(lesson);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error creating lesson' });
  }
});

app.put('/api/grammar/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error updating lesson' });
  }
});

app.delete('/api/grammar/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting lesson' });
  }
});

// -----------------------
// TESTS
// -----------------------
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await Test.find().sort({ title: 1 });
    res.json(tests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching tests' });
  }
});

app.post('/api/tests', authenticateToken, async (req, res) => {
  try {
    const test = new Test(req.body);
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error creating test' });
  }
});

app.put('/api/tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error updating test' });
  }
});

app.delete('/api/tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ message: 'Test deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting test' });
  }
});

// -----------------------
// CONJUGATIONS
// -----------------------
app.get('/api/conjugations', async (req, res) => {
  try {
    const conjugations = await Conjugation.find().sort({ verb: 1 });
    res.json(conjugations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching conjugations' });
  }
});

app.post('/api/conjugations', authenticateToken, async (req, res) => {
  try {
    const conjugation = new Conjugation(req.body);
    await conjugation.save();
    res.status(201).json(conjugation);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error creating conjugation' });
  }
});

app.put('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json(conjugation);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error updating conjugation' });
  }
});

app.delete('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndDelete(req.params.id);
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json({ message: 'Conjugation deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting conjugation' });
  }
});

// -----------------------
// HEALTH CHECK
// -----------------------
app.get('/health', (req, res) => res.json({ status: 'OK', message: 'Server running' }));

// -----------------------
// ERROR HANDLING
// -----------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// -----------------------
// START SERVER
// -----------------------
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server started on port ${PORT}`));
