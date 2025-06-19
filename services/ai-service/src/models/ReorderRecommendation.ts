import mongoose, { Schema, Document } from "mongoose";

export interface IReorderRecommendation extends Document {
  warehouseId: number;
  productId: number;
  productSku: string;
  productName: string;

  // Simple recommendation
  currentReorderPoint: number;
  recommendedReorderPoint: number;
  confidence: number; // 0-1

  // Basic metrics
  avgDailyDemand: number;
  demandVariability: number;
  leadTime: number;

  // Analysis period
  analyzedFrom: Date;
  analyzedTo: Date;
  orderCount: number;

  createdAt: Date;
}

const ReorderRecommendationSchema = new Schema<IReorderRecommendation>(
  {
    warehouseId: { type: Number, required: true, index: true },
    productId: { type: Number, required: true, index: true },
    productSku: { type: String, required: true },
    productName: { type: String, required: true },

    currentReorderPoint: { type: Number, required: true },
    recommendedReorderPoint: { type: Number, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },

    avgDailyDemand: { type: Number, required: true },
    demandVariability: { type: Number, required: true },
    leadTime: { type: Number, required: true },

    analyzedFrom: { type: Date, required: true },
    analyzedTo: { type: Date, required: true },
    orderCount: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

ReorderRecommendationSchema.index({ warehouseId: 1, productId: 1 });
ReorderRecommendationSchema.index({ createdAt: -1 });

export const ReorderRecommendation = mongoose.model<IReorderRecommendation>(
  "ReorderRecommendation",
  ReorderRecommendationSchema
);
