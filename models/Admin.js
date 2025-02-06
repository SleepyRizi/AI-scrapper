






/************************************************************************
 * Admin.js
 ************************************************************************/
import mongoose from 'mongoose';

// 1) Define a sub-schema for competitor results
const competitorResultSchema = new mongoose.Schema({
  domain: { type: String }, // e.g. "cream-deluxe.com"

  // (A) Fields to store SimilarWeb data
  similarWebData: {
    version: Number,
    siteName: String,
    description: String,
    title: String,
    engagements: mongoose.Schema.Types.Mixed, // or define each subfield in detail
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
    competitorsInfo: mongoose.Schema.Types.Mixed, // The "Competitors" key from SimilarWeb
    notification: mongoose.Schema.Types.Mixed,
    topKeywords: mongoose.Schema.Types.Mixed,
    snapshotDate: String,
  },

  // (B) Mapped array of top countries (with code + name + share)
  topCountries: [
    {
      countryCode: String,
      countryName: String,
      share: Number,
    },
  ],

  // (C) Prompt results
  prompts: [
    {
      promptName: { type: String },
      result: mongoose.Schema.Types.Mixed, // can store JSON or text
    },
  ],
});

// 2) Define the main Admin schema
const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    // (D) Use the competitorResultSchema as an array
    competitorResults: [competitorResultSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);

