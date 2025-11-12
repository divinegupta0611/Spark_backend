import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
  SYMBOL: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
companySchema.index({ SYMBOL: 1 });

export default mongoose.model("Company", companySchema, "Companies");
