import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  event: String,
  data: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
  userId: String,
});

export const Analytics = mongoose.model("Analytics", analyticsSchema);
