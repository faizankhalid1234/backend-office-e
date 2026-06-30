import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectMongo, disconnectMongo } from "../src/lib/mongo.js";
import { Category } from "../src/models/Category.js";
import { User } from "../src/models/User.js";
import { Budget } from "../src/models/Budget.js";

const DEFAULT_CATEGORIES = [
  { name: "Tea & Refreshments", color: "#f59e0b" },
  { name: "Petrol", color: "#ef4444" },
  { name: "Car Maintenance", color: "#8b5cf6" },
  { name: "Office Rent", color: "#3b82f6" },
  { name: "Electricity", color: "#eab308" },
  { name: "Internet", color: "#06b6d4" },
  { name: "Stationery", color: "#84cc16" },
  { name: "Staff Lunch", color: "#f97316" },
  { name: "Marketing", color: "#ec4899" },
  { name: "Travel", color: "#14b8a6" },
  { name: "Miscellaneous", color: "#6b7280" },
];

async function main() {
  await connectMongo();
  console.log("Seeding MongoDB...");

  for (const cat of DEFAULT_CATEGORIES) {
    await Category.findOneAndUpdate(
      { name: cat.name },
      { ...cat, isDefault: true },
      { upsert: true, new: true }
    );
  }

  const adminPassword = await bcrypt.hash("admin123", 12);
  await User.findOneAndUpdate(
    { email: "admin@hhhusain.com" },
    {
      name: "Admin",
      email: "admin@hhhusain.com",
      password: adminPassword,
      role: "ADMIN",
      isActive: true,
    },
    { upsert: true, new: true }
  );

  const hafizPassword = await bcrypt.hash("12345678", 12);
  await User.findOneAndUpdate(
    { email: "hafiz@gmail.com" },
    {
      name: "Hafiz",
      email: "hafiz@gmail.com",
      password: hafizPassword,
      role: "ADMIN",
      isActive: true,
    },
    { upsert: true, new: true }
  );

  const employeePassword = await bcrypt.hash("employee123", 12);
  await User.findOneAndUpdate(
    { email: "employee@hhhusain.com" },
    {
      name: "Employee",
      email: "employee@hhhusain.com",
      password: employeePassword,
      role: "EMPLOYEE",
      isActive: true,
    },
    { upsert: true, new: true }
  );

  const now = new Date();
  await Budget.findOneAndUpdate(
    { month: now.getMonth() + 1, year: now.getFullYear() },
    {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      amount: 500000,
      currency: "PKR",
    },
    { upsert: true, new: true }
  );

  console.log("MongoDB seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMongo();
  });
