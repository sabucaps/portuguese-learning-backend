// server.js
require('dotenv').config();

// Validate JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set in .env file');
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import models
const Word = require('./models/Word');
const Question = require('./models/Question');
const Story = require('./models/Story');
const GrammarLesson = require('./models/GrammarLesson');
const Test = require('./models/Test');
const Conjugation = require('./models/Conjugation');
const User = require('./models/User');

// Import auth routes and middleware
const { router: authRoutes, authenticateToken } = require('./routes/auth');

// Initialize Express app
const app = express();

// Configure CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Serve static files
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error('❌ MONGODB_URI is not set in .env file');
  process.exit(1);
}

mongoose.connect(mongoURI, {
  family: 4,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}).then(() => console.log('✅ MongoDB Connected...'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// Use auth routes
app.use('/api/auth', authRoutes);

// ===== WORD ENDPOINTS =====
app.get('/api/words', async (req, res) => {
  try {
    const words = await Word.find().sort({ portuguese: 1 });
    res.json(words);
  } catch (error) {
    console.error('Error fetching words:', error);
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
  } catch (error) {
    console.error('Error saving word:', error);
    res.status(400).json({ error: 'Error saving word' });
  }
});

app.put('/api/words/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const word = await Word.findByIdAndUpdate(id, req.body, { new: true });
    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.json(word);
  } catch (error) {
    console.error('Error updating word:', error);
    res.status(400).json({ error: 'Error updating word' });
  }
});

app.delete('/api/words/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const word = await Word.findByIdAndDelete(id);
    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.json({ message: 'Word deleted successfully' });
  } catch (error) {
    console.error('Error deleting word:', error);
    res.status(500).json({ error: 'Error deleting word' });
  }
});

// ===== GROUPS =====
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Word.distinct('group');
    const cleanedGroups = ['Other', ...groups.filter(g => g && g !== 'Other')];
    res.json(cleanedGroups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Error fetching groups' });
  }
});

// ===== QUESTIONS =====
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Question.find().sort({ question: 1 });
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

// ===== STORIES =====
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ title: 1 });
    res.json(stories);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Error fetching stories' });
  }
});

app.get('/api/stories/:id', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: 'Error fetching story' });
  }
});

app.post('/api/stories', authenticateToken, async (req, res) => {
  try {
    const story = new Story(req.body);
    await story.save();
    res.status(201).json(story);
  } catch (err) {
    console.error('Error saving story:', err);
    res.status(400).json({ error: 'Error saving story' });
  }
});

app.put('/api/stories/:id', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  } catch (err) {
    console.error('Error updating story:', err);
    res.status(400).json({ error: 'Error updating story' });
  }
});

app.delete('/api/stories/:id', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findByIdAndDelete(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json({ message: 'Story deleted successfully' });
  } catch (err) {
    console.error('Error deleting story:', err);
    res.status(500).json({ error: 'Error deleting story' });
  }
});

// ===== SAVED STORIES =====
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
  } catch (error) {
    console.error('❌ Error saving story:', error);
    res.status(500).json({ error: 'Error saving story' });
  }
});

app.get('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'savedStories',
      select: 'title description difficulty category paragraphs createdAt updatedAt'
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.savedStories || []);
  } catch (error) {
    console.error('❌ Error fetching saved stories:', error);
    res.status(500).json({ error: 'Error fetching saved stories' });
  }
});

app.delete('/api/saved-stories/:storyId', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.savedStories = user.savedStories.filter(id => id.toString() !== storyId);
    await user.save();
    res.json({ message: 'Story removed from saved' });
  } catch (error) {
    console.error('❌ Error removing saved story:', error);
    res.status(500).json({ error: 'Error removing saved story' });
  }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🔑 JWT_SECRET loaded: ${!!JWT_SECRET}`);
  console.log(`🌐 API: http://localhost:${PORT}/api/words`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});
