import mongoose, { Schema, type InferSchemaType } from "mongoose";

const chileFuelEntrySchema = new Schema(
  {
    label: { type: String, required: true },
    clpPerLiter: { type: Number, required: true },
    usdPerLiter: { type: Number },
  },
  { _id: false }
);

const pakistanFuelEntrySchema = new Schema(
  {
    label: { type: String, required: true },
    pkrPerLiter: { type: Number, required: true },
  },
  { _id: false }
);

const fuelPriceSnapshotSchema = new Schema(
  {
    snapshotKey: { type: String, default: "latest", unique: true },
    lastUpdated: { type: String, required: true },
    source: {
      type: String,
      enum: ["n8n", "webhook", "sync"],
      default: "n8n",
    },
    chile: {
      gasoline: { type: chileFuelEntrySchema, required: true },
      diesel: { type: chileFuelEntrySchema, required: true },
      kerosene: { type: chileFuelEntrySchema, required: true },
    },
    pakistan: {
      gasoline: pakistanFuelEntrySchema,
      diesel: pakistanFuelEntrySchema,
      kerosene: pakistanFuelEntrySchema,
    },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export type IFuelPriceSnapshot = InferSchemaType<typeof fuelPriceSnapshotSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const FuelPriceSnapshot =
  mongoose.models.FuelPriceSnapshot ??
  mongoose.model("FuelPriceSnapshot", fuelPriceSnapshotSchema, "fuel_price_snapshots");
