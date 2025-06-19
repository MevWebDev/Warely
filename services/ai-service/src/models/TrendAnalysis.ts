import mongoose, { Schema, Document } from "mongoose";

export interface ITrendAnalysis extends Document {
  warehouseId: number;
  type: "product" | "category";
  itemId: number; // productId or categoryId
  itemName: string;

  // Trend data
  trend: "increasing" | "decreasing" | "stable";
  trendStrength: number; // 0-1 (how strong the trend is)
  changePercent: number; // % change over period

  // Period data
  analyzedFrom: Date;
  analyzedTo: Date;
  currentPeriodSales: number;
  previousPeriodSales: number;

  createdAt: Date;
}

const TrendAnalysisSchema = new Schema<ITrendAnalysis>(
  {
    warehouseId: { type: Number, required: true, index: true },
    type: { type: String, enum: ["product", "category"], required: true },
    itemId: { type: Number, required: true },
    itemName: { type: String, required: true },

    trend: {
      type: String,
      enum: ["increasing", "decreasing", "stable"],
      required: true,
    },
    trendStrength: { type: Number, required: true, min: 0, max: 1 },
    changePercent: { type: Number, required: true },

    analyzedFrom: { type: Date, required: true },
    analyzedTo: { type: Date, required: true },
    currentPeriodSales: { type: Number, required: true },
    previousPeriodSales: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

TrendAnalysisSchema.index({ warehouseId: 1, type: 1 });
TrendAnalysisSchema.index({ trend: 1, trendStrength: -1 });

export const TrendAnalysis = mongoose.model<ITrendAnalysis>(
  "TrendAnalysis",
  TrendAnalysisSchema
);
