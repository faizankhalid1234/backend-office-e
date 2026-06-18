import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import type { Role } from "./types.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function dbLogin(
  email: string,
  password: string
): Promise<{ user: AuthUser } | { error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return { error: "Invalid email or password" };
  }

  if (!user.isActive) {
    return { error: "Account is disabled. Contact your admin." };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as Role,
    },
  };
}

export async function dbRegister(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: AuthUser } | { error: string }> {
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();

  const existing = await User.findOne({ email });
  if (existing) {
    return { error: "Email already registered" };
  }

  const hashed = await bcrypt.hash(data.password, 12);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role: "EMPLOYEE",
  });

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as Role,
    },
  };
}
