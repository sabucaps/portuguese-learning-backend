// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// -------------------
// Validate ENV
// -------------------
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set in .env');
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

// -------------------
// Import models & auth
// -------------------
const Word = require('./models/Word');
const Question = require('./models/Question');
const Story = require('./models/Story');
const GrammarLesson = require('./models/GrammarLesson');
const Test = require('./models/Test');
const Conjugation = require('./models/Conjugation');
const User = require('./models/User');
const { router: authRoutes, authenticateToken } = require('./routes/auth');

// -------------------
// Initialize app
// -------------------
const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200,
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

// -------------------
// MongoDB Connection
// -------------------
mongoose.connect(MONGODB_URI, {
  family: 4,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// -------------------
// Routes
// -------------------
app.use('/api/auth', authRoutes);

// ===== WORDS =====
app.get('/api/words', async (req, res) => {
  try {
    const words = await Word.find().sort({ portuguese: 1 });
    res.json(words);
  } catch (err) {
    console.error('Error fetching words:', err);
    res.status(500).json({ error: 'Error fetching words' });
  }
});

app.post('/api/words', authenticateToken, async (req, res) => {
  try {
    const { portuguese, english, group, examples, imageUrl } = req.body;
    if (!portuguese || !english) return res.status(400).json({ error: 'Portuguese and English required' });
    const word = new Word({ portuguese, english, group, examples, imageUrl });
    await word.save();
    res.status(201).json(word);
  } catch (err) {
    console.error('Error saving word:', err);
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
  } catch (err) {
    console.error('Error updating word:', err);
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
  } catch (err) {
    console.error('Error deleting word:', err);
    res.status(500).json({ error: 'Error deleting word' });
  }
});

// ===== QUESTIONS =====
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Question.find().sort({ question: 1 });
    res.json(questions);
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

app.post('/api/questions', authenticateToken, async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.status(201).json(question);
  } catch (err) {
    console.error('Error saving question:', err);
    res.status(400).json({ error: 'Error saving question' });
  }
});

app.put('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json(question);
  } catch (err) {
    console.error('Error updating question:', err);
    res.status(400).json({ error: 'Error updating question' });
  }
});

app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (err) {
    console.error('Error deleting question:', err);
    res.status(500).json({ error: 'Error deleting question' });
  }
});

// ===== STORIES =====
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ title: 1 });
    res.json(stories);
  } catch (err) {
    console.error('Error fetching stories:', err);
    res.status(500).json({ error: 'Error fetching stories' });
  }
});

app.get('/api/stories/:id', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  } catch (err) {
    console.error('Error fetching story:', err);
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
app.get('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Invalid user token' });

    const user = await User.findById(userId).populate({
      path: 'savedStories',
      select: 'title description difficulty category createdAt updatedAt paragraphs',
    });

    res.json(user?.savedStories || []);
  } catch (err) {
    console.error('Error fetching saved stories:', err);
    res.status(500).json({ error: 'Error fetching saved stories', details: err.message });
  }
});

app.post('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Invalid user token' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.savedStories) user.savedStories = [];
    if (!user.savedStories.includes(storyId)) {
      user.savedStories.push(storyId);
      await user.save();
    }

    res.json({ message: 'Story saved successfully' });
  } catch (err) {
    console.error('Error saving story:', err);
    res.status(500).json({ error: 'Error saving story' });
  }
});

app.delete('/api/saved-stories/:storyId', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Invalid user token' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.savedStories = user.savedStories?.filter(id => id.toString() !== storyId);
    await user.save();
    res.json({ message: 'Story removed from saved' });
  } catch (err) {
    console.error('Error removing saved story:', err);
    res.status(500).json({ error: 'Error removing saved story' });
  }
});

// ===== GRAMMAR LESSONS =====
app.get('/api/grammar-lessons', async (req, res) => {
  try {
    const lessons = await GrammarLesson.find().sort({ order: 1 });
    res.json(lessons);
  } catch (err) {
    console.error('Error fetching grammar lessons:', err);
    res.status(500).json({ error: 'Error fetching grammar lessons' });
  }
});

app.get('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const lesson = await GrammarLesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Grammar lesson not found' });
    res.json(lesson);
  } catch (err) {
    console.error('Error fetching grammar lesson:', err);
    res.status(500).json({ error: 'Error fetching grammar lesson' });
  }
});

app.post('/api/grammar-lessons', authenticateToken, async (req, res) => {
  try {
    const lesson = new GrammarLesson(req.body);
    await lesson.save();
    res.status(201).json(lesson);
  } catch (err) {
    console.error('Error saving grammar lesson:', err);
    res.status(400).json({ error: 'Error saving grammar lesson' });
  }
});

app.put('/api/grammar-lessons/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lesson) return res.status(404).json({ error: 'Grammar lesson not found' });
    res.json(lesson);
  } catch (err) {
    console.error('Error updating grammar lesson:', err);
    res.status(400).json({ error: 'Error updating grammar lesson' });
  }
});

app.delete('/api/grammar-lessons/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Grammar lesson not found' });
    res.json({ message: 'Grammar lesson deleted successfully' });
  } catch (err) {
    console.error('Error deleting grammar lesson:', err);
    res.status(500).json({ error: 'Error deleting grammar lesson' });
  }
});

// ===== TESTS =====
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await Test.find().populate('storyId', 'title');
    res.json(tests);
  } catch (err) {
    console.error('Error fetching tests:', err);
    res.status(500).json({ error: 'Error fetching tests' });
  }
});

app.get('/api/tests/:id', async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('storyId', 'title');
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    console.error('Error fetching test:', err);
    res.status(500).json({ error: 'Error fetching test' });
  }
});

app.post('/api/tests', authenticateToken, async (req, res) => {
  try {
    const test = new Test(req.body);
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    console.error('Error saving test:', err);
    res.status(400).json({ error: 'Error saving test' });
  }
});

app.put('/api/tests/:id', authenticateToken, async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    console.error('Error updating test:', err);
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
  } catch (err) {
    console.error('Error fetching tests by story:', err);
    res.status(500).json({ error: 'Error fetching tests by story' });
  }
});

app.get('/api/tests/type/:type', async (req, res) => {
  try {
    const type = decodeURIComponent(req.params.type);
    const tests = await Test.find({ type });
    res.json(tests);
  } catch (err) {
    console.error('Error fetching tests by type:', err);
    res.status(500).json({ error: 'Error fetching tests by type' });
  }
});

// ===== CONJUGATIONS =====
app.get('/api/conjugations', async (req, res) => {
  try {
    const conjugations = await Conjugation.find().sort({ verb: 1 });
    res.json(conjugations);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching conjugations' });
  }
});

app.get('/api/conjugations/:id', async (req, res) => {
  try {
    const conjugation = await Conjugation.findById(req.params.id);
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json(conjugation);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching conjugation' });
  }
});

app.post('/api/conjugations', authenticateToken, async (req, res) => {
  try {
    const conjugation = new Conjugation(req.body);
    await conjugation.save();
    res.status(201).json(conjugation);
  } catch (err) {
    res.status(400).json({ error: 'Error creating conjugation' });
  }
});

app.put('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json(conjugation);
  } catch (err) {
    res.status(400).json({ error: 'Error updating conjugation' });
  }
});

app.delete('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndDelete(req.params.id);
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json({ message: 'Conjugation deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting conjugation' });
  }
});

app.get('/api/conjugations/search/:term', async (req, res) => {
  try {
    const term = req.params.term;
    const conjugations = await Conjugation.find({
      $or: [
        { verb: { $regex: term, $options: 'i' } },
        { english: { $regex: term, $options: 'i' } },
      ],
    }).limit(10);
    res.json(conjugations);
  } catch (err) {
    res.status(500).json({ error: 'Error searching conjugations' });
  }
});

// ===== ADMIN FORMS =====
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

// ===== HEALTH =====
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server running' });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// -------------------
// Start server
// -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log(`🔑 JWT loaded: ${!!JWT_SECRET}`);
});
