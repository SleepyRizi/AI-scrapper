import express from 'express';
import Activity from '../models/Activity.js';

const router = express.Router();

// GET /api/activities
router.get('/', async (req, res) => {
  try {
    // fetch all activities, sorting by newest first
    const activities = await Activity.find({}).sort({ timestamp: -1 });
    res.json(activities);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
