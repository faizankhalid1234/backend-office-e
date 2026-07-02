import { Router } from "express";
import {
  getChilePetrolDieselPrices,
  getFuelPrices,
  ingestChileDiesel,
  ingestChilePetrol,
  ingestFuelPricesFromPayload,
  verifyFuelWebhookSecret,
} from "../lib/fuel-prices-service.js";

export const fuelPricesRouter = Router();

/** Chile petrol + diesel only (CLP) — no Pakistan */
fuelPricesRouter.get("/chile", async (_req, res) => {
  try {
    const data = await getChilePetrolDieselPrices();
    res.json(data);
  } catch (error) {
    console.error("[fuel-prices] chile route error:", error);
    res.status(500).json({ error: "Failed to load Chile fuel prices" });
  }
});

/** All saved fuel data (legacy) */
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

/** n8n — save Chile petrol price (merges with existing diesel) */
fuelPricesRouter.post("/webhook/petrol", async (req, res) => {
  try {
    if (!verifyFuelWebhookSecret(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized webhook" });
      return;
    }

    const saved = await ingestChilePetrol(req.body);
    if (!saved) {
      res.status(400).json({
        error: "Invalid petrol payload. Send clpPerLiter or current_price_clp.",
      });
      return;
    }

    res.json(saved);
  } catch (error) {
    console.error("[fuel-prices] petrol webhook error:", error);
    res.status(500).json({ error: "Failed to save petrol price" });
  }
});

/** n8n — save Chile diesel price (merges with existing petrol) */
fuelPricesRouter.post("/webhook/diesel", async (req, res) => {
  try {
    if (!verifyFuelWebhookSecret(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized webhook" });
      return;
    }

    const saved = await ingestChileDiesel(req.body);
    if (!saved) {
      res.status(400).json({
        error: "Invalid diesel payload. Send clpPerLiter or current_price_clp.",
      });
      return;
    }

    res.json(saved);
  } catch (error) {
    console.error("[fuel-prices] diesel webhook error:", error);
    res.status(500).json({ error: "Failed to save diesel price" });
  }
});

/** n8n workflow POST — saves full fuel data (legacy) */
fuelPricesRouter.post("/webhook", async (req, res) => {
  try {
    if (!verifyFuelWebhookSecret(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized webhook" });
      return;
    }

    const saved = await ingestFuelPricesFromPayload(req.body, "webhook");
    if (!saved) {
      res.status(400).json({
        error: "Invalid fuel price payload. Send chile (CLP) fuel data.",
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
