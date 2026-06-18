import mongoose from "mongoose";

function getMongoUri(): string {
  const uri =
    process.env.MONGODB_URI?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }
  return uri;
}

export async function connectMongo(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  const uri = getMongoUri();
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8_000,
      connectTimeoutMS: 8_000,
      socketTimeoutMS: 15_000,
      maxPoolSize: 5,
    });
    console.log("[mongo] Connected to MongoDB");
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "ECONNREFUSED" && uri.includes("mongodb+srv://")) {
      console.error(
        "[mongo] DNS SRV lookup failed (common on Windows). " +
          "In backend/.env use mongodb:// instead of mongodb+srv:// — see Atlas 'Standard connection string'."
      );
    }
    throw error;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
