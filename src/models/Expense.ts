import mongoose, { Schema, type InferSchemaType } from "mongoose";

const expenseSchema = new Schema(
  {
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD", "CLP"], default: "USD" },
    date: { type: Date, required: true },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "EASYPAISA", "JAZZCASH", "CARD"],
      required: true,
    },
    description: { type: String },
    receiptUrl: { type: String },
    receiptName: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });

export type IExpense = InferSchemaType<typeof expenseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Expense =
  mongoose.models.Expense ?? mongoose.model("Expense", expenseSchema, "expenses");
