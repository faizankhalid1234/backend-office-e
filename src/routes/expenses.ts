import { Router } from "express";
import { Expense } from "../models/Expense.js";
import { expenseSchema } from "../lib/validations.js";
import { formatExpense } from "../lib/format-expense.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

expensesRouter.get("/", async (req: AuthRequest, res) => {
  const categoryId = req.query.categoryId as string | undefined;
  const search = req.query.search as string | undefined;

  const filter: Record<string, unknown> = { userId: req.user!.id };
  if (categoryId) filter.categoryId = categoryId;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const expenses = await Expense.find(filter)
    .populate("categoryId")
    .populate("userId", "name")
    .sort({ date: -1 })
    .lean();

  res.json(expenses.map((e) => formatExpense(e as Record<string, unknown>)));
});

expensesRouter.post("/", async (req: AuthRequest, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const expense = await Expense.create({
      title: parsed.data.title,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      date: new Date(parsed.data.date),
      paymentMethod: parsed.data.paymentMethod,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId,
      userId: req.user!.id,
      receiptUrl: req.body.receiptUrl,
      receiptName: req.body.receiptName,
    });

    const populated = await Expense.findById(expense._id)
      .populate("categoryId")
      .lean();

    res.status(201).json(formatExpense(populated as Record<string, unknown>));
  } catch {
    res.status(500).json({ error: "Failed to create expense" });
  }
});

expensesRouter.get("/:id", async (req: AuthRequest, res) => {
  const expense = await Expense.findOne({
    _id: String(req.params.id),
    userId: req.user!.id,
  })
    .populate("categoryId")
    .lean();

  if (!expense) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(formatExpense(expense as Record<string, unknown>));
});

expensesRouter.put("/:id", async (req: AuthRequest, res) => {
  const existing = await Expense.findOne({
    _id: String(req.params.id),
    userId: req.user!.id,
  });

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  existing.title = parsed.data.title;
  existing.amount = parsed.data.amount;
  existing.currency = parsed.data.currency;
  existing.date = new Date(parsed.data.date);
  existing.paymentMethod = parsed.data.paymentMethod;
  existing.description = parsed.data.description ?? undefined;
  existing.categoryId = parsed.data.categoryId as unknown as typeof existing.categoryId;
  existing.receiptUrl = req.body.receiptUrl ?? existing.receiptUrl;
  existing.receiptName = req.body.receiptName ?? existing.receiptName;
  await existing.save();

  const populated = await Expense.findById(existing._id).populate("categoryId").lean();
  res.json(formatExpense(populated as Record<string, unknown>));
});

expensesRouter.delete("/:id", async (req: AuthRequest, res) => {
  const existing = await Expense.findOne({
    _id: String(req.params.id),
    userId: req.user!.id,
  });

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await Expense.findByIdAndDelete(existing._id);
  res.json({ success: true });
});
