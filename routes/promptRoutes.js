import express from 'express';
import axios from 'axios';
import { chromium } from 'playwright';
import { ChatOpenAI } from 'langchain/chat_models/openai';

// Existing models
import Prompt from '../models/Prompt.js';
import Admin from '../models/Admin.js';
import Competitor from '../models/Competitor.js';

// NEW models
import Library from '../models/Library.js';
import Activity from '../models/Activity.js';

// Your AutoGPT action function
import { doActionWithAutoGPT } from '../autogpt/index.js';
// Utility for logging screenshots
import { logPageScreenshot } from '../util/index.js';

const router = express.Router();

// Helper function to log activity
async function logActivity(userEmail, message, status = 'Success') {
  try {
    await Activity.create({
      userEmail,
      message: `[${new Date().toISOString()}] ${message}`,
      status,
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

router.get('/run', async (req, res) => {
  try {
    // 0) Grab email, title & description from query
    const { email, title, description } = req.query;

    if (!email || !title || !description) {
      return res.status(400).json({
        message:
          'Missing required fields. "email", "title", and "description" are required in query params.',
      });
    }

    // 0.1) Store in the "Library" collection with userEmail
    await Library.create({ userEmail: email, title, description });
    await logActivity(email, `Received new task. Title: ${title}, Description: ${description}`);

    // 1) Launch browser
    await logActivity(email, 'Launching browser...');
    const userDataDir = 'userdata';
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 1280, height: 720 },
    });
    await logActivity(email, 'Browser launched.', 'Success');

    // 2) Create page & Chat instance
    const page = await browserContext.newPage();
    const chatApi = new ChatOpenAI({ temperature: 0.1, modelName: 'gpt-4o' });
    await logActivity(email, 'Page & ChatAI instance created.', 'Success');

    // 3) Fetch competitor domains
    const competitorDoc = await Competitor.findOne({});
    if (!competitorDoc || !competitorDoc.list.length) {
      await browserContext.close();
      await logActivity(email, 'No competitor domains found in DB.', 'Success');
      return res.status(200).json({ message: 'No competitor domains found in DB.' });
    }
    await logActivity(email, `Fetched competitor domains: ${competitorDoc.list.join(', ')}`, 'Success');

    // 4) Fetch prompts
    const prompts = await Prompt.find({});
    if (!prompts.length) {
      await browserContext.close();
      await logActivity(email, 'No Task is found in DB.', 'Success');
      return res.status(200).json({ message: 'No Task is found in DB.' });
    }
    await logActivity(email, `Fetched ${prompts.length} Task from DB.`, 'Success');

    // 5) Fetch Admin user by email
    const adminUser = await Admin.findOne({ email });
    if (!adminUser) {
      await browserContext.close();
      await logActivity(email, `No Admin user found with that email: ${email}`, 'Failed');
      return res.status(200).json({ message: 'No Admin user found.' });
    }
    await logActivity(email, `Fetched Admin user: ${email}`, 'Success');

    // 6) Loop over each competitor domain
    for (const competitorDomain of competitorDoc.list) {
      await logActivity(email, `\nProcessing competitor: ${competitorDomain}`, 'Success');

      // (A) Fetch SimilarWeb data
      const similarWebUrl = `https://data.similarweb.com/api/v1/data?domain=${competitorDomain}`;
      let data = null;
      try {
        await logActivity(email, `Fetching data for: ${competitorDomain} ...`);
        const resp = await axios.get(similarWebUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
              '(KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
          },
        });
        data = resp.data;
        await logActivity(email, `Data fetched for: ${competitorDomain}`);
      } catch (err) {
        await logActivity(
          email,
          `Error fetching data for ${competitorDomain}: ${err.message}`,
          'Failed'
        );
        // If we want to continue loop despite error, just log; otherwise you can break/return.
      }

      // (B) Build competitorEntry
      const competitorEntry = {
        domain: competitorDomain,
        similarWebData: {},
        topCountries: [],
        prompts: [],
      };

      if (data) {
        const {
          Version,
          SiteName,
          Description,
          Title,
          Engagments,
          EstimatedMonthlyVisits,
          GlobalRank,
          CountryRank,
          CategoryRank,
          GlobalCategoryRank,
          IsSmall,
          Policy,
          TrafficSources,
          Category,
          LargeScreenshot,
          IsDataFromGa,
          Competitors,
          Notification,
          TopKeywords,
          SnapshotDate,
          TopCountryShares,
          Countries,
        } = data;

        // store the main fields
        competitorEntry.similarWebData = {
          version: Version,
          siteName: SiteName,
          description: Description,
          title: Title,
          engagements: Engagments,
          estimatedMonthlyVisits: EstimatedMonthlyVisits,
          globalRank: GlobalRank,
          countryRank: CountryRank,
          categoryRank: CategoryRank,
          globalCategoryRank: GlobalCategoryRank,
          isSmall: IsSmall,
          policy: Policy,
          trafficSources: TrafficSources,
          category: Category,
          largeScreenshot: LargeScreenshot,
          isDataFromGa: IsDataFromGa,
          competitorsInfo: Competitors,
          notification: Notification,
          topKeywords: TopKeywords,
          snapshotDate: SnapshotDate,
        };

        // map the TopCountryShares to get code + name
        if (Array.isArray(TopCountryShares) && Array.isArray(Countries)) {
          competitorEntry.topCountries = TopCountryShares.map((shareObj) => {
            const matched = Countries.find((c) => c.Code === shareObj.CountryCode);
            return {
              countryCode: shareObj.CountryCode,
              countryName: matched ? matched.Name : 'Unknown',
              share: shareObj.Value,
            };
          });
        }
      }

      // (C) Push into adminUser and save
      adminUser.competitorResults.push(competitorEntry);
      await adminUser.save();
      await logActivity(email, `Data saved for: ${competitorDomain}`, 'Success');

      // Now let's reference the newly added competitor subdocument
      const addedIndex = adminUser.competitorResults.length - 1;
      const competitorSubDoc = adminUser.competitorResults[addedIndex];

      // (D) Run prompts
      for (const promptDoc of prompts) {
        await logActivity(email, `Executing Task: "${promptDoc.name}" for ${competitorDomain}`);
        const updatedCommand = promptDoc.command.replace('{{cream-deluxe.com}}', competitorDomain);

        let autoGPTResult = null;
        try {
          autoGPTResult = await doActionWithAutoGPT(page, chatApi, updatedCommand, {
            headless: true,
            url: 'https://www.google.com',
          });
          await logActivity(email, `AI Agent execution success for Task "${promptDoc.name}".`);
        } catch (err) {
          await logActivity(
            email,
            `AI Agent error for Task "${promptDoc.name}": ${err.message}`,
            'Failed'
          );
        }

        // Screenshot (optional)
        await logPageScreenshot(page, `${promptDoc.name}-${competitorDomain}-screenshot.png`);
        await logActivity(
          email,
          `Screenshot captured for Task "${promptDoc.name}" and domain "${competitorDomain}".`
        );

        // push prompt result into the competitor subdocument
        competitorSubDoc.prompts.push({
          promptName: promptDoc.name,
          result: autoGPTResult,
        });

        // Mark modified + save so it commits to DB each time
        adminUser.markModified('competitorResults');
        await adminUser.save();
        await logActivity(
          email,
          `Task result saved for "${promptDoc.name}" / ${competitorDomain}`,
          'Success'
        );
      }
    }

    // Close browser
    await browserContext.close();
    await logActivity(email, 'Browser closed. Task finished.', 'Success');

    // Return
    return res.status(200).json({ message: 'Finished. Data stored in MongoDB.' });
  } catch (err) {
    console.error('Error running competitor Tasks:', err);
    await logActivity(req.query.email || 'Unknown', `Unexpected error: ${err.message}`, 'Failed');
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
