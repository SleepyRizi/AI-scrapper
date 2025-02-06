import mongoose from 'mongoose';

const librarySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  userEmail: String, // <= add this field

});

export default mongoose.model('Library', librarySchema);
