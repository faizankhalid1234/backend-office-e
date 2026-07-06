import { decimalToNumber } from "./utils-format.js";

export function formatExpense(exp: Record<string, unknown>) {
  const category = exp.categoryId as Record<string, unknown> | undefined;
  const user = exp.userId as Record<string, unknown> | undefined;

  return {
    id: String(exp._id),
    title: exp.title,
    amount: decimalToNumber(exp.amount as number),
    currency: exp.currency,
    date: exp.date,
    paymentMethod: exp.paymentMethod,
    description: exp.description,
    receiptUrl: exp.receiptUrl,
    receiptName: exp.receiptName,
    userId: String((user as { _id?: unknown })?._id ?? exp.userId),
    categoryId: String(category?._id ?? exp.categoryId),
    createdAt: exp.createdAt,
    updatedAt: exp.updatedAt,
    category: category
      ? {
          id: String(category._id),
          name: category.name,
          color: category.color,
          description: category.description,
          isDefault: category.isDefault,
        }
      : undefined,
    user: user?.name
      ? {
          id: String(user._id),
          name: user.name as string,
          email: (user.email as string | undefined) ?? undefined,
          role: (user.role as string | undefined) ?? undefined,
        }
      : undefined,
  };
}
