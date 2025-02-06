import mongoose from 'mongoose';

const promptSchema = new mongoose.Schema({
  // e.g., "prompt1", "prompt2", etc.
  name: { type: String, required: true, unique: true },
  // The command string for AutoGPT
  command: { type: String, required: true },
  // Store the JSON result or any other data here
  result: { type: mongoose.Schema.Types.Mixed, default: null },
});

export default mongoose.model('Prompt', promptSchema);
