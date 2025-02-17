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

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    competitorResults: [competitorResultSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);
