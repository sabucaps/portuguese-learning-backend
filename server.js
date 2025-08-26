const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const multer = require('multer');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
// Load environment variables
dotenv.config();
// Import models
const Word = require('./models/Word');
const Question = require('./models/Question');
const Story = require('./models/Story');
const GrammarLesson = require('./models/GrammarLesson');
const Test = require('./models/Test'); // Added Test model import
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
// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Connect to MongoDB with UTF-8 encoding
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portuguese_learning';
// Log the URI being used (helpful for debugging)
console.log('Attempting to connect to MongoDB with URI:', mongoURI);
mongoose.connect(mongoURI, {
  family: 4,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('MongoDB Connected...'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  console.error('Connection string used:', mongoURI);
  process.exit(1);
});
// Simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('GET /api/test called');
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date(),
    port: process.env.PORT || 5000
  });
});
// Debug endpoint to check database structure
app.get('/api/debug', async (req, res) => {
  console.log('GET /api/debug called');
  
  try {
    // Check database connection
    const db = mongoose.connection;
    const dbState = db.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // Get database name
    const dbName = db.name;
    
    // Get collections
    const collections = await db.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Get counts for each collection
    const counts = {};
    for (const collectionName of collectionNames) {
      counts[collectionName] = await db.db.collection(collectionName).countDocuments();
    }
    
    // Get a sample word to check its structure
    let sampleWord = null;
    let fieldNames = [];
    if (collectionNames.includes('words') && counts.words > 0) {
      sampleWord = await Word.findOne();
      if (sampleWord) {
        fieldNames = Object.keys(sampleWord.toObject());
      }
    }
    
    res.json({
      message: 'Debug information',
      database: {
        name: dbName,
        state: dbStates[dbState],
        collections: collectionNames,
        counts: counts
      },
      sampleWord: sampleWord,
      fieldNames: fieldNames,
      mongooseVersion: mongoose.version
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: 'Debug error', details: err.message });
  }
});
// ===== GROUPS MANAGEMENT ENDPOINTS =====
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
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Error fetching groups', details: error.message });
  }
});
// Add a new group
app.post('/api/groups', async (req, res) => {
  console.log('POST /api/groups called with:', req.body);
  
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  
  if (name.trim() === '') {
    return res.status(400).json({ error: 'Group name cannot be empty' });
  }
  
  try {
    // Check if group already exists by checking if any word has this group
    const existingWord = await Word.findOne({ group: name.trim() });
    
    if (existingWord) {
      return res.status(400).json({ error: 'Group already exists' });
    }
    
    // Group doesn't exist, so it's valid
    console.log(`Group "${name}" created successfully`);
    
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json({ 
      message: 'Group created successfully',
      group: { name: name.trim(), isDefault: false }
    });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Error creating group', details: err.message });
  }
});
// Update a group name
app.put('/api/groups/:groupName', async (req, res) => {
  const { groupName } = req.params;
  const { name: newName } = req.body;
  
  console.log(`PUT /api/groups/${groupName} called with:`, req.body);
  
  if (!newName) {
    return res.status(400).json({ error: 'New group name is required' });
  }
  
  if (newName.trim() === '') {
    return res.status(400).json({ error: 'New group name cannot be empty' });
  }
  
  if (groupName === newName) {
    return res.status(400).json({ error: 'New group name must be different from current name' });
  }
  
  // Don't allow renaming the default group
  if (groupName === 'Other') {
    return res.status(400).json({ error: 'Cannot rename the default group' });
  }
  
  try {
    // Check if new group name already exists
    const existingWord = await Word.findOne({ group: newName.trim() });
    
    if (existingWord) {
      return res.status(400).json({ error: 'Group with this name already exists' });
    }
    
    // Update all words with the old group name to use the new group name
    const result = await Word.updateMany(
      { group: groupName },
      { $set: { group: newName.trim() } },
      { multi: true }
    );
    
    console.log(`Updated ${result.modifiedCount} words from group "${groupName}" to "${newName}"`);
    
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json({ 
      message: 'Group updated successfully',
      oldName: groupName,
      newName: newName.trim(),
      wordsUpdated: result.modifiedCount
    });
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Error updating group', details: err.message });
  }
});
// Delete a group
app.delete('/api/groups/:groupName', async (req, res) => {
  const { groupName } = req.params;
  
  console.log(`DELETE /api/groups/${groupName} called`);
  
  // Don't allow deleting the default group
  if (groupName === 'Other') {
    return res.status(400).json({ error: 'Cannot delete the default group' });
  }
  
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
    console.error('Error deleting group:', err);
    res.status(500).json({ error: 'Error deleting group', details: err.message });
  }
});
// ===== WORDS MANAGEMENT ENDPOINTS =====
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
// ===== EXPORT ENDPOINTS =====
// Improved CSV Export
app.get('/api/words/export/csv', async (req, res) => {
  console.log('GET /api/words/export/csv called');
  
  try {
    // Get all words, sorted by Portuguese
    const words = await Word.find({}).sort({ portuguese: 1 });
    console.log(`Found ${words.length} words to export`);
    
    if (words.length === 0) {
      return res.status(404).json({ error: 'No words found to export' });
    }
    
    // Create CSV file path
    const filePath = path.join(__dirname, 'exports', 'portuguese_words_export.csv');
    
    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Create CSV writer with better formatting
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'portuguese', title: 'Portuguese' },
        { id: 'english', title: 'English Translation' },
        { id: 'group', title: 'Category' },
        { id: 'example', title: 'Example Sentence' },
        { id: 'difficulty', title: 'Difficulty Level' }
      ],
      alwaysQuote: true,
      encoding: 'utf8'
    });
    
    // Prepare data for CSV with better formatting
    const csvData = words.map(word => ({
      portuguese: word.portuguese || '',
      english: word.english || '',
      group: word.group || 'Uncategorized',
      example: word.examples && word.examples.length > 0 ? word.examples[0] : '',
      difficulty: word.difficulty || 'Beginner'
    }));
    
    // Write words to CSV
    await csvWriter.writeRecords(csvData);
    
    console.log(`CSV file created at: ${filePath}`);
    
    // Send the file as download with a better filename
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    res.download(filePath, `portuguese_vocabulary_${date}.csv`, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Error downloading file' });
      } else {
        // Delete the file after download
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
      }
    });
  } catch (error) {
    console.error('Error exporting words to CSV:', error);
    res.status(500).json({ error: 'Error exporting words to CSV', details: error.message });
  }
});
// JSON Export
app.get('/api/words/export/json', async (req, res) => {
  console.log('GET /api/words/export/json called');
  
  try {
    // Get all words, sorted by Portuguese
    const words = await Word.find({}).sort({ portuguese: 1 });
    console.log(`Found ${words.length} words to export`);
    
    if (words.length === 0) {
      return res.status(404).json({ error: 'No words found to export' });
    }
    
    // Prepare data for JSON export
    const exportData = {
      exportDate: new Date().toISOString(),
      totalWords: words.length,
      words: words.map(word => ({
        portuguese: word.portuguese,
        english: word.english,
        group: word.group || 'Uncategorized',
        examples: word.examples || [],
        difficulty: word.difficulty || 'Beginner',
        createdAt: word.createdAt,
        updatedAt: word.updatedAt
      }))
    };
    
    // Set headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=portuguese_vocabulary_${new Date().toISOString().split('T')[0]}.json`);
    
    // Send JSON data
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting words to JSON:', error);
    res.status(500).json({ error: 'Error exporting words to JSON', details: error.message });
  }
});
// Excel Export
app.get('/api/words/export/excel', async (req, res) => {
  console.log('GET /api/words/export/excel called');
  
  try {
    // Get all words, sorted by Portuguese
    const words = await Word.find({}).sort({ portuguese: 1 });
    console.log(`Found ${words.length} words to export`);
    
    if (words.length === 0) {
      return res.status(404).json({ error: 'No words found to export' });
    }
    
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    
    // Add a worksheet for vocabulary
    const vocabularyWorksheet = workbook.addWorksheet('Vocabulary');
    
    // Define columns
    vocabularyWorksheet.columns = [
      { header: 'Portuguese', key: 'portuguese', width: 20 },
      { header: 'English', key: 'english', width: 20 },
      { header: 'Category', key: 'group', width: 15 },
      { header: 'Difficulty', key: 'difficulty', width: 12 },
      { header: 'Example', key: 'example', width: 40 }
    ];
    
    // Add data rows
    words.forEach(word => {
      vocabularyWorksheet.addRow({
        portuguese: word.portuguese || '',
        english: word.english || '',
        group: word.group || 'Uncategorized',
        difficulty: word.difficulty || 'Beginner',
        example: word.examples && word.examples.length > 0 ? word.examples[0] : ''
      });
    });
    
    // Add a worksheet for statistics
    const statsWorksheet = workbook.addWorksheet('Statistics');
    
    // Calculate statistics
    const groupCounts = {};
    const difficultyCounts = {};
    
    words.forEach(word => {
      const group = word.group || 'Uncategorized';
      const difficulty = word.difficulty || 'Beginner';
      
      groupCounts[group] = (groupCounts[group] || 0) + 1;
      difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
    });
    
    // Add statistics data
    statsWorksheet.addRow(['Export Statistics']);
    statsWorksheet.addRow(['Total Words', words.length]);
    statsWorksheet.addRow([]);
    statsWorksheet.addRow(['Category', 'Count']);
    Object.entries(groupCounts).forEach(([group, count]) => {
      statsWorksheet.addRow([group, count]);
    });
    statsWorksheet.addRow([]);
    statsWorksheet.addRow(['Difficulty', 'Count']);
    Object.entries(difficultyCounts).forEach(([difficulty, count]) => {
      statsWorksheet.addRow([difficulty, count]);
    });
    
    // Style the header row
    const headerRow = vocabularyWorksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    
    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Set headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=portuguese_vocabulary_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    // Send Excel file
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting words to Excel:', error);
    res.status(500).json({ error: 'Error exporting words to Excel', details: error.message });
  }
});
// ===== IMPORT ENDPOINTS =====
// CSV Import
app.post('/api/words/import/csv', upload.single('file'), async (req, res) => {
  console.log('POST /api/words/import/csv called');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const filePath = req.file.path;
  const skipExisting = req.body.skipExisting === 'true';
  
  console.log(`Processing CSV file: ${filePath}`);
  console.log(`Skip existing words: ${skipExisting}`);
  
  try {
    const results = [];
    let totalRows = 0;
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Create a readable stream from the file
    const stream = fs.createReadStream(filePath);
    
    // Pipe the stream through csv-parser
    stream
      .pipe(csv())
      .on('data', (data) => {
        totalRows++;
        
        // Convert keys to lowercase for case-insensitive matching
        const lowerCaseData = {};
        Object.keys(data).forEach(key => {
          lowerCaseData[key.toLowerCase()] = data[key];
        });
        
        // Validate required fields
        if (!lowerCaseData.portuguese || !lowerCaseData.english) {
          errors++;
          return;
        }
        
        results.push({
          portuguese: lowerCaseData.portuguese,
          english: lowerCaseData.english,
          group: lowerCaseData.group || null,
          examples: lowerCaseData.example ? [lowerCaseData.example] : [],
          imageUrl: lowerCaseData['image url'] || null
        });
      })
      .on('end', async () => {
        try {
          console.log(`CSV file parsed with ${totalRows} rows`);
          console.log(`Valid rows to process: ${results.length}`);
          
          // Process each valid row
          for (const wordData of results) {
            try {
              // Check if word already exists if skipExisting is true
              if (skipExisting) {
                const existingWord = await Word.findOne({
                  portuguese: wordData.portuguese,
                  english: wordData.english
                });
                
                if (existingWord) {
                  skipped++;
                  continue;
                }
              }
              
              // Create new word
              const newWord = new Word(wordData);
              await newWord.save();
              imported++;
            } catch (error) {
              console.error('Error importing word:', error);
              errors++;
            }
          }
          
          // Clean up the uploaded file
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
          });
          
          // Return import results
          res.json({
            message: 'CSV import completed',
            totalRows: totalRows,
            imported: imported,
            skipped: skipped,
            errors: errors
          });
          
          console.log(`Import completed: ${imported} imported, ${skipped} skipped, ${errors} errors`);
        } catch (error) {
          console.error('Error processing CSV data:', error);
          
          // Clean up the uploaded file
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
          });
          
          res.status(500).json({ error: 'Error processing CSV data', details: error.message });
        }
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
        
        // Clean up the uploaded file
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting uploaded file:', err);
        });
        
        res.status(500).json({ error: 'Error reading CSV file', details: error.message });
      });
  } catch (error) {
    console.error('Error importing CSV:', error);
    
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });
    
    res.status(500).json({ error: 'Error importing CSV', details: error.message });
  }
});
// JSON Import
app.post('/api/words/import/json', upload.single('file'), async (req, res) => {
  console.log('POST /api/words/import/json called');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const filePath = req.file.path;
  const skipExisting = req.body.skipExisting === 'true';
  
  console.log(`Processing JSON file: ${filePath}`);
  console.log(`Skip existing words: ${skipExisting}`);
  
  try {
    // Read the JSON file
    const fileData = fs.readFileSync(filePath, 'utf8');
    const wordsData = JSON.parse(fileData);
    
    if (!Array.isArray(wordsData)) {
      return res.status(400).json({ error: 'JSON file must contain an array of word objects' });
    }
    
    let totalRows = wordsData.length;
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each word
    for (const wordData of wordsData) {
      try {
        // Validate required fields
        if (!wordData.portuguese || !wordData.english) {
          errors++;
          continue;
        }
        
        // Check if word already exists if skipExisting is true
        if (skipExisting) {
          const existingWord = await Word.findOne({
            portuguese: wordData.portuguese,
            english: wordData.english
          });
          
          if (existingWord) {
            skipped++;
            continue;
          }
        }
        
        // Create new word
        const newWord = new Word({
          portuguese: wordData.portuguese,
          english: wordData.english,
          group: wordData.group || null,
          examples: wordData.examples || [],
          imageUrl: wordData.imageUrl || null
        });
        
        await newWord.save();
        imported++;
      } catch (error) {
        console.error('Error importing word:', error);
        errors++;
      }
    }
    
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });
    
    // Return import results
    res.json({
      message: 'JSON import completed',
      totalRows: totalRows,
      imported: imported,
      skipped: skipped,
      errors: errors
    });
    
    console.log(`JSON import completed: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  } catch (error) {
    console.error('Error importing JSON:', error);
    
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });
    
    res.status(500).json({ error: 'Error importing JSON', details: error.message });
  }
});
// Excel Import
app.post('/api/words/import/excel', upload.single('file'), async (req, res) => {
  console.log('POST /api/words/import/excel called');
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const filePath = req.file.path;
  const skipExisting = req.body.skipExisting === 'true';
  
  console.log(`Processing Excel file: ${filePath}`);
  console.log(`Skip existing words: ${skipExisting}`);
  
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const wordsData = XLSX.utils.sheet_to_json(worksheet);
    
    let totalRows = wordsData.length;
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each word
    for (const wordData of wordsData) {
      try {
        // Validate required fields
        if (!wordData.Portuguese || !wordData.English) {
          errors++;
          continue;
        }
        
        // Check if word already exists if skipExisting is true
        if (skipExisting) {
          const existingWord = await Word.findOne({
            portuguese: wordData.Portuguese,
            english: wordData.English
          });
          
          if (existingWord) {
            skipped++;
            continue;
          }
        }
        
        // Create new word
        const newWord = new Word({
          portuguese: wordData.Portuguese,
          english: wordData.English,
          group: wordData.Group || null,
          examples: wordData.Example ? [wordData.Example] : [],
          imageUrl: wordData['Image URL'] || null
        });
        
        await newWord.save();
        imported++;
      } catch (error) {
        console.error('Error importing word:', error);
        errors++;
      }
    }
    
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });
    
    // Return import results
    res.json({
      message: 'Excel import completed',
      totalRows: totalRows,
      imported: imported,
      skipped: skipped,
      errors: errors
    });
    
    console.log(`Excel import completed: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  } catch (error) {
    console.error('Error importing Excel:', error);
    
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting uploaded file:', err);
    });
    
    res.status(500).json({ error: 'Error importing Excel', details: error.message });
  }
});
// ===== QUESTION MANAGEMENT ENDPOINTS =====
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
// ===== STORY MANAGEMENT ENDPOINTS =====
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
// ===== GRAMMAR LESSON MANAGEMENT ENDPOINTS =====
// Get all grammar lessons
app.get('/api/grammar-lessons', async (req, res) => {
  try {
    const lessons = await GrammarLesson.find().sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching grammar lessons:', error);
    res.status(500).json({ error: 'Error fetching grammar lessons' });
  }
});

// Get a specific grammar lesson by ID
app.get('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const lesson = await GrammarLesson.findById(req.params.id)
      .populate('relatedWords', 'portuguese english');
    
    if (!lesson) {
      return res.status(404).json({ error: 'Grammar lesson not found' });
    }
    
    res.json(lesson);
  } catch (error) {
    console.error('Error fetching grammar lesson:', error);
    res.status(500).json({ error: 'Error fetching grammar lesson' });
  }
});

// Create a new grammar lesson
app.post('/api/grammar-lessons', async (req, res) => {
  try {
    const newLesson = new GrammarLesson(req.body);
    const savedLesson = await newLesson.save();
    res.status(201).json(savedLesson);
  } catch (error) {
    console.error('Error creating grammar lesson:', error);
    res.status(400).json({ error: 'Error creating grammar lesson' });
  }
});

// Update a grammar lesson
app.put('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const updatedLesson = await GrammarLesson.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    if (!updatedLesson) {
      return res.status(404).json({ error: 'Grammar lesson not found' });
    }
    
    res.json(updatedLesson);
  } catch (error) {
    console.error('Error updating grammar lesson:', error);
    res.status(400).json({ error: 'Error updating grammar lesson' });
  }
});

// Delete a grammar lesson
app.delete('/api/grammar-lessons/:id', async (req, res) => {
  try {
    const deletedLesson = await GrammarLesson.findByIdAndDelete(req.params.id);
    
    if (!deletedLesson) {
      return res.status(404).json({ error: 'Grammar lesson not found' });
    }
    
    res.json({ message: 'Grammar lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting grammar lesson:', error);
    res.status(500).json({ error: 'Error deleting grammar lesson' });
  }
});
// ===== TEST MANAGEMENT ENDPOINTS =====
// Get all tests
app.get('/api/tests', async (req, res) => {
  console.log('GET /api/tests called');
  try {
    const tests = await Test.find().populate('storyId', 'title');
    console.log(`Found ${tests.length} tests`);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(tests);
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({ error: 'Error fetching tests' });
  }
});
// Get a single test by ID
app.get('/api/tests/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`GET /api/tests/${id} called`);
  
  try {
    const test = await Test.findById(id).populate('storyId', 'title');
    
    if (!test) {
      console.log(`Test not found with ID: ${id}`);
      return res.status(404).json({ error: 'Test not found' });
    }
    
    console.log(`Found test: ${test.title}`);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(test);
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ error: 'Error fetching test' });
  }
});
// Create a new test
app.post('/api/tests', async (req, res) => {
  console.log('POST /api/tests called with:', req.body);
  
  try {
    const newTest = new Test(req.body);
    console.log('Creating new test:', newTest);
    
    const test = await newTest.save();
    // Populate the story title for the response
    await test.populate('storyId', 'title');
    
    console.log('Test saved successfully:', test);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json(test);
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(400).json({ error: 'Error creating test', details: error.message });
  }
});
// Update a test
app.put('/api/tests/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`PUT /api/tests/${id} called with:`, req.body);
  
  try {
    const test = await Test.findByIdAndUpdate(id, req.body, { new: true }).populate('storyId', 'title');
    
    if (!test) {
      console.log(`Test not found with ID: ${id}`);
      return res.status(404).json({ error: 'Test not found' });
    }
    
    console.log('Test updated successfully:', test);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json(test);
  } catch (error) {
    console.error('Error updating test:', error);
    res.status(400).json({ error: 'Error updating test', details: error.message });
  }
});
// Delete a test
app.delete('/api/tests/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/tests/${id} called`);
  
  try {
    const test = await Test.findByIdAndDelete(id);
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    console.log('Test deleted successfully:', test);
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.json({ message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).json({ error: 'Error deleting test' });
  }
});
// Get tests by story ID
app.get('/api/tests/story/:storyId', async (req, res) => {
  const { storyId } = req.params;
  console.log(`GET /api/tests/story/${storyId} called`);
  
  try {
    const tests = await Test.find({ storyId }).populate('storyId', 'title');
    console.log(`Found ${tests.length} tests for story ${storyId}`);
    res.json(tests);
  } catch (error) {
    console.error('Error fetching tests by story ID:', error);
    res.status(500).json({ error: 'Error fetching tests' });
  }
});

const Conjugation = require('./models/Conjugation');

// Get all conjugations
app.get('/api/conjugations', async (req, res) => {
  try {
    const conjugations = await Conjugation.find().sort({ verb: 1 });
    res.json(conjugations);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching conjugations' });
  }
});

// Get a single conjugation
app.get('/api/conjugations/:id', async (req, res) => {
  try {
    const conjugation = await Conjugation.findById(req.params.id);
    if (!conjugation) {
      return res.status(404).json({ error: 'Conjugation not found' });
    }
    res.json(conjugation);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching conjugation' });
  }
});

// Create a new conjugation
app.post('/api/conjugations', async (req, res) => {
  try {
    const conjugation = new Conjugation(req.body);
    await conjugation.save();
    res.status(201).json(conjugation);
  } catch (error) {
    res.status(400).json({ error: 'Error creating conjugation', details: error.message });
  }
});

// Update a conjugation
app.put('/api/conjugations/:id', async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!conjugation) {
      return res.status(404).json({ error: 'Conjugation not found' });
    }
    res.json(conjugation);
  } catch (error) {
    res.status(400).json({ error: 'Error updating conjugation', details: error.message });
  }
});

// Delete a conjugation
app.delete('/api/conjugations/:id', async (req, res) => {
  try {
    const conjugation = await Conjugation.findByIdAndDelete(req.params.id);
    if (!conjugation) {
      return res.status(404).json({ error: 'Conjugation not found' });
    }
    res.json({ message: 'Conjugation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting conjugation' });
  }
});

// Search conjugations
app.get('/api/conjugations/search/:term', async (req, res) => {
  try {
    const term = req.params.term.toLowerCase();
    const conjugations = await Conjugation.find({
      $or: [
        { verb: { $regex: term, $options: 'i' } },
        { english: { $regex: term, $options: 'i' } }
      ]
    });
    res.json(conjugations);
  } catch (error) {
    res.status(500).json({ error: 'Error searching conjugations' });
  }
});
// GET /api/tests/type/:type
app.get('/api/tests/type/:type', async (req, res) => {
  try {
    const type = decodeURIComponent(req.params.type);
    const tests = await Test.find({ type });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tests by type' });
  }
});
// ===== ADMIN FORM ENDPOINTS =====
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
// ===== HEALTH CHECK ENDPOINT =====
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});
// ===== ERROR HANDLING =====
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
  console.log(`Test management: http://localhost:${PORT}/api/tests`);
  console.log(`Debug endpoint: http://localhost:${PORT}/api/debug`);
  console.log(`Admin form: http://localhost:${PORT}/admin/question-form`);
  console.log(`CSV Export: http://localhost:${PORT}/api/words/export/csv`);
  console.log(`JSON Export: http://localhost:${PORT}/api/words/export/json`);
  console.log(`Excel Export: http://localhost:${PORT}/api/words/export/excel`);
});
