// File: src/index.js

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import { chromium } from 'playwright';
import prompt from 'prompt';
import colors from '@colors/colors';
import { Command } from 'commander';

import { ChatOpenAI } from 'langchain/chat_models/openai';
import { doActionWithAutoGPT } from './autogpt/index.js';
import { interactWithPage } from './actions/index.js';
import { createTestFile, gracefulExit, logPageScreenshot } from './util/index.js';

// Import your models & routes
import Admin from './models/Admin.js';
import authRoutes from './routes/authRoutes.js';
import promptRoutes from './routes/promptRoutes.js';
import libraryRoutes from './routes/libraryRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import previewRoutes from './routes/previewRoutes.js';

// Middleware for checking auth
import checkAuth from './middleware/authMiddleware.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-monitoring', {})
  .then(() => console.log('Connected to MongoDB!'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// Routes
app.use('/auth', authRoutes);
app.use('/prompts', promptRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/og-preview', previewRoutes);

// GET /api/admin-data
app.get('/api/admin-data', checkAuth, async (req, res) => {
  try {
    const userEmail = req.admin.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'JWT does not contain an email field.' });
    }
    const adminDoc = await Admin.findOne({ email: userEmail }).lean();
    if (!adminDoc) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json(adminDoc);
  } catch (err) {
    console.error('Error fetching admin data:', err);
    res.status(500).json({ error: 'Server error fetching admin data' });
  }
});

// PATCH /api/admin-data/update-reseller
app.patch('/api/admin-data/update-reseller', checkAuth, async (req, res) => {
  const { resellerId, resellerUrl, competitorDomain, status, location } = req.body;

  if (!competitorDomain || (!resellerId && !resellerUrl)) {
    return res.status(400).json({
      error: 'competitorDomain and either resellerId or resellerUrl are required fields.'
    });
  }

  try {
    const userEmail = req.admin.email;
    const adminDoc = await Admin.findOne({ email: userEmail });
    if (!adminDoc) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const competitor = adminDoc.competitorResults.find(
      (c) => c.domain === competitorDomain
    );
    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found for given domain' });
    }

    const resellersPrompt = competitor.prompts.find(
      (p) => p.promptName === 'Top_Resellers'
    );
    if (!resellersPrompt || !resellersPrompt.result) {
      return res.status(404).json({ error: `Top_Resellers prompt not found for domain ${competitorDomain}` });
    }

    const resellersArr = resellersPrompt.result.resellers;
    if (!resellersArr) {
      return res.status(404).json({ error: 'No resellers array found' });
    }

    let reseller;
    if (resellerId && !String(resellerId).startsWith('temp-')) {
      reseller = resellersArr.find((r) => String(r._id) === String(resellerId));
    }
    if (!reseller && resellerUrl) {
      reseller = resellersArr.find((r) => r.reseller_url === resellerUrl);
    }
    if (!reseller) {
      return res.status(404).json({ error: 'Reseller not found' });
    }

    // Always update the status field: if provided, set to that; if missing, default to 'new'
    if (typeof status !== 'undefined') {
      reseller.status = status;
    } else if (!reseller.status) {
      reseller.status = 'new';
    }
    if (location !== undefined) {
      reseller.location = location;
    }

    // Mark the field as modified so Mongoose saves changes
    adminDoc.markModified('competitorResults');
    await adminDoc.save();
    return res.json({ success: true, message: 'Reseller updated successfully' });
  } catch (error) {
    console.error('Error updating reseller:', error);
    res.status(500).json({ error: 'Server error updating reseller' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// (The PLAYWRIGHT + LANGCHAIN logic remains unchanged)
