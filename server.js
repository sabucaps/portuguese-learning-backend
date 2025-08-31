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
const Sentence = require('./models/Sentence');
const ImagePrompt = require('./models/ImagePrompt');
const Journal = require('./models/Journal'); // ✅ ADDED: This was missing
const { router: authRoutes, authenticateToken } = require('./routes/auth');
const flashcardsRoute = require('./routes/flashcards');
const app = express();

// -----------------------
// Config / Environment
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

// Helper to validate ObjectId (safe check)
const isValidObjectId = (id) => {
  try {
    return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
  } catch (e) {
    return false;
  }
};

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

app.get('/api/sentences', async (req, res) => {
  try {
    const sentences = await Sentence.find({});
    res.json(sentences);
  } catch (error) {
    console.error('Error fetching sentences:', error);
    res.status(500).json({ error: 'Error fetching sentences' });
  }
});

// -----------------------
// Mount modular routes
// -----------------------
app.use('/api/auth', authRoutes);
app.use('/api/flashcards', flashcardsRoute);

// -----------------------
// WORDS & GROUPS
// -----------------------
app.get('/api/words', authenticateToken, async (req, res) => {
  try {
    const words = await Word.find().sort({ portuguese: 1 });
    const user = await User.findById(req.user.id).select('progress.words.map');
    
    const wordsWithProgress = words.map(word => {
      const progress = user?.progress?.words?.map?.get(word.id) || {};
      return {
        ...word.toObject(),
        ease: progress.ease,
        interval: progress.interval,
        reviewCount: progress.reviewCount,
        lastReviewed: progress.lastReviewed,
        nextReview: progress.nextReview
      };
    });

    res.json(wordsWithProgress);
  } catch (err) {
    console.error('Error fetching words:', err);
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
    console.error('Error saving word:', err);
    res.status(400).json({ error: 'Error saving word' });
  }
});

app.put('/api/words/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const word = await Word.findById(id);
    if (!word) return res.status(404).json({ error: 'Word not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.progress.words.map) {
      user.progress.words.map = new Map();
    }

    const { ease, interval, reviewCount, lastReviewed, nextReview } = req.body;

    user.progress.words.map.set(id, {
      ease: ease || 2.5,
      interval: interval || 0,
      reviewCount: reviewCount || 0,
      lastReviewed: lastReviewed || new Date().toISOString(),
      nextReview: nextReview || null
    });

    await user.save();

    res.json({
      ...word.toObject(),
      ease: ease || 2.5,
      interval: interval || 0,
      reviewCount: reviewCount || 0,
      lastReviewed: lastReviewed || new Date().toISOString(),
      nextReview: nextReview || null
    });
  } catch (err) {
    console.error('Error updating word progress:', err);
    res.status(400).json({ error: 'Error updating progress' });
  }
});

app.delete('/api/words/:id', authenticateToken, async (req, res) => {
  try {
    const word = await Word.findByIdAndDelete(req.params.id);
    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.json({ message: 'Word deleted successfully' });
  } catch (err) {
    console.error('Error deleting word:', err);
    res.status(500).json({ error: 'Error deleting word' });
  }
});

// Groups
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Word.distinct('group');
    res.json(['Other', ...groups.filter(g => g && g !== 'Other')]);
  } catch (err) {
    console.error('Error fetching groups:', err);
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
    console.error('Error adding group:', err);
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
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Error updating group' });
  }
});

// -----------------------
// JOURNAL
// -----------------------
// POST /api/journal - Save journal entry
app.post('/api/journal', authenticateToken, async (req, res) => {
  try {
    const { userId, date, wordHistory, task1, task2, task3 } = req.body;
    
    // Validate required fields
    if (!userId || !date || !Array.isArray(wordHistory)) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Here you would create and save a Journal entry
    // For now, just echo back the data (simulate success)
    console.log('📥 Received journal entry:', { userId, date, task1, task2, task3, wordCount: wordHistory.length });
    
    // Simulate saving to database
    res.status(201).json({ 
      message: 'Journal entry saved successfully',
      id: Date.now().toString(), // Simulated ID
      ...req.body 
    });
  } catch (err) {
    console.error('Error saving journal entry:', err);
    res.status(500).json({ 
      error: 'Error saving journal entry', 
      details: err.message 
    });
  }
});

// GET /api/journal - Get user's journal
app.get('/api/journal', authenticateToken, async (req, res) => {
  try {
    const entries = await Journal.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(entries);
  } catch (err) {
    console.error('Error fetching journal:', err);
    res.status(500).json({ error: 'Error fetching journal' });
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
    res.json({ message: 'Question deleted' });
  } catch (err) {
    console.error('Error deleting question:', err);
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
    console.error('Error creating story:', err);
    res.status(400).json({ error: 'Error creating story' });
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
    res.json({ message: 'Story deleted' });
  } catch (err) {
    console.error('Error deleting story:', err);
    res.status(500).json({ error: 'Error deleting story' });
  }
});

// Saved Stories
app.get('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    console.log(`Fetching saved stories for user: ${req.user.id}`);
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const user = await User.findById(req.user.id).populate('progress.savedStories');
    if (!user) {
      return res.json([]);
    }
    res.json(user.progress.savedStories || []);
  } catch (err) {
    console.error('Error fetching saved stories:', err);
    res.status(500).json({ error: 'Error fetching saved stories', details: err.message });
  }
});

app.post('/api/saved-stories', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.body;
    if (!storyId || !isValidObjectId(storyId)) return res.status(400).json({ error: 'Valid story ID required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    if (!user.progress.savedStories.includes(storyId)) {
      user.progress.savedStories.push(storyId);
      await user.save();
    }
    res.json({ message: 'Story saved successfully' });
  } catch (err) {
    console.error('Error saving story:', err);
    res.status(500).json({ error: 'Error saving story', details: err.message });
  }
});

app.delete('/api/saved-stories/:storyId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.progress.savedStories = user.progress.savedStories.filter(id => id.toString() !== req.params.storyId);
    await user.save();
    res.json({ message: 'Story removed from saved' });
  } catch (err) {
    console.error('Error removing saved story:', err);
    res.status(500).json({ error: 'Error removing saved story', details: err.message });
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
    console.error('Error fetching tests:', err);
    res.status(500).json({ error: 'Error fetching tests' });
  }
});

app.post('/api/tests', authenticateToken, async (req, res) => {
  try {
    const test = new Test(req.body);
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    console.error('Error creating test:', err);
    res.status(400).json({ error: 'Error creating test' });
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
    res.json({ message: 'Test deleted' });
  } catch (err) {
    console.error('Error deleting test:', err);
    res.status(500).json({ error: 'Error deleting test' });
  }
});

app.get('/api/tests/story/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    const tests = await Test.find({ storyId });
    res.json(tests);
  } catch (err) {
    console.error('Error fetching tests for story:', err);
    res.status(500).json({ error: 'Error fetching tests for story' });
  }
});

app.get('/api/tests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findById(id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    console.error('Error fetching test:', err);
    res.status(500).json({ error: 'Error fetching test' });
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
    console.error('Error fetching grammar lessons:', err);
    res.status(500).json({ error: 'Error fetching grammar lessons' });
  }
});

app.post('/api/grammar', authenticateToken, async (req, res) => {
  try {
    const lesson = new GrammarLesson(req.body);
    await lesson.save();
    res.status(201).json(lesson);
  } catch (err) {
    console.error('Error creating lesson:', err);
    res.status(400).json({ error: 'Error creating lesson' });
  }
});

app.put('/api/grammar/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  } catch (err) {
    console.error('Error updating lesson:', err);
    res.status(400).json({ error: 'Error updating lesson' });
  }
});

app.delete('/api/grammar/:id', authenticateToken, async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    console.error('Error deleting lesson:', err);
    res.status(500).json({ error: 'Error deleting lesson' });
  }
});

// ===== IMAGE PROMPTS ENDPOINTS =====
app.get('/api/image-prompts', async (req, res) => {
  try {
    const prompts = await ImagePrompt.find({ isActive: true }).select('word imageUrl category').sort({ word: 1 });
    res.json(prompts);
  } catch (error) {
    console.error('Error fetching image prompts:', error);
    res.status(500).json({ error: 'Error fetching image prompts' });
  }
});

app.get('/api/image-prompts/random/:count', async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 4;
    const maxCount = 6;
    const limit = Math.min(count, maxCount);

    const total = await ImagePrompt.countDocuments({ isActive: true });
    if (total === 0) {
      return res.json([]);
    }

    if (total <= 100) {
      const prompts = await ImagePrompt.aggregate([
        { $match: { isActive: true } },
        { $sample: { size: limit } },
        { $project: { word: 1, imageUrl: 1, category: 1, _id: 0 } }
      ]);
      res.json(prompts);
    } else {
      const skip = Math.max(0, Math.floor(Math.random() * (total - limit)));
      const prompts = await ImagePrompt.find({ isActive: true })
        .select('word imageUrl category')
        .skip(skip)
        .limit(limit);
      res.json(prompts);
    }
  } catch (error) {
    console.error('Error fetching random image prompts:', error);
    res.status(500).json({ error: 'Error fetching random prompts' });
  }
});

app.post('/api/image-prompts', authenticateToken, async (req, res) => {
  try {
    const { word, imageUrl, category = 'Other', difficulty = 1 } = req.body;

    if (!word || !imageUrl) {
      return res.status(400).json({ error: 'Word and imageUrl are required' });
    }

    const existing = await ImagePrompt.findOne({ 
      $or: [
        { word: new RegExp(`^${word}$`, 'i') },
        { imageUrl }
      ]
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'Word or image already exists',
        existing: {
          word: existing.word,
          imageUrl: existing.imageUrl
        }
      });
    }

    const prompt = new ImagePrompt({ word, imageUrl, category, difficulty });
    await prompt.save();

    res.status(201).json({
      message: 'Image prompt added successfully',
      prompt: {
        word: prompt.word,
        imageUrl: prompt.imageUrl,
        category: prompt.category
      }
    });
  } catch (error) {
    console.error('Error adding image prompt:', error);
    res.status(400).json({ error: 'Error adding image prompt', details: error.message });
  }
});

app.delete('/api/image-prompts/:word', authenticateToken, async (req, res) => {
  try {
    const { word } = req.params;
    const result = await ImagePrompt.findOneAndDelete({ word });
    if (!result) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error deleting image prompt:', error);
    res.status(500).json({ error: 'Error deleting prompt' });
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
    console.error('Error fetching conjugations:', err);
    res.status(500).json({ error: 'Error fetching conjugations' });
  }
});

app.post('/api/conjugations', authenticateToken, async (req, res) => {
  try {
    const conjugation = new Conjugation(req.body);
    await conjugation.save();
    res.status(201).json(conjugation);
  } catch (err) {
    console.error('Error creating conjugation:', err);
    res.status(400).json({ error: 'Error creating conjugation' });
  }
});

app.put('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json(conjugation);
  } catch (err) {
    console.error('Error updating conjugation:', err);
    res.status(400).json({ error: 'Error updating conjugation' });
  }
});

app.delete('/api/conjugations/:id', authenticateToken, async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndDelete(req.params.id);
    if (!conjugation) return res.status(404).json({ error: 'Conjugation not found' });
    res.json({ message: 'Conjugation deleted' });
  } catch (err) {
    console.error('Error deleting conjugation:', err);
    res.status(500).json({ error: 'Error deleting conjugation' });
  }
});

// POST /api/auth/change-password
app.post('/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Error changing password' });
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
// Process Event Handlers
// -----------------------
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// -----------------------
// START SERVER
// -----------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${PORT}`);
});
