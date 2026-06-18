import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import type { IUser } from "../models/User.js";
import { Expense } from "../models/Expense.js";
import {
  userCreateSchema,
  userUpdateSchema,
  userBulkSchema,
} from "../lib/validations.js";
import { requireAuth, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import type { Role } from "../lib/types.js";

async function formatUser(user: IUser) {
  const expenseCount = await Expense.countDocuments({ userId: user._id });
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    _count: { expenses: expenseCount },
  };
}

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

usersRouter.get("/", async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean<IUser[]>();
  const formatted = await Promise.all(users.map((u) => formatUser(u)));
  res.json(formatted);
});

usersRouter.post("/bulk", async (req: AuthRequest, res) => {
  const parsed = userBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { ids, action } = parsed.data;
  const selfId = req.user?.id;
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

  if (action === "delete" && ids.includes(selfId ?? "")) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  try {
    if (action === "delete") {
      await Expense.deleteMany({ userId: { $in: objectIds } });
      await User.deleteMany({
        _id: { $in: objectIds, $ne: new mongoose.Types.ObjectId(selfId!) },
      });
    } else if (action === "activate") {
      await User.updateMany({ _id: { $in: objectIds } }, { isActive: true });
    } else if (action === "deactivate") {
      await User.updateMany(
        { _id: { $in: objectIds, $ne: new mongoose.Types.ObjectId(selfId!) } },
        { isActive: false }
      );
    } else if (action === "set_admin") {
      await User.updateMany({ _id: { $in: objectIds } }, { role: "ADMIN" });
    } else if (action === "set_employee") {
      await User.updateMany(
        { _id: { $in: objectIds, $ne: new mongoose.Types.ObjectId(selfId!) } },
        { role: "EMPLOYEE" }
      );
    }

    const users = await User.find().sort({ createdAt: -1 }).lean<IUser[]>();
    const formatted = await Promise.all(users.map((u) => formatUser(u)));
    res.json({ success: true, users: formatted });
  } catch {
    res.status(500).json({ error: "Bulk action failed" });
  }
});

usersRouter.post("/", async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const user = await User.create({
    name: parsed.data.name.trim(),
    email,
    password: hashed,
    role: parsed.data.role,
    isActive: parsed.data.isActive ?? true,
  });

  res.status(201).json(await formatUser(user));
});

usersRouter.put("/:id", async (req: AuthRequest, res) => {
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const id = String(req.params.id);
  const email = parsed.data.email.trim().toLowerCase();
  const duplicate = await User.findOne({ email, _id: { $ne: id } });
  if (duplicate) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  if (parsed.data.isActive === false && req.user?.id === id) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const update: Record<string, unknown> = {
    name: parsed.data.name.trim(),
    email,
    role: parsed.data.role,
  };

  if (parsed.data.password) {
    update.password = await bcrypt.hash(parsed.data.password, 12);
  }
  if (parsed.data.isActive !== undefined) {
    update.isActive = parsed.data.isActive;
  }

  try {
    const user = await User.findByIdAndUpdate(id, update, { new: true }).lean<IUser | null>();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(await formatUser(user));
  } catch {
    res.status(500).json({ error: "Failed to update user" });
  }
});

usersRouter.patch("/:id/toggle-active", async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  if (req.user?.id === id) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const existing = await User.findById(id);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  existing.isActive = !existing.isActive;
  await existing.save();
  res.json(await formatUser(existing));
});

usersRouter.delete("/:id", async (req: AuthRequest, res) => {
  if (req.user?.id === String(req.params.id)) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  try {
    const id = String(req.params.id);
    await Expense.deleteMany({ userId: id });
    await User.findByIdAndDelete(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});
