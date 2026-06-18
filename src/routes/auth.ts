import { Router } from "express";
import { loginSchema, registerSchema } from "../lib/validations.js";
import { dbLogin, dbRegister } from "../lib/db-auth.js";
import { signToken } from "../lib/jwt.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const result = await dbLogin(parsed.data.email, parsed.data.password);
  if ("error" in result) {
    res.status(401).json({ error: result.error });
    return;
  }

  const token = signToken({
    id: result.user.id,
    email: result.user.email,
    role: result.user.role,
  });

  res.json({ user: result.user, token });
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const result = await dbRegister(parsed.data);
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    const token = signToken({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    res.status(201).json({ user: result.user, token });
  } catch {
    res.status(500).json({ error: "Registration failed" });
  }
});
