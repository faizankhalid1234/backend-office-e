import { Router } from "express";
import {
  getFuelPrices,
  ingestFuelPricesFromPayload,
  verifyFuelWebhookSecret,
} from "../lib/fuel-prices-service.js";

export const fuelPricesRouter = Router();

/** Latest Chile (CLP) + Pakistan (PKR) fuel prices — saved in MongoDB from n8n */
fuelPricesRouter.get("/", async (req, res) => {
  try {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const data = await getFuelPrices(refresh);
    res.json(data);
  } catch (error) {
    console.error("[fuel-prices] route error:", error);
    res.status(500).json({ error: "Failed to load fuel prices" });
  }
});

/** n8n workflow POST — saves Chile + Pakistan fuel data to database */
fuelPricesRouter.post("/webhook", async (req, res) => {
  try {
    if (!verifyFuelWebhookSecret(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized webhook" });
      return;
    }

    const saved = await ingestFuelPricesFromPayload(req.body, "webhook");
    if (!saved) {
      res.status(400).json({
        error: "Invalid fuel price payload. Send chile (CLP) and pakistan (PKR) data.",
      });
      return;
    }

    res.json(saved);
  } catch (error) {
    console.error("[fuel-prices] webhook error:", error);
    res.status(500).json({ error: "Failed to save fuel prices" });
  }
});

/** Manual sync — pull from n8n GET webhook and save to database */
fuelPricesRouter.post("/sync", async (req, res) => {
  try {
    if (!verifyFuelWebhookSecret(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const data = await getFuelPrices(true);
    if (data.source === "fallback") {
      res.status(502).json({
        error: "Could not sync from n8n. Check N8N_FUEL_PRICES_WEBHOOK_URL.",
        data,
      });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error("[fuel-prices] sync error:", error);
    res.status(500).json({ error: "Failed to sync fuel prices" });
  }
});
