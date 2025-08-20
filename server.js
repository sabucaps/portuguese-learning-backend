const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import models
const Word = require('./models/Word');
const Question = require('./models/Question');
const Story = require('./models/Story');
const GrammarLesson = require('./models/GrammarLesson'); // Moved to top with other models

// Initialize Express app
const app = express();

// Middleware
// Configure CORS for production
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // In production, set this to your app's URL
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB with UTF-8 encoding
// Use environment variable or default to local MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/portuguese_learning';

mongoose.connect(mongoURI)
.then(() => console.log('MongoDB Connected...'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

// API Routes
// Get all words
app.get('/api/words', async (req, res) => {
  console.log('GET /api/words called');
  try {
    const words = await Word.find();
    console.log(`Found ${words.length} words`);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(words);
  } catch (err) {
    console.error('Error fetching words:', err);
    res.status(500).json({ error: 'Error fetching words' });
  }
});

// Get a specific word by ID
app.get('/api/words/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`GET /api/words/${id} called`);
  
  try {
    const word = await Word.findById(id);
    
    if (!word) {
      console.log(`Word not found with ID: ${id}`);
      return res.status(404).json({ error: 'Word not found' });
    }
    
    console.log(`Found word: ${word.portuguese}`);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(word);
  } catch (err) {
    console.error('Error fetching word:', err);
    res.status(500).json({ error: 'Error fetching word' });
  }
});

// Add a new word
app.post('/api/words', async (req, res) => {
  console.log('POST /api/words called with:', req.body);
  console.log('Raw request body:', JSON.stringify(req.body));
  
  try {
    const newWord = new Word(req.body);
    console.log('Creating new word:', newWord);
    
    const word = await newWord.save();
    console.log('Word saved successfully:', word);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json(word);
  } catch (err) {
    console.error('Error saving word:', err);
    res.status(400).json({ error: 'Error saving word', details: err.message });
  }
});

// Update a word
app.put('/api/words/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`PUT /api/words/${id} called with:`, req.body);
  
  try {
    const word = await Word.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!word) {
      return res.status(404).json({ error: 'Word not found' });
    }
    
    console.log('Word updated successfully:', word);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(word);
  } catch (err) {
    console.error('Error updating word:', err);
    res.status(400).json({ error: 'Error updating word', details: err.message });
  }
});

// Delete a word
app.delete('/api/words/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/words/${id} called`);
  
  try {
    const word = await Word.findByIdAndDelete(id);
    
    if (!word) {
      return res.status(404).json({ error: 'Word not found' });
    }
    
    console.log('Word deleted successfully:', word);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json({ message: 'Word deleted successfully' });
  } catch (err) {
    console.error('Error deleting word:', err);
    res.status(500).json({ error: 'Error deleting word', details: err.message });
  }
});

// Question management endpoints
// Get all questions
app.get('/api/questions', async (req, res) => {
  console.log('GET /api/questions called');
  try {
    const questions = await Question.find();
    console.log(`Found ${questions.length} questions`);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(questions);
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ error: 'Error fetching questions' });
  }
});

// Add a new question
app.post('/api/questions', async (req, res) => {
  console.log('POST /api/questions called with:', req.body);
  
  try {
    const newQuestion = new Question(req.body);
    console.log('Creating new question:', newQuestion);
    
    const question = await newQuestion.save();
    console.log('Question saved successfully:', question);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json(question);
  } catch (err) {
    console.error('Error saving question:', err);
    res.status(400).json({ error: 'Error saving question', details: err.message });
  }
});

// Update a question
app.put('/api/questions/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`PUT /api/questions/${id} called with:`, req.body);
  
  try {
    const question = await Question.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    console.log('Question updated successfully:', question);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(question);
  } catch (err) {
    console.error('Error updating question:', err);
    res.status(400).json({ error: 'Error updating question', details: err.message });
  }
});

// Delete a question
app.delete('/api/questions/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/questions/${id} called`);
  
  try {
    const question = await Question.findByIdAndDelete(id);
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    console.log('Question deleted successfully:', question);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json({ message: 'Question deleted successfully' });
  } catch (err) {
    console.error('Error deleting question:', err);
    res.status(500).json({ error: 'Error deleting question', details: err.message });
  }
});

// Groups management endpoints
// Get all groups
app.get('/api/groups', async (req, res) => {
  console.log('GET /api/groups called');
  
  try {
    // Get all words and extract unique groups
    const words = await Word.find({}, 'group');
    console.log(`Found ${words.length} words for group extraction`);
    
    // Extract unique groups manually
    const uniqueGroups = new Set();
    words.forEach(word => {
      // Check if group field exists and has a value
      if (word.group && typeof word.group === 'string' && word.group.trim() !== '') {
        uniqueGroups.add(word.group);
      }
    });
    
    // Convert Set to Array and create group objects
    const groupObjects = Array.from(uniqueGroups).map(name => ({
      name: name,
      isDefault: name === 'Other'
    }));
    
    // If no groups found, add a default group
    if (groupObjects.length === 0) {
      groupObjects.push({ name: 'Other', isDefault: true });
    }
    
    console.log(`Returning ${groupObjects.length} groups:`, groupObjects);
    
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json({
      groups: groupObjects,
      defaultGroup: 'Other'
    });
  } catch (error) {
    console.error('Unexpected error in /api/groups:', error);
    res.status(500).json({ error: 'Unexpected error', details: error.message });
  }
});

// Simple test endpoint for groups
app.get('/api/test-groups', (req, res) => {
  console.log('GET /api/test-groups called');
  
  // Simple test - just return some static groups
  const testGroups = [
    { name: 'Greetings', isDefault: false },
    { name: 'Food', isDefault: false },
    { name: 'Other', isDefault: true }
  ];
  
  res.json({
    groups: testGroups,
    defaultGroup: 'Other'
  });
});

// Add a new group
app.post('/api/groups', async (req, res) => {
  console.log('POST /api/groups called with:', req.body);
  
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  
  try {
    // Check if group already exists by checking if any word has this group
    const word = await Word.findOne({ group: name });
    
    if (word) {
      return res.status(400).json({ error: 'Group already exists' });
    }
    
    // Group doesn't exist, so it's valid
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json({ 
      message: 'Group created successfully',
      group: { name, isDefault: false }
    });
  } catch (err) {
    console.error('Error checking group existence:', err);
    res.status(500).json({ error: 'Error checking group existence' });
  }
});

// Update a group
app.put('/api/groups/:groupName', async (req, res) => {
  const { groupName } = req.params;
  const { name: newName } = req.body;
  
  console.log(`PUT /api/groups/${groupName} called with:`, req.body);
  
  if (!newName) {
    return res.status(400).json({ error: 'New group name is required' });
  }
  
  if (groupName === newName) {
    return res.status(400).json({ error: 'New group name must be different from current name' });
  }
  
  try {
    // Update all words with the old group name to use the new group name
    const result = await Word.updateMany(
      { group: groupName },
      { $set: { group: newName } },
      { multi: true }
    );
    
    console.log(`Updated ${result.modifiedCount} words from group "${groupName}" to "${newName}"`);
    
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json({ 
      message: 'Group updated successfully',
      oldName: groupName,
      newName: newName,
      wordsUpdated: result.modifiedCount
    });
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Error updating group' });
  }
});

// Delete a group
app.delete('/api/groups/:groupName', async (req, res) => {
  const { groupName } = req.params;
  
  console.log(`DELETE /api/groups/${groupName} called`);
  
  try {
    // Update all words with the specified group to use the default group
    const result = await Word.updateMany(
      { group: groupName },
      { $set: { group: 'Other' } },
      { multi: true }
    );
    
    console.log(`Moved ${result.modifiedCount} words from group "${groupName}" to default group`);
    
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json({ 
      message: 'Group deleted successfully',
      deletedGroup: groupName,
      wordsMoved: result.modifiedCount,
      newGroup: 'Other'
    });
  } catch (err) {
    console.error('Error updating words to default group:', err);
    res.status(500).json({ error: 'Error updating words to default group' });
  }
});

// Story management endpoints
// Get all stories
app.get('/api/stories', async (req, res) => {
  console.log('GET /api/stories called');
  try {
    const stories = await Story.find();
    console.log(`Found ${stories.length} stories`);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(stories);
  } catch (err) {
    console.error('Error fetching stories:', err);
    res.status(500).json({ error: 'Error fetching stories' });
  }
});

// Get a specific story by ID
app.get('/api/stories/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`GET /api/stories/${id} called`);
  
  try {
    const story = await Story.findById(id);
    
    if (!story) {
      console.log(`Story not found with ID: ${id}`);
      return res.status(404).json({ error: 'Story not found' });
    }
    
    console.log(`Found story: ${story.title}`);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(story);
  } catch (err) {
    console.error('Error fetching story:', err);
    res.status(500).json({ error: 'Error fetching story' });
  }
});

// Add a new story
app.post('/api/stories', async (req, res) => {
  console.log('POST /api/stories called with:', req.body);
  
  try {
    const newStory = new Story(req.body);
    console.log('Creating new story:', newStory);
    
    const story = await newStory.save();
    console.log('Story saved successfully:', story);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json(story);
  } catch (err) {
    console.error('Error saving story:', err);
    res.status(400).json({ error: 'Error saving story', details: err.message });
  }
});

// Update a story
app.put('/api/stories/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`PUT /api/stories/${id} called with:`, req.body);
  
  try {
    const story = await Story.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!story) {
      console.log(`Story not found with ID: ${id}`);
      return res.status(404).json({ error: 'Story not found' });
    }
    
    console.log('Story updated successfully:', story);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(story);
  } catch (err) {
    console.error('Error updating story:', err);
    res.status(400).json({ error: 'Error updating story', details: err.message });
  }
});

// Delete a story
app.delete('/api/stories/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/stories/${id} called`);
  
  try {
    const story = await Story.findByIdAndDelete(id);
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    console.log('Story deleted successfully:', story);
    res.json({ message: 'Story deleted successfully' });
  } catch (err) {
    console.error('Error deleting story:', err);
    res.status(500).json({ error: 'Error deleting story' });
  }
});

// Grammar Lesson management endpoints
// Get all grammar lessons
app.get('/api/grammar-lessons', async (req, res) => {
  try {
    const { difficulty, category } = req.query;
    let filter = {};
    if (difficulty) filter.difficulty = difficulty;
    if (category) filter.category = category;
    
    const lessons = await GrammarLesson.find(filter)
      .sort({ order: 1 })
      .populate('relatedWords', 'portuguese english');
    
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single grammar lesson
app.get('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const lesson = await GrammarLesson.findById(req.params.id)
      .populate('relatedWords', 'portuguese english group examples');
    
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new grammar lesson
app.post('/api/grammar-lessons', async (req, res) => {
  try {
    const lesson = new GrammarLesson(req.body);
    const newLesson = await lesson.save();
    res.status(201).json(newLesson);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a grammar lesson
app.put('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a grammar lesson
app.delete('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const lesson = await GrammarLesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Debug endpoint to check database structure
app.get('/api/debug', async (req, res) => {
  console.log('GET /api/debug called');
  
  try {
    // Get a sample word to check its structure
    const word = await Word.findOne();
    
    if (!word) {
      return res.status(404).json({ error: 'No words found in database' });
    }
    
    // Get field names from the word object
    const fieldNames = Object.keys(word.toObject());
    
    res.json({
      message: 'Debug information',
      sampleWord: word,
      fieldNames: fieldNames,
      mongooseVersion: mongoose.version
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: 'Debug error', details: err.message });
  }
});

// Serve the question form
app.get('/admin/question-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-question-form.html'));
});

// Serve the story form
app.get('/admin/story-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-story-form.html'));
});

// Serve the story form with edit parameter
app.get('/admin/edit-story', (req, res) => {
  const { id } = req.query;
  if (id) {
    res.redirect(`/admin/story-form?id=${id}`);
  } else {
    res.redirect('/admin/story-form');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
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
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`API endpoints: http://localhost:${PORT}/api/words`);
  console.log(`Question management: http://localhost:${PORT}/api/questions`);
  console.log(`Story management: http://localhost:${PORT}/api/stories`);
  console.log(`Groups management: http://localhost:${PORT}/api/groups`);
  console.log(`Grammar lessons: http://localhost:${PORT}/api/grammar-lessons`);
  console.log(`Debug endpoint: http://localhost:${PORT}/api/debug`);
  console.log(`Admin form: http://localhost:${PORT}/admin/question-form`);

});
