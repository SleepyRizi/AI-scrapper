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
    // NEW FIELD: Name
    name: { type: String, required: false },  // You can set required: true if you want it mandatory

    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    competitorResults: {
      type: [[competitorResultSchema]],
      default: [],
    },
    notificationEmail: { type: String, default: '' },

    // For "forgot password" OTP storage
    resetOTP: { type: String, default: '' },
    resetOTPExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);