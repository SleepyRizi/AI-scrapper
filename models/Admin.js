// File: src/models/Admin.js
import mongoose from 'mongoose';

const competitorResultSchema = new mongoose.Schema({
  domain: { type: String },
  similarWebData: {
    version: Number,
    siteName: String,
    description: String,
    title: String,
    engagements: mongoose.Schema.Types.Mixed,
    estimatedMonthlyVisits: mongoose.Schema.Types.Mixed,
    globalRank: mongoose.Schema.Types.Mixed,
    countryRank: mongoose.Schema.Types.Mixed,
    categoryRank: mongoose.Schema.Types.Mixed,
    globalCategoryRank: mongoose.Schema.Types.Mixed,
    isSmall: Boolean,
    policy: Number,
    trafficSources: mongoose.Schema.Types.Mixed,
    category: String,
    largeScreenshot: String,
    isDataFromGa: Boolean,
    competitorsInfo: mongoose.Schema.Types.Mixed,
    notification: mongoose.Schema.Types.Mixed,
    topKeywords: mongoose.Schema.Types.Mixed,
    snapshotDate: String,
  },
  topCountries: [
    {
      countryCode: String,
      countryName: String,
      share: Number,
      suggestions: [String],
    },
  ],
  prompts: [
    {
      promptName: { type: String },
      result: mongoose.Schema.Types.Mixed,
    },
  ],
});

// ***** IMPORTANT: Make competitorResults an array-of-arrays of competitorResultSchema *****
const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Each time you run the /run endpoint, it will create
    // a *new array* of competitorResults and push it to this outer array.
    competitorResults: {
      type: [[competitorResultSchema]],
      default: [],
    },
    // NEW FIELD:
    notificationEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);
