import mongoose, { Schema, type InferSchemaType } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    color: { type: String, default: "#6366f1" },
    description: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type ICategory = InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Category =
  mongoose.models.Category ?? mongoose.model("Category", categorySchema, "categories");
