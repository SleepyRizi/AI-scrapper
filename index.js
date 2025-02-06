
/************************************************************************
 * index.js
 ************************************************************************/
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import { chromium } from 'playwright';
import prompt from 'prompt';
// eslint-disable-next-line no-unused-vars
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
// Import the library routes
import libraryRoutes from './routes/libraryRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import previewRoutes from './routes/previewRoutes.js';
import checkAuth from './middleware/authMiddleware.js'; // your existing middleware





// =====================================================================
//  EXPRESS SERVER & MONGOOSE SETUP
// =====================================================================
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
app.use('/auth', authRoutes);       // Existing auth routes
app.use('/prompts', promptRoutes);  // Existing prompt routes
app.use('/api/library', libraryRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/og-preview', previewRoutes);



// NEW: Admin data endpoint (unprotected example)
app.get('/api/admin-data', checkAuth, async (req, res) => {
  try {
    // In a real app, find by ID or from JWT data. For demo, assume a single "admin@gmail.com"

    // The JWT payload is attached to req.admin by your middleware
    const userEmail = req.admin.email; 
    if (!userEmail) {
      return res.status(400).json({ error: 'JWT does not contain an email field.' });
    }
    const adminDoc = await Admin.findOne({ email: userEmail }).lean();
    if (!adminDoc) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    // Return the entire Admin document
    res.json(adminDoc);
  } catch (err) {
    console.error('Error fetching admin data:', err);
    res.status(500).json({ error: 'Server error fetching admin data' });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// =====================================================================
//  PLAYWRIGHT + LANGCHAIN LOGIC
// =====================================================================
async function main(options) {
  // ... your existing logic for main, if used ...
}

// =====================================================================
//  COMMAND LINE OPTIONS & PROGRAM EXECUTION
// =====================================================================
const program = new Command();

program
  .option('-a, --autogpt', 'run with autogpt', false)
  .option('-m, --model <model>', 'openai model to use', 'gpt-4-1106-preview')
  .option('-o, --outputFilePath <outputFilePath>', 'path to store test code')
  .option('-u, --url <url>', 'url to start on', 'https://www.google.com')
  .option('-v, --viewport <viewport>', 'viewport size to use', '1280,720')
  .option('-h, --headless', 'run in headless mode', false);

program.parse();

main(program.opts()).catch((err) => {
  console.error('Error in main:', err);
});
