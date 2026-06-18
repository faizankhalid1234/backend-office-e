import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths } from "date-fns";
import {
  formatMoney,
  formatDualMoney,
  type CurrencyCode,
  toPKR,
  isCurrencyCode,
} from "./currency.js";

export function formatCurrency(amount: number, currency: CurrencyCode = "PKR"): string {
  return formatMoney(amount, currency);
}

export function formatDualCurrency(amount: number, sourceCurrency: CurrencyCode = "PKR"): string {
  return formatDualMoney(amount, sourceCurrency);
}

export function expenseAmountInPKR(amount: number, currency: string): number {
  return toPKR(amount, isCurrencyCode(currency) ? currency : "PKR");
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "dd MMM yyyy, hh:mm a");
}

export function getDateRanges(now = new Date()) {
  return {
    today: startOfDay(now),
    week: startOfWeek(now, { weekStartsOn: 1 }),
    month: startOfMonth(now),
    year: startOfYear(now),
    lastMonth: startOfMonth(subMonths(now, 1)),
    lastMonthEnd: startOfMonth(now),
  };
}

export function decimalToNumber(value: { toNumber?: () => number } | number): number {
  if (typeof value === "number") return value;
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export function getBudgetAlertLevel(percentage: number): "normal" | "warning" | "danger" | "exceeded" {
  if (percentage >= 100) return "exceeded";
  if (percentage >= 90) return "danger";
  if (percentage >= 80) return "warning";
  return "normal";
}
