import { Router } from "express";
import { Category } from "../models/Category.js";
import type { ICategory } from "../models/Category.js";
import { Expense } from "../models/Expense.js";
import { categorySchema } from "../lib/validations.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

function formatCategory(cat: Record<string, unknown>, expenseCount?: number) {
  return {
    id: String(cat._id),
    name: cat.name,
    color: cat.color,
    description: cat.description,
    isDefault: cat.isDefault,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
    _count: { expenses: expenseCount ?? 0 },
  };
}

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean<ICategory[]>();
  const counts = await Expense.aggregate([
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count as number]));

  res.json(
    categories.map((c) => formatCategory(c as Record<string, unknown>, countMap.get(String(c._id)) ?? 0))
  );
});

categoriesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const category = await Category.create({
      name: parsed.data.name,
      color: parsed.data.color ?? "#0d9488",
      description: parsed.data.description,
    });
    res.status(201).json(formatCategory(category.toObject() as Record<string, unknown>, 0));
  } catch {
    res.status(400).json({ error: "Category already exists or failed" });
  }
});

categoriesRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const category = await Category.findByIdAndUpdate(
      String(req.params.id),
      {
        name: parsed.data.name,
        color: parsed.data.color,
        description: parsed.data.description,
      },
      { new: true }
    ).lean<ICategory | null>();

    if (!category) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const count = await Expense.countDocuments({ categoryId: category._id });
    res.json(formatCategory(category as Record<string, unknown>, count));
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
});

categoriesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const expenseCount = await Expense.countDocuments({ categoryId: id });
  if (expenseCount > 0) {
    res.status(400).json({ error: "Cannot delete category with existing expenses" });
    return;
  }

  await Category.findByIdAndDelete(id);
  res.json({ success: true });
});
