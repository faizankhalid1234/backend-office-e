import { Router } from "express";
import { startOfMonth, endOfMonth } from "date-fns";
import { Budget } from "../models/Budget.js";
import type { IBudget } from "../models/Budget.js";
import { budgetSchema } from "../lib/validations.js";
import { decimalToNumber, expenseAmountInPKR } from "../lib/utils-format.js";
import { requireAuth, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { getCompanyExpensesTotalForRange } from "../lib/expense-service.js";

export const budgetRouter = Router();

budgetRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const budget = await Budget.findOne({ month, year }).lean<IBudget | null>();

  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const used = await getCompanyExpensesTotalForRange(start, end);

  const budgetAmount = budget
    ? expenseAmountInPKR(decimalToNumber(budget.amount), budget.currency)
    : 0;

  res.json({
    budget: budget
      ? {
          id: String(budget._id),
          month: budget.month,
          year: budget.year,
          amount: decimalToNumber(budget.amount),
          currency: budget.currency,
          createdAt: budget.createdAt,
          updatedAt: budget.updatedAt,
        }
      : null,
    used,
    remaining: Math.max(0, budgetAmount - used),
    percentage: budgetAmount > 0 ? (used / budgetAmount) * 100 : 0,
    month,
    year,
  });
});

budgetRouter.get("/history", requireAuth, async (_req, res) => {
  const budgets = await Budget.find()
    .sort({ year: -1, month: -1 })
    .limit(12)
    .lean<IBudget[]>();

  res.json(
    budgets.map((b) => ({
      id: String(b._id),
      month: b.month,
      year: b.year,
      amount: decimalToNumber(b.amount),
      currency: b.currency,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }))
  );
});

budgetRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const budget = await Budget.findOneAndUpdate(
    { month: parsed.data.month, year: parsed.data.year },
    {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      month: parsed.data.month,
      year: parsed.data.year,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean<IBudget | null>();

  if (!budget) {
    res.status(500).json({ error: "Failed to save budget" });
    return;
  }

  res.json({
    id: String(budget._id),
    month: budget.month,
    year: budget.year,
    amount: decimalToNumber(budget.amount),
    currency: budget.currency,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  });
});

