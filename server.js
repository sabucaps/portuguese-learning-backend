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

// ===== AUTH ROUTES =====
app.use('/api/auth', authRoutes);

// ===== WORD MANAGEMENT ENDPOINTS =====
app.get('/api/words', async (req, res) => {
  try {
    const words = await Word.find().sort({ portuguese: 1 });
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(words);
  } catch (error) {
    console.error('Error fetching words:', error);
    res.status(500).json({ error: 'Error fetching words' });
  }
});

app.post('/api/words', authenticateToken, async (req, res) => {
  try {
    const { portuguese, english, group, examples, imageUrl } = req.body;
    if (!portuguese || !english) {
      return res.status(400).json({ error: 'Portuguese and English are required' });
    }
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
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid word ID' });
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
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid word ID' });
    const word = await Word.findByIdAndDelete(id);
    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.json({ message: 'Word deleted successfully' });
  } catch (error) {
    console.error('Error deleting word:', error);
    res.status(500).json({ error: 'Error deleting word' });
  }
});

// ===== GROUP MANAGEMENT ENDPOINTS =====
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Word.distinct('group');
    const cleanedGroups = ['Other', ...groups.filter(g => g !== null && g !== 'Other')];
    res.json(cleanedGroups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Error fetching groups' });
  }
});

app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Group name is required' });
    const groupName = name.trim();
    const existingWord = await Word.findOne({ group: groupName });
    if (existingWord) return res.status(400).json({ error: 'Group with this name already exists' });
    res.json({ message: 'Group created successfully', name: groupName });
  } catch (error) {
    console.error('Error adding group:', error);
    res.status(500).json({ error: 'Error adding group' });
  }
});

app.put('/api/groups/:oldName', authenticateToken, async (req, res) => {
  try {
    const { oldName } = req.params;
    const { name: newName } = req.body;
    if (!newName || newName.trim() === '') return res.status(400).json({ error: 'New group name is required' });
    if (oldName === newName) return res.status(400).json({ error: 'New group name must be different' });
    if (oldName === 'Other') return res.status(400).json({ error: 'Cannot rename the default group' });
    const existingWord = await Word.findOne({ group: newName.trim() });
    if (existingWord) return res.status(400).json({ error: 'Group with this name already exists' });
    const result = await Word.updateMany({ group: oldName }, { $set: { group: newName.trim() } });
    res.json({ message: 'Group updated successfully', oldName, newName: newName.trim(), wordsUpdated: result.modifiedCount });
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Error updating group' });
  }
});

// ===== QUESTION MANAGEMENT ENDPOINTS =====
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Question.find().sort({ question: 1 });
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

app.post('/api/questions', authenticateToken, async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.status(201).json(question);
  } catch (error) {
    console.error('Error saving question:', error);
    res.status(400).json({ error: 'Error saving question' });
  }
});

app.put('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(400).json({ error: 'Error updating question' });
  }
});

app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Error deleting question' });
  }
});

// ===== STORY MANAGEMENT ENDPOINTS =====
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ title: 1 });
    res.header('Content-Type', 'application/json; charset=utf-8');
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

// ===== SAVED STORIES ENDPOINTS =====
// Fix: populate savedStories correctly and return array
app.post('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.savedStories) user.savedStories = [];
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
    const userId = req.user.id;
    const user = await User.findById(userId).populate({
      path: 'savedStories',
      select: 'title description difficulty category createdAt updatedAt'
    });

    if (!user) return res.json([]);
    res.json(user.savedStories || []);
  } catch (error) {
    console.error('❌ Error fetching saved stories:', error);
    res.status(500).json({ error: 'Error fetching saved stories' });
  }
});

app.delete('/api/saved-stories/:storyId', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.savedStories = user.savedStories?.filter(id => id.toString() !== storyId);
    await user.save();

    res.json({ message: 'Story removed from saved' });
  } catch (error) {
    console.error('Error removing saved story:', error);
    res.status(500).json({ error: 'Error removing saved story' });
  }
});

// ===== GRAMMAR LESSON MANAGEMENT ENDPOINTS =====
app.get('/api/grammar-lessons', async (req, res) => {
  try {
    const lessons = await GrammarLesson.find().sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching grammar lessons:', error);
    res.status(500).json({ error: 'Error fetching grammar lessons' });
  }
});

app.get('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const lesson = await GrammarLesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Grammar lesson not found' });
    res.json(lesson);
  } catch (error) {
    console.error('Error fetching grammar lesson:', error);
    res.status(500).json({ error: 'Error fetching grammar lesson' });
  }
});

app.post('/api/grammar-lessons', authenticateToken, async (req, res) => {
  try {
    const lesson = new GrammarLesson(req.body);
    await lesson.save();
    res.status(201).json(lesson);
  } catch (error) {
    console.error('Error saving grammar lesson:', error);
    res.status(400).json({ error: 'Error saving grammar lesson' });
  }
});

app.put('/api/grammar-lessons/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lesson) return res.status(404).json({ error: 'Grammar lesson not found' });
    res.json(lesson);
  } catch (error) {
    console.error('Error updating grammar lesson:', error);
    res.status(400).json({ error: 'Error updating grammar lesson' });
  }
});

app.delete('/api/grammar-lessons/:id', authenticateToken, async (req, res) => {
  try {
    const deletedLesson = await GrammarLesson.findByIdAndDelete(req.params.id);
    if (!deletedLesson) return res.status(404).json({ error: 'Grammar lesson not found' });
    res.json({ message: 'Grammar lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting grammar lesson:', error);
    res.status(500).json({ error: 'Error deleting grammar lesson' });
  }
});

// ===== TEST MANAGEMENT ENDPOINTS =====
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await Test.find().populate('storyId', 'title');
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(tests);
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({ error: 'Error fetching tests' });
  }
});

app.get('/api/tests/:id', async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('storyId', 'title');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ error: 'Error fetching test' });
  }
});

app.post('/api/tests', authenticateToken, async (req, res) => {
  try {
    const test = new Test(req.body);
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    console.error('Error saving test:', error);
    res.status(400).json({ error: 'Error saving test' });
  }
});

app.put('/api/tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (error) {
    console.error('Error updating test:', error);
    res.status(400).json({ error: 'Error updating test' });
  }
});

app.delete('/api/tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ message: 'Test deleted successfully' });
  } catch (err) {
    console.error('Error deleting test:', err);
    res.status(500).json({ error: 'Error deleting test' });
  }
});

app.get('/api/tests/story/:storyId', async (req, res) => {
  try {
    const tests = await Test.find({ storyId: req.params.storyId }).populate('storyId', 'title');
    res.json(tests);
  } catch (error) {
    console.error('Error fetching tests by story ID:', error);
    res.status(500).json({ error: 'Error fetching tests' });
  }
});

app.get('/api/tests/type/:type', async (req, res) => {
  try {
    const type = decodeURIComponent(req.params.type);
    const tests = await Test.find({ type });
    res.json(tests);
  } catch (error) {
    console.error('Error fetching tests by type:', error);
    res.status(500).json({ error: 'Failed to fetch tests by type' });
  }
});

// ===== CONJUGATION MANAGEMENT ENDPOINTS =====
app.get('/api/conjugations', async (req, res) => {
  try {
    const conjugations = await Conjugation.find().sort({ verb: 1 });
    res.json(conjugations);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching conjugations' });
  }
});

app.get('/api/conjugations/:id', async (req, res) => {
  try {
    const conjugation = await Conjugation.findById(req.params.id);
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json(conjugation);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching conjugation' });
  }
});

app.post('/api/conjugations', authenticateToken, async (req, res) => {
  try {
    const conjugation = new Conjugation(req.body);
    await conjugation.save();
    res.status(201).json(conjugation);
  } catch (error) {
    res.status(400).json({ error: 'Error creating conjugation' });
  }
});

app.put('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json(conjugation);
  } catch (error) {
    res.status(400).json({ error: 'Error updating conjugation' });
  }
});

app.delete('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndDelete(req.params.id);
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json({ message: 'Conjugation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting conjugation' });
  }
});

app.get('/api/conjugations/search/:term', async (req, res) => {
  try {
    const term = req.params.term;
    const conjugations = await Conjugation.find({
      $or: [
        { verb: { $regex: term, $options: 'i' } },
        { english: { $regex: term, $options: 'i' } }
      ]
    }).limit(10);
    res.json(conjugations);
  } catch (error) {
    res.status(500).json({ error: 'Error searching conjugations' });
  }
});

// ===== ADMIN FORM ENDPOINTS =====
app.get('/admin/question-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-question-form.html'));
});

app.get('/admin/story-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-story-form.html'));
});

app.get('/admin/edit-story', (req, res) => {
  const { id } = req.query;
  if (id) res.redirect(`/admin/story-form?id=${id}`);
  else res.redirect('/admin/story-form');
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
  console.log(`📝 Admin: http://localhost:${PORT}/admin/question-form`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});
