import express from 'express';
import Library from '../models/Library.js';

const router = express.Router();

// GET /api/library
router.get('/', async (req, res) => {
  try {
    // Optionally sort by the "timestamp" field in descending order
    const items = await Library.find({}).sort({ timestamp: -1 });
    res.json(items);
  } catch (err) {
    console.error('Error fetching library items:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
