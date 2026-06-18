import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "EMPLOYEE"], default: "EMPLOYEE" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type IUser = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema, "users");
