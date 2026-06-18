import jwt from "jsonwebtoken";

export type AuthPayload = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("JWT_SECRET or AUTH_SECRET is required");
  return secret;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getSecret()) as AuthPayload;
}
