// File: routes/previewRoutes.js (example)
import express from 'express';
import { getLinkPreview } from 'link-preview-js';

const router = express.Router();

router.get('/', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const data = await getLinkPreview(targetUrl);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching link preview:', err);
    return res.status(500).json({ error: 'Link preview failed' });
  }
});

export default router;
