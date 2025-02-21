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
import Admin from './models/Admin.js'; // <-- competitorResults is now an array of arrays
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




// ---------------------------------------------------------------------
// PATCH to Update Notification Email in the logged-in Admin document
// ---------------------------------------------------------------------
app.patch('/api/admin-data/notification-email', checkAuth, async (req, res) => {
  try {
    const { email: updatedEmail } = req.body;
    if (!updatedEmail) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // The JWT (decoded by checkAuth) has 'admin.email'
    const userEmail = req.admin.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'JWT does not contain an email field.' });
    }

    // Find the Admin doc by their unique email
    const adminDoc = await Admin.findOne({ email: userEmail });
    if (!adminDoc) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Update the notificationEmail field
    adminDoc.notificationEmail = updatedEmail;
    await adminDoc.save();

    return res.json({
      message: 'Notification email updated successfully',
      notificationEmail: adminDoc.notificationEmail,
    });
  } catch (error) {
    console.error('Error updating notification email:', error);
    return res.status(500).json({ error: 'Server error updating notification email' });
  }
});


/**
 * GET /api/admin-data
 *
 * Returns the admin document. We reverse the "competitorResults" outer array
 * so that the newest run is first. (If you want them oldest-first, remove .reverse()).
 */
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

    // If competitorResults is an array of arrays, reversing it
    // will make the last batch appear first.
    if (Array.isArray(adminDoc.competitorResults) && adminDoc.competitorResults.length > 1) {
      adminDoc.competitorResults = adminDoc.competitorResults.slice().reverse();
    }

    res.json(adminDoc);
  } catch (err) {
    console.error('Error fetching admin data:', err);
    res.status(500).json({ error: 'Server error fetching admin data' });
  }
});

/**
 * GET /api/admin-data-latest
 *
 * Returns only the *most recent* batch of competitor results
 * from competitorResults.
 */
app.get('/api/admin-data-latest', checkAuth, async (req, res) => {
  try {
    const userEmail = req.admin.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'JWT does not contain an email field.' });
    }
    const adminDoc = await Admin.findOne({ email: userEmail }).lean();
    if (!adminDoc) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // competitorResults is an array of arrays; newest batch is at the final index
    if (adminDoc.competitorResults && adminDoc.competitorResults.length > 0) {
      const lastIndex = adminDoc.competitorResults.length - 1;
      const latestBatch = adminDoc.competitorResults[lastIndex];
      // Replace competitorResults with just that last batch
      adminDoc.competitorResults = [latestBatch];
    }

    res.json(adminDoc);
  } catch (err) {
    console.error('Error fetching admin data:', err);
    res.status(500).json({ error: 'Server error fetching admin data' });
  }
});

/**
 * PATCH /api/admin-data/update-reseller
 *
 * Updates the status/location for a specific reseller in the most recent
 * batch for the given competitorDomain.
 */
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

    // Ensure there's at least one batch
    const competitorBatches = adminDoc.competitorResults;
    if (!Array.isArray(competitorBatches) || competitorBatches.length === 0) {
      return res.status(404).json({ error: 'No competitor results found yet.' });
    }

    // Use the most recent batch: the last index
    const lastBatchIndex = competitorBatches.length - 1;
    const lastBatch = competitorBatches[lastBatchIndex]; // array of competitor subdocs

    // Find competitor subdoc by domain
    const competitorIndex = lastBatch.findIndex((c) => c.domain === competitorDomain);
    if (competitorIndex === -1) {
      return res.status(404).json({ error: 'Competitor not found in the most recent batch' });
    }
    const competitor = lastBatch[competitorIndex];

    // Find the 'Top_Resellers' prompt
    const resellersPrompt = competitor.prompts.find(
      (p) => p.promptName === 'Top_Resellers'
    );
    if (!resellersPrompt || !resellersPrompt.result) {
      return res.status(404).json({
        error: `Top_Resellers prompt not found for domain ${competitorDomain}`
      });
    }

    const resellersArr = resellersPrompt.result.resellers;
    if (!Array.isArray(resellersArr)) {
      return res.status(404).json({ error: 'No resellers array found' });
    }

    // Locate the reseller
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

    // Update status
    if (typeof status !== 'undefined') {
      reseller.status = status;
    } else if (!reseller.status) {
      reseller.status = 'new';
    }

    // Update location
    if (location !== undefined) {
      reseller.location = location;
    }

    // Mark & save
    adminDoc.markModified('competitorResults');
    await adminDoc.save();

    return res.json({ success: true, message: 'Reseller updated successfully' });
  } catch (error) {
    console.error('Error updating reseller:', error);
    res.status(500).json({ error: 'Server error updating reseller' });
  }
});

/**
 * PATCH /api/admin-data/update-webmention
 *
 * Updates or adds a web mention in the most recent batch for the given competitorDomain.
 */
app.patch('/api/admin-data/update-webmention', checkAuth, async (req, res) => {
  const { competitorDomain, sourceUrl, status, country_code } = req.body;

  if (!competitorDomain || !sourceUrl) {
    return res
      .status(400)
      .json({ error: 'competitorDomain and sourceUrl are required fields.' });
  }

  try {
    const userEmail = req.admin.email;
    const adminDoc = await Admin.findOne({ email: userEmail });
    if (!adminDoc) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Use the most recent batch
    const competitorBatches = adminDoc.competitorResults;
    if (!Array.isArray(competitorBatches) || competitorBatches.length === 0) {
      return res.status(404).json({ error: 'No competitor results found yet.' });
    }
    const lastBatch = competitorBatches[competitorBatches.length - 1];

    // Find competitor by domain in that batch
    const competitorIndex = lastBatch.findIndex((c) => c.domain === competitorDomain);
    if (competitorIndex === -1) {
      return res.status(404).json({ error: 'Competitor not found in most recent batch' });
    }
    const competitor = lastBatch[competitorIndex];

    // Get the 'Top_Web_Menthions' prompt
    const webMentionsPrompt = competitor.prompts.find(
      (p) => p.promptName === 'Top_Web_Menthions'
    );
    if (!webMentionsPrompt) {
      return res
        .status(404)
        .json({ error: 'Top_Web_Menthions prompt not found for the competitor' });
    }

    // Ensure result object and web_mentions array exist
    if (!webMentionsPrompt.result) {
      webMentionsPrompt.result = {};
    }
    if (!Array.isArray(webMentionsPrompt.result.web_mentions)) {
      webMentionsPrompt.result.web_mentions = [];
    }

    const webMentionsArr = webMentionsPrompt.result.web_mentions;
    let webMention = webMentionsArr.find((w) => w.source_url === sourceUrl);

    // If not found, create a new one
    if (!webMention) {
      webMention = {
        source_url: sourceUrl,
        mention_date: new Date().toISOString(),
        mention_type: '',
        country_code: country_code || '',
        summary: '',
        status: status || 'unread',
      };
      webMentionsArr.push(webMention);
    } else {
      // Otherwise, update fields if provided
      if (typeof status !== 'undefined') {
        webMention.status = status;
      } else if (!webMention.status) {
        webMention.status = 'unread';
      }
      if (typeof country_code !== 'undefined') {
        webMention.country_code = country_code;
      }
    }

    adminDoc.markModified('competitorResults');
    await adminDoc.save();

    return res.json({ success: true, message: 'Web mention updated successfully' });
  } catch (error) {
    console.error('Error updating web mention:', error);
    res.status(500).json({ error: 'Server error updating web mention' });
  }
});

/**
 * GET /api/admin-data/new-web-mentions
 *
 * Fetches only the "new" web mentions for a given domain: i.e., those present
 * in the most recent batch but not in older batches. Matching is by `source_url`.
 */
app.get('/api/admin-data/new-web-mentions', checkAuth, async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) {
      return res
        .status(400)
        .json({ error: 'Missing "domain" query parameter.' });
    }

    const userEmail = req.admin.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'JWT does not contain an email field.' });
    }

    const adminDoc = await Admin.findOne({ email: userEmail });
    if (!adminDoc) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Flatten all competitor subdocs across all runs, but we still need to group them by run
    const allBatches = adminDoc.competitorResults; // array of arrays
    if (!allBatches.length) {
      return res.status(404).json({ error: 'No competitor results found at all.' });
    }

    // Gather all subdocs for the given domain across all runs
    // For each run in allBatches, find that domain's competitor subdoc
    const domainEntries = allBatches
      .map((batch) => batch.find((c) => c.domain === domain))
      .filter(Boolean);

    if (!domainEntries.length) {
      return res
        .status(404)
        .json({ error: 'No competitor results found for that domain.' });
    }

    // The newest competitor subdoc is in the last item of domainEntries
    // domainEntries are in order of how we pushed them. So the last item is newest
    const newestEntry = domainEntries[domainEntries.length - 1];
    const olderEntries = domainEntries.slice(0, domainEntries.length - 1);

    // Grab the newest Web Mentions
    const newestPrompt = newestEntry.prompts.find(
      (p) => p.promptName === 'Top_Web_Menthions'
    );
    const newestMentions = newestPrompt?.result?.web_mentions || [];

    // Gather all web mention URLs from older entries
    const olderURLs = new Set();
    olderEntries.forEach((entry) => {
      const olderPrompt = entry.prompts.find((p) => p.promptName === 'Top_Web_Menthions');
      const olderMentions = olderPrompt?.result?.web_mentions || [];
      olderMentions.forEach((m) => {
        olderURLs.add(m.source_url);
      });
    });

    // Filter the newest mentions for those not in olderURLs
    const newMentions = newestMentions.filter(
      (mention) => !olderURLs.has(mention.source_url)
    );

    return res.json({
      domain,
      newMentions,
    });
  } catch (error) {
    console.error('Error fetching new web mentions:', error);
    res.status(500).json({ error: 'Server error fetching new web mentions' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// (All other logic for Playwright, LangChain, or CLI usage remains the same)
