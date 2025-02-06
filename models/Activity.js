import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String, // e.g., 'Success' or 'Failed'
    required: true,
  },
  userEmail: String, // <= add this field

});

export default mongoose.model('Activity', activitySchema);
