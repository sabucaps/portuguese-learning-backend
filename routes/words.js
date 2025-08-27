const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { searchImages } = require('../services/imageSearch');

// GET ALL WORDS with advanced filtering, sorting, and pagination
router.get('/', async (req, res) => {
  try {
    const {
      search,
      group,
      sort = 'portuguese',
      order = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    let filter = {};

    // Full-text search across Portuguese and English (case-insensitive)
    if (search && search.trim() !== '') {
      filter.$or = [
        { portuguese: { $regex: search.trim(), $options: 'i' } },
        { english: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Filter by group (supports 'Ungrouped' as null)
    if (group && group !== 'All') {
      if (group === 'Ungrouped') {
        filter.group = { $in: [null, '', undefined] };
      } else {
        filter.group = group;
      }
    }

    // Define allowed sort fields to prevent injection
    const allowedSortFields = ['portuguese', 'english', 'group', 'difficulty', 'createdAt'];
    const sortBy = allowedSortFields.includes(sort) ? sort : 'portuguese';

    // Sort order
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = { [sortBy]: sortOrder };

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Fetch filtered, sorted, paginated words
    const words = await Word
      .find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Word.countDocuments(filter);

    // Respond with structured data
    res.json({
      words,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum)
      },
      filters: {
        search: search || null,
        group: group || null
      }
    });
  } catch (err) {
    console.error('Error fetching words:', err.message);
    res.status(500).json({ error: 'Server error while fetching words' });
  }
});

// ADD A NEW WORD (with image search)
router.post('/', async (req, res) => {
  const { portuguese, english, partOfSpeech, gender, examples, difficulty, group } = req.body;

  // Validate required fields
  if (!portuguese || !english) {
    return res.status(400).json({ msg: 'Portuguese and English translations are required' });
  }

  try {
    // Check if word already exists (case-insensitive)
    const normalizedPortuguese = portuguese.trim();
    const existingWord = await Word.findOne({
      portuguese: { $regex: new RegExp(`^${normalizedPortuguese}$`, 'i') }
    });

    if (existingWord) {
      return res.status(400).json({ msg: 'Word already exists' });
    }

    // Search for a relevant image
    const imageUrl = await searchImages(normalizedPortuguese);

    // Create new word
    const word = new Word({
      portuguese: normalizedPortuguese,
      english: english.trim(),
      partOfSpeech,
      gender,
      examples: examples?.length ? examples : [],
      difficulty: difficulty || 'beginner',
      group: group || null,
      imageUrl
    });

    await word.save();
    res.status(201).json(word);
  } catch (err) {
    console.error('Error creating word:', err.message);
    res.status(500).json({ error: 'Server error while saving word' });
  }
});

// GET SINGLE WORD BY ID
router.get('/:id', async (req, res) => {
  try {
    const word = await Word.findById(req.params.id);
    if (!word) {
      return res.status(404).json({ msg: 'Word not found' });
    }
    res.json(word);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Word not found' });
    }
    res.status(500).send('Server error');
  }
});

// UPDATE A WORD
router.put('/:id', async (req, res) => {
  const { portuguese, english, partOfSpeech, gender, examples, difficulty, group } = req.body;

  try {
    let word = await Word.findById(req.params.id);
    if (!word) {
      return res.status(404).json({ msg: 'Word not found' });
    }

    // Check for duplicates on update (except self)
    if (portuguese) {
      const normalizedPortuguese = portuguese.trim();
      const duplicate = await Word.findOne({
        portuguese: { $regex: new RegExp(`^${normalizedPortuguese}$`, 'i') },
        _id: { $ne: word._id }
      });
      if (duplicate) {
        return res