import mongoose, { Schema, type InferSchemaType } from "mongoose";

const budgetSchema = new Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["PKR", "CLP"], default: "PKR" },
  },
  { timestamps: true }
);

budgetSchema.index({ month: 1, year: 1 }, { unique: true });

export type IBudget = InferSchemaType<typeof budgetSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Budget =
  mongoose.models.Budget ?? mongoose.model("Budget", budgetSchema, "budgets");
