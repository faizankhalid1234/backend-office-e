import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "EMPLOYEE"]).optional(),
});

export const expenseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.enum(["PKR", "CLP"]).optional().default("PKR"),
  date: z.string().min(1, "Date is required"),
  paymentMethod: z.enum(["CASH", "BANK", "EASYPAISA", "JAZZCASH", "CARD"]),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const userCreateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  isActive: z.boolean().optional().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  isActive: z.boolean().optional(),
});

export const userBulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one user"),
  action: z.enum(["activate", "deactivate", "set_admin", "set_employee", "delete"]),
});

export const budgetSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  amount: z.coerce.number().positive("Budget must be positive"),
  currency: z.enum(["PKR", "CLP"]).optional().default("PKR"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
