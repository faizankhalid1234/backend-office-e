import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware/auth.js";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "src", "uploads", "receipts"));
  },
  filename: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop() ?? "bin";
    cb(null, `${randomUUID()}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

export const uploadRouter = Router();

uploadRouter.post("/", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || "Upload failed" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    res.json({
      url: `/uploads/receipts/${file.filename}`,
      name: file.originalname,
    });
  });
});
