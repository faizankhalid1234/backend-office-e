import { Router } from "express";
import {
  getExpenseStats,
  getMonthlyReport,
  getTrendData,
  getCurrentBudget,
} from "../lib/expense-service.js";
import { decimalToNumber } from "../lib/utils-format.js";
import type { IBudget } from "../models/Budget.js";
import { User } from "../models/User.js";
import { Expense } from "../models/Expense.js";
import { requireAuth, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { formatExpense } from "../lib/format-expense.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/stats", async (req: AuthRequest, res) => {
  const stats = await getExpenseStats(req.user!.id);
  res.json(stats);
});

dashboardRouter.get("/trends", async (req: AuthRequest, res) => {
  const trends = await getTrendData(req.user!.id);
  res.json(trends);
});

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get("/", async (req: AuthRequest, res) => {
  const now = new Date();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const year = Number(req.query.year) || now.getFullYear();
  const report = await getMonthlyReport(req.user!.id, month, year);
  res.json(report);
});

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get("/overview", async (req: AuthRequest, res) => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [userCount, adminCount, expenseCount] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "ADMIN" }),
    Expense.countDocuments(),
  ]);

  res.json({
    userCount,
    adminCount,
    employeeCount: userCount - adminCount,
    expenseCount,
  });
});

adminRouter.get("/budget-current", async (_req, res) => {
  const budget: IBudget | null = await getCurrentBudget();
  res.json(
    budget
      ? {
          id: String(budget._id),
          month: budget.month,
          year: budget.year,
          amount: decimalToNumber(budget.amount),
          currency: budget.currency,
          createdAt: budget.createdAt,
          updatedAt: budget.updatedAt,
        }
      : null
  );
});

adminRouter.get("/expenses", requireAdmin, async (req: AuthRequest, res) => {
  const userId = req.query.userId as string | undefined;
  const categoryId = req.query.categoryId as string | undefined;
  const search = req.query.search as string | undefined;

  const filter: Record<string, unknown> = {};
  if (userId) filter.userId = userId;
  if (categoryId) filter.categoryId = categoryId;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const expenses = await Expense.find(filter)
    .populate("categoryId")
    .populate("userId", "name email role")
    .sort({ date: -1, createdAt: -1 })
    .limit(1000)
    .lean();

  res.json(expenses.map((e) => formatExpense(e as Record<string, unknown>)));
});
