import type { VercelRequest, VercelResponse } from "@vercel/node";
import serverless from "serverless-http";
import { connectMongo } from "../src/lib/mongo.js";
import { createApp } from "../src/express-app.js";

let appHandler: ReturnType<typeof serverless> | null = null;

function requestPath(url: string | undefined): string {
  return (url ?? "/").split("?")[0];
}

function handlePublicRoute(path: string, res: VercelResponse): boolean {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const adminUrl = process.env.ADMIN_URL ?? "http://localhost:4000";

  if (path === "/api/health") {
    res.status(200).json({ status: "ok", service: "office-expense-backend" });
    return true;
  }

  if (path === "/api/info") {
    res.status(200).json({
      service: "H.H Husain Office Expense — Backend API",
      status: "running",
      frontend: frontendUrl,
      admin: adminUrl,
      health: "/api/health",
    });
    return true;
  }

  if (path === "/") {
    res.status(200).json({
      service: "H.H Husain Office Expense — Backend API",
      status: "running",
      health: "/api/health",
    });
    return true;
  }

  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = requestPath(req.url);

  if (handlePublicRoute(path, res)) {
    return;
  }

  try {
    await connectMongo();

    if (!appHandler) {
      appHandler = serverless(createApp());
    }

    return appHandler(req, res);
  } catch (error) {
    console.error("[api] Handler error:", error);
    const message =
      error instanceof Error && error.message.includes("MONGODB_URI")
        ? "Database is not configured"
        : "Internal server error";
    res.status(500).json({ error: message });
  }
}

export const config = {
  maxDuration: 30,
};
