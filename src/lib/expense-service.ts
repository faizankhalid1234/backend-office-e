import { Expense } from "../models/Expense.js";
import { Category } from "../models/Category.js";
import type { ICategory } from "../models/Category.js";
import { Budget } from "../models/Budget.js";
import type { IBudget } from "../models/Budget.js";
import { decimalToNumber, expenseAmountInUSD } from "./utils-format.js";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  eachMonthOfInterval,
  subYears,
} from "date-fns";
import { getDateRanges } from "./utils-format.js";
import type { Types } from "mongoose";

function sumExpensesInUSD(
  expenses: Array<{ amount: number; currency: string }>
): number {
  return expenses.reduce(
    (sum, e) => sum + expenseAmountInUSD(decimalToNumber(e.amount), e.currency),
    0
  );
}

function userFilter(userId: string, extra: Record<string, unknown> = {}) {
  return { userId: userId as unknown as Types.ObjectId, ...extra };
}

async function aggregateSumUSD(userId: string, where: Record<string, unknown> = {}) {
  const expenses = await Expense.find(userFilter(userId, where))
    .select("amount currency")
    .lean<Array<{ amount: number; currency: string }>>();
  return sumExpensesInUSD(expenses);
}

export async function getCompanyExpensesTotalForRange(
  start: Date,
  end: Date
): Promise<number> {
  const expenses = await Expense.find({
    date: { $gte: start, $lte: end },
  })
    .select("amount currency")
    .lean<Array<{ amount: number; currency: string }>>();
  return sumExpensesInUSD(expenses);
}

function formatExpenseDoc(exp: Record<string, unknown>) {
  const category = exp.category as Record<string, unknown> | undefined;
  const user = exp.user as Record<string, unknown> | undefined;
  return {
    ...exp,
    id: String(exp._id ?? exp.id),
    amount: decimalToNumber(exp.amount as number),
    userId: String(exp.userId),
    categoryId: String(exp.categoryId),
    category: category
      ? { ...category, id: String(category._id ?? category.id) }
      : undefined,
    user: user ? { name: user.name } : undefined,
  };
}

export async function getExpenseStats(userId: string) {
  const ranges = getDateRanges();
  const uid = userId as unknown as Types.ObjectId;

  const [todaySum, weekSum, monthSum, yearSum, recentExpenses, monthExpenses, monthlyData, budget, lastMonthExpenses, monthCount, companyMonthTotal] =
    await Promise.all([
      aggregateSumUSD(userId, { date: { $gte: ranges.today } }),
      aggregateSumUSD(userId, { date: { $gte: ranges.week } }),
      aggregateSumUSD(userId, { date: { $gte: ranges.month } }),
      aggregateSumUSD(userId, { date: { $gte: ranges.year } }),
      Expense.find({ userId: uid })
        .sort({ date: -1 })
        .limit(8)
        .populate("categoryId")
        .populate("userId", "name")
        .lean(),
      Expense.find(userFilter(userId, { date: { $gte: ranges.month } }))
        .select("categoryId amount currency")
        .lean<Array<{ categoryId: Types.ObjectId; amount: number; currency: string }>>(),
      getMonthlyExpenseData(userId),
      getCurrentBudget(),
      Expense.find(
        userFilter(userId, {
          date: { $gte: ranges.lastMonth, $lt: ranges.lastMonthEnd },
        })
      )
        .select("amount currency")
        .lean<Array<{ amount: number; currency: string }>>(),
      Expense.countDocuments(userFilter(userId, { date: { $gte: ranges.month } })),
      getCompanyExpensesTotalForRange(ranges.month, new Date()),
    ]);

  const categories = await Category.find().lean<ICategory[]>();
  const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

  const categoryTotals = new Map<string, number>();
  for (const item of monthExpenses) {
    const pkr = expenseAmountInUSD(decimalToNumber(item.amount), item.currency);
    const catId = String(item.categoryId);
    categoryTotals.set(catId, (categoryTotals.get(catId) ?? 0) + pkr);
  }

  const categoryData = Array.from(categoryTotals.entries())
    .map(([categoryId, value]) => {
      const cat = categoryMap.get(categoryId);
      return {
        name: cat?.name ?? "Unknown",
        value,
        color: cat?.color ?? "#0d9488",
      };
    })
    .sort((a, b) => b.value - a.value);

  const monthTotal = monthSum;
  const budgetAmount = budget
    ? expenseAmountInUSD(decimalToNumber((budget as IBudget).amount), (budget as IBudget).currency)
    : 0;
  const budgetUsed = budgetAmount > 0 ? (companyMonthTotal / budgetAmount) * 100 : 0;

  return {
    totals: {
      today: todaySum,
      week: weekSum,
      month: monthTotal,
      year: yearSum,
    },
    recentExpenses: recentExpenses.map((e) => {
      const cat = e.categoryId as Record<string, unknown>;
      const usr = e.userId as Record<string, unknown>;
      return formatExpenseDoc({
        ...e,
        category: cat && cat.name ? { ...cat, id: String(cat._id) } : cat,
        user: usr && usr.name ? { name: usr.name } : undefined,
        categoryId: cat?._id ?? e.categoryId,
        userId: usr?._id ?? e.userId,
      });
    }),
    categoryData,
    monthlyData,
    budget: budget
      ? {
          amount: budgetAmount,
          used: companyMonthTotal,
          remaining: Math.max(0, budgetAmount - companyMonthTotal),
          percentage: budgetUsed,
        }
      : null,
    lastMonthTotal: sumExpensesInUSD(lastMonthExpenses),
    monthCount,
    highestCategory: categoryData[0] ?? null,
  };
}

async function getMonthlyExpenseData(userId: string) {
  const end = new Date();
  const start = subYears(end, 1);
  const months = eachMonthOfInterval({ start, end });

  const expenses = await Expense.find(userFilter(userId, { date: { $gte: start } }))
    .select("date amount currency")
    .sort({ date: 1 })
    .lean();

  const monthTotals = new Map<string, number>();
  for (const exp of expenses) {
    const key = format(exp.date, "MMM yyyy");
    const pkr = expenseAmountInUSD(decimalToNumber(exp.amount), exp.currency);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + pkr);
  }

  return months.map((m) => ({
    month: format(m, "MMM"),
    amount: monthTotals.get(format(m, "MMM yyyy")) ?? 0,
  }));
}

export async function getCurrentBudget(): Promise<IBudget | null> {
  const now = new Date();
  return Budget.findOne({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }).lean<IBudget | null>();
}

export async function getMonthlyReport(userId: string, month: number, year: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const prevStart = startOfMonth(subMonths(start, 1));
  const prevEnd = endOfMonth(prevStart);

  const [expenses, prevExpenses, categories] = await Promise.all([
    Expense.find(userFilter(userId, { date: { $gte: start, $lte: end } }))
      .populate("categoryId")
      .sort({ date: -1 })
      .lean(),
    Expense.find(userFilter(userId, { date: { $gte: prevStart, $lte: prevEnd } }))
      .select("amount currency")
      .lean<Array<{ amount: number; currency: string }>>(),
    Category.find().lean<ICategory[]>(),
  ]);

  const categoryTotals = new Map<string, { name: string; color: string; total: number }>();
  let total = 0;

  for (const exp of expenses) {
    const cat = exp.categoryId as Record<string, unknown>;
    const amount = expenseAmountInUSD(decimalToNumber(exp.amount), exp.currency);
    total += amount;
    const catId = String(cat?._id ?? exp.categoryId);
    const existing = categoryTotals.get(catId) ?? {
      name: String(cat?.name ?? "Unknown"),
      color: String(cat?.color ?? "#0d9488"),
      total: 0,
    };
    existing.total += amount;
    categoryTotals.set(catId, existing);
  }

  const breakdown = Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total);
  const highest = breakdown[0] ?? null;
  const prevMonthTotal = sumExpensesInUSD(prevExpenses);
  const comparison =
    prevMonthTotal > 0 ? ((total - prevMonthTotal) / prevMonthTotal) * 100 : total > 0 ? 100 : 0;

  return {
    month,
    year,
    total,
    expenses: expenses.map((e) => {
      const cat = e.categoryId as Record<string, unknown>;
      return formatExpenseDoc({
        ...e,
        category: cat,
        categoryId: cat?._id ?? e.categoryId,
      });
    }),
    breakdown,
    highest,
    prevMonthTotal,
    comparison,
    categories: categories.map((c) => ({ ...c, id: String(c._id) })),
  };
}

export async function getTrendData(userId: string) {
  const end = new Date();
  const start = subYears(end, 1);

  const expenses = await Expense.find(userFilter(userId, { date: { $gte: start } }))
    .select("date amount currency")
    .sort({ date: 1 })
    .lean();

  const dailyMap = new Map<string, number>();
  for (const exp of expenses) {
    const key = format(exp.date, "yyyy-MM-dd");
    const pkr = expenseAmountInUSD(decimalToNumber(exp.amount), exp.currency);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + pkr);
  }

  return Array.from(dailyMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .slice(-30);
}
