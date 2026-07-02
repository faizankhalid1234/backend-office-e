import express from "express";
import cors from "cors";
import path from "path";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { categoriesRouter } from "./routes/categories.js";
import { expensesRouter } from "./routes/expenses.js";
import { budgetRouter } from "./routes/budget.js";
import {
  dashboardRouter,
  reportsRouter,
  adminRouter,
} from "./routes/dashboard.js";
import { uploadRouter } from "./routes/upload.js";
import { fuelPricesRouter } from "./routes/fuel-prices.js";

export function createApp() {
  const app = express();

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const adminUrl = process.env.ADMIN_URL ?? "http://localhost:4000";

  const allowedOrigins = new Set([
    frontendUrl,
    adminUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
  ]);

  for (const extra of (process.env.CORS_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) allowedOrigins.add(trimmed);
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        if (/^https:\/\/office-website[a-z0-9-]*\.vercel\.app$/i.test(origin)) {
          callback(null, true);
          return;
        }
        if (/^https:\/\/admin-office[a-z0-9-]*\.vercel\.app$/i.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));

  app.use(
    "/uploads/receipts",
    express.static(path.join(process.cwd(), "src", "uploads", "receipts"))
  );

  app.get("/", (_req, res) => {
    res.json({
      service: "H.H Husain Office Expense — Backend API",
      status: "running",
      message: "API only — open the employee website or admin panel in your browser.",
      frontend: frontendUrl,
      admin: adminUrl,
      adminLogin: `${adminUrl}/login`,
      health: "/api/health",
      info: "/api/info",
    });
  });

  app.get("/api/info", (_req, res) => {
    res.json({
      service: "H.H Husain Office Expense — Backend API",
      status: "running",
      message: "This is the API server only. Open the website in your browser.",
      frontend: frontendUrl,
      admin: adminUrl,
      adminLogin: `${adminUrl}/login`,
      health: "/api/health",
      docs: {
        auth: "POST /api/auth/login, POST /api/auth/register",
        users: "GET/POST /api/users (admin)",
        expenses: "GET/POST /api/expenses",
        categories: "GET /api/categories",
        budget: "GET/POST /api/budget",
        dashboard: "GET /api/dashboard/stats",
        reports: "GET /api/reports?month=&year=",
        fuelPrices: "GET /api/fuel-prices, POST /api/fuel-prices/webhook, POST /api/fuel-prices/sync",
      },
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "office-expense-backend" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/budget", budgetRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/fuel-prices", fuelPricesRouter);

  return app;
}
