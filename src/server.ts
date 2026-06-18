import express from "express";
import { connectMongo } from "./lib/mongo.js";
import { createApp } from "./express-app.js";

// Required for Vercel Express detection (express import in entrypoint file).
void express;

await connectMongo();

const app = createApp();
export default app;
