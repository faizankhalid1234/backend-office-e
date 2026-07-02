import { FuelPriceSnapshot, type IFuelPriceSnapshot } from "../models/FuelPriceSnapshot.js";

export type FuelType = "gasoline" | "diesel" | "kerosene";

export type ChileFuelEntry = {
  label: string;
  clpPerLiter: number;
  usdPerLiter?: number;
};

export type PakistanFuelEntry = {
  label: string;
  pkrPerLiter: number;
};

export type FuelPricesResponse = {
  lastUpdated: string;
  source: "n8n" | "database" | "fallback";
  savedAt?: string;
  chile: Record<FuelType, ChileFuelEntry>;
  pakistan: Partial<Record<FuelType, PakistanFuelEntry>>;
};

/** Chile petrol + diesel only — no Pakistan */
export type ChilePetrolDieselResponse = {
  lastUpdated: string;
  source: "n8n" | "database" | "fallback";
  savedAt?: string;
  petrol: ChileFuelEntry;
  diesel: ChileFuelEntry;
};

const FUEL_TYPES: FuelType[] = ["gasoline", "diesel", "kerosene"];

const DEFAULT_CHILE: Record<FuelType, ChileFuelEntry> = {
  gasoline: { label: "Gasoline / Petrol", clpPerLiter: 1599, usdPerLiter: 1.75 },
  diesel: { label: "Diesel", clpPerLiter: 1438, usdPerLiter: 1.57 },
  kerosene: { label: "Kerosene", clpPerLiter: 1242 },
};

const DEFAULT_PAKISTAN: Partial<Record<FuelType, PakistanFuelEntry>> = {
  gasoline: { label: "Super", pkrPerLiter: 373.78 },
  diesel: { label: "Diesel", pkrPerLiter: 378.78 },
};

const FUEL_KEY_ALIASES: Record<string, FuelType> = {
  gasoline: "gasoline",
  gasolina: "gasoline",
  petrol: "gasoline",
  super: "gasoline",
  "gasolina 93": "gasoline",
  "gasolina 95": "gasoline",
  diesel: "diesel",
  kerosene: "kerosene",
  kerosene_oil: "kerosene",
  parafina: "kerosene",
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { data: FuelPricesResponse; expiresAt: number } | null = null;

function normalizeFuelKey(raw: string): FuelType | null {
  const key = raw.trim().toLowerCase();
  return FUEL_KEY_ALIASES[key] ?? null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readClpFromRecord(record: Record<string, unknown>): number | null {
  for (const field of [
    "clpPerLiter",
    "clp",
    "current_price_clp",
    "price",
    "precio",
    "value",
    "amount",
  ]) {
    const num = readNumber(record[field]);
    if (num != null && num > 0) return num;
  }
  return null;
}

function readPkrFromRecord(record: Record<string, unknown>): number | null {
  for (const field of ["pkrPerLiter", "pkr", "rs", "price", "precio", "value", "amount"]) {
    const num = readNumber(record[field]);
    if (num != null && num > 0) return num;
  }
  return null;
}

function readUsdFromRecord(record: Record<string, unknown>): number | undefined {
  for (const field of ["usdPerLiter", "usd", "usd_price"]) {
    const num = readNumber(record[field]);
    if (num != null && num > 0) return num;
  }
  return undefined;
}

function readLabelFromRecord(
  record: Record<string, unknown>,
  fallback: string
): string {
  for (const field of ["label", "name", "product", "tipo"]) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function readCountry(record: Record<string, unknown>): "chile" | "pakistan" | null {
  const raw =
    (typeof record.country === "string" && record.country) ||
    (typeof record.region === "string" && record.region);
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key.includes("chile") || key === "cl") return "chile";
  if (key.includes("pakistan") || key === "pk") return "pakistan";
  return null;
}

function mergeChileEntry(
  type: FuelType,
  partial?: Partial<ChileFuelEntry>
): ChileFuelEntry {
  const base = DEFAULT_CHILE[type];
  return {
    label: partial?.label ?? base.label,
    clpPerLiter: partial?.clpPerLiter ?? base.clpPerLiter,
    usdPerLiter: partial?.usdPerLiter ?? base.usdPerLiter,
  };
}

function mergePakistanEntry(
  type: FuelType,
  partial?: Partial<PakistanFuelEntry>
): PakistanFuelEntry | undefined {
  const base = DEFAULT_PAKISTAN[type];
  if (!partial?.pkrPerLiter && !base) return undefined;
  return {
    label: partial?.label ?? base?.label ?? DEFAULT_CHILE[type].label,
    pkrPerLiter: partial?.pkrPerLiter ?? base?.pkrPerLiter ?? 0,
  };
}

function parseFuelObject(
  input: Record<string, unknown>
): {
  chile: Partial<Record<FuelType, ChileFuelEntry>>;
  pakistan: Partial<Record<FuelType, PakistanFuelEntry>>;
  lastUpdated?: string;
} {
  const chile: Partial<Record<FuelType, ChileFuelEntry>> = {};
  const pakistan: Partial<Record<FuelType, PakistanFuelEntry>> = {};

  let lastUpdated: string | undefined;
  if (typeof input.lastUpdated === "string") lastUpdated = input.lastUpdated;
  if (typeof input.updatedAt === "string") lastUpdated = input.updatedAt;
  if (typeof input.date === "string") lastUpdated = input.date;

  const chileBlock =
    (input.chile as Record<string, unknown> | undefined) ??
    (input.clp as Record<string, unknown> | undefined);
  const pakistanBlock =
    (input.pakistan as Record<string, unknown> | undefined) ??
    (input.pkr as Record<string, unknown> | undefined);

  for (const type of FUEL_TYPES) {
    const chileValue = chileBlock?.[type] ?? input[type];
    if (chileValue && typeof chileValue === "object" && !Array.isArray(chileValue)) {
      const record = chileValue as Record<string, unknown>;
      const clp = readClpFromRecord(record);
      if (clp != null) {
        chile[type] = {
          label: readLabelFromRecord(record, DEFAULT_CHILE[type].label),
          clpPerLiter: clp,
          usdPerLiter: readUsdFromRecord(record),
        };
      }
    } else {
      const clp = readNumber(chileValue);
      if (clp != null && clp > 0) {
        chile[type] = { ...DEFAULT_CHILE[type], clpPerLiter: clp };
      }
    }

    const pakValue = pakistanBlock?.[type] ?? input[`${type}Pkr`] ?? input[`${type}_pkr`];
    if (pakValue && typeof pakValue === "object" && !Array.isArray(pakValue)) {
      const record = pakValue as Record<string, unknown>;
      const pkr = readPkrFromRecord(record);
      if (pkr != null) {
        pakistan[type] = {
          label: readLabelFromRecord(
            record,
            DEFAULT_PAKISTAN[type]?.label ?? DEFAULT_CHILE[type].label
          ),
          pkrPerLiter: pkr,
        };
      }
    } else {
      const pkr = readNumber(pakValue);
      if (pkr != null && pkr > 0) {
        pakistan[type] = {
          label: DEFAULT_PAKISTAN[type]?.label ?? DEFAULT_CHILE[type].label,
          pkrPerLiter: pkr,
        };
      }
    }
  }

  return { chile, pakistan, lastUpdated };
}

function parseFuelArray(items: unknown[]): ReturnType<typeof parseFuelObject> {
  const chile: Partial<Record<FuelType, ChileFuelEntry>> = {};
  const pakistan: Partial<Record<FuelType, PakistanFuelEntry>> = {};

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;

    const keySource =
      (typeof record.type === "string" && record.type) ||
      (typeof record.fuelType === "string" && record.fuelType) ||
      (typeof record.key === "string" && record.key) ||
      (typeof record.name === "string" && record.name) ||
      (typeof record.product === "string" && record.product);

    if (!keySource) continue;
    const fuelType = normalizeFuelKey(keySource);
    if (!fuelType) continue;

    const currency =
      typeof record.currency === "string" ? record.currency.toUpperCase() : "";
    const country = readCountry(record);

    if (currency === "PKR" || currency === "RS" || country === "pakistan") {
      const pkr = readPkrFromRecord(record);
      if (!pkr) continue;
      pakistan[fuelType] = {
        label: readLabelFromRecord(
          record,
          DEFAULT_PAKISTAN[fuelType]?.label ?? DEFAULT_CHILE[fuelType].label
        ),
        pkrPerLiter: pkr,
      };
      continue;
    }

    const clp = readClpFromRecord(record);
    if (!clp) continue;

    if (currency === "CLP" || country === "chile" || !currency) {
      chile[fuelType] = {
        label: readLabelFromRecord(record, DEFAULT_CHILE[fuelType].label),
        clpPerLiter: clp,
        usdPerLiter: readUsdFromRecord(record),
      };
    }
  }

  return { chile, pakistan };
}

function unwrapN8nPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const record = raw as Record<string, unknown>;

  if (Array.isArray(record.data)) return record.data;
  if (record.body != null) return record.body;
  if (record.json != null) return record.json;
  if (record.result != null) return record.result;

  return raw;
}

function buildResponse(
  parsed: ReturnType<typeof parseFuelObject>,
  source: FuelPricesResponse["source"],
  savedAt?: string
): FuelPricesResponse {
  const chile = {} as Record<FuelType, ChileFuelEntry>;
  const pakistan: Partial<Record<FuelType, PakistanFuelEntry>> = {};

  for (const type of FUEL_TYPES) {
    chile[type] = mergeChileEntry(type, parsed.chile[type]);
    const pakEntry = mergePakistanEntry(type, parsed.pakistan[type]);
    if (pakEntry) pakistan[type] = pakEntry;
  }

  return {
    lastUpdated: parsed.lastUpdated ?? new Date().toISOString().slice(0, 10),
    source,
    savedAt,
    chile,
    pakistan,
  };
}

function fallbackPrices(): FuelPricesResponse {
  return buildResponse(
    { chile: DEFAULT_CHILE, pakistan: DEFAULT_PAKISTAN },
    "fallback"
  );
}

function hasParsedData(parsed: ReturnType<typeof parseFuelObject>): boolean {
  return (
    Object.keys(parsed.chile).length > 0 || Object.keys(parsed.pakistan).length > 0
  );
}

export function parseN8nResponse(raw: unknown): FuelPricesResponse | null {
  const payload = unwrapN8nPayload(raw);

  if (Array.isArray(payload)) {
    const parsed = parseFuelArray(payload);
    if (!hasParsedData(parsed)) return null;
    return buildResponse(parsed, "n8n");
  }

  if (payload && typeof payload === "object") {
    const parsed = parseFuelObject(payload as Record<string, unknown>);
    if (!hasParsedData(parsed)) return null;
    return buildResponse(parsed, "n8n");
  }

  return null;
}

function docToResponse(doc: {
  lastUpdated: string;
  chile: Record<FuelType, ChileFuelEntry>;
  pakistan: Partial<Record<FuelType, PakistanFuelEntry>>;
  updatedAt: Date;
}): FuelPricesResponse {
  return {
    lastUpdated: doc.lastUpdated,
    source: "database",
    savedAt: doc.updatedAt.toISOString(),
    chile: doc.chile,
    pakistan: doc.pakistan ?? {},
  };
}

async function loadFromDatabase(): Promise<FuelPricesResponse | null> {
  const doc = await FuelPriceSnapshot.findOne({ snapshotKey: "latest" }).lean<IFuelPriceSnapshot>();
  if (!doc?.chile) return null;
  return docToResponse({
    lastUpdated: doc.lastUpdated,
    chile: doc.chile as Record<FuelType, ChileFuelEntry>,
    pakistan: (doc.pakistan ?? {}) as Partial<Record<FuelType, PakistanFuelEntry>>,
    updatedAt: doc.updatedAt ?? new Date(),
  });
}

export async function saveFuelPrices(
  data: FuelPricesResponse,
  rawPayload: unknown,
  ingestSource: "n8n" | "webhook" | "sync" = "n8n"
): Promise<FuelPricesResponse> {
  const doc = await FuelPriceSnapshot.findOneAndUpdate(
    { snapshotKey: "latest" },
    {
      snapshotKey: "latest",
      lastUpdated: data.lastUpdated,
      source: ingestSource,
      chile: data.chile,
      pakistan: data.pakistan,
      rawPayload,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const saved = docToResponse({
    lastUpdated: doc.lastUpdated,
    chile: doc.chile as Record<FuelType, ChileFuelEntry>,
    pakistan: (doc.pakistan ?? {}) as Partial<Record<FuelType, PakistanFuelEntry>>,
    updatedAt: doc.updatedAt,
  });

  cache = {
    data: saved,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return saved;
}

async function fetchFromN8n(): Promise<{ data: FuelPricesResponse; raw: unknown } | null> {
  const webhookUrl = process.env.N8N_FUEL_PRICES_WEBHOOK_URL?.trim();
  if (!webhookUrl) return null;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const authHeader = process.env.N8N_FUEL_PRICES_WEBHOOK_AUTH?.trim();
  if (authHeader) {
    headers.Authorization = authHeader.startsWith("Bearer ")
      ? authHeader
      : `Bearer ${authHeader}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(webhookUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[fuel-prices] n8n webhook failed:", res.status, res.statusText);
      return null;
    }

    const raw = await res.json();
    const parsed = parseN8nResponse(raw);
    if (!parsed) return null;
    return { data: parsed, raw };
  } catch (error) {
    console.error("[fuel-prices] n8n fetch error:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function ingestFuelPricesFromPayload(
  raw: unknown,
  ingestSource: "webhook" | "sync" = "webhook"
): Promise<FuelPricesResponse | null> {
  const parsed = parseN8nResponse(raw);
  if (!parsed) return null;
  return saveFuelPrices(parsed, raw, ingestSource);
}

export async function getFuelPrices(forceRefresh = false): Promise<FuelPricesResponse> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  if (!forceRefresh) {
    const fromDb = await loadFromDatabase();
    if (fromDb) {
      cache = { data: fromDb, expiresAt: Date.now() + CACHE_TTL_MS };
      return fromDb;
    }
  }

  const fromN8n = await fetchFromN8n();
  if (fromN8n) {
    const saved = await saveFuelPrices(fromN8n.data, fromN8n.raw, "n8n");
    return saved;
  }

  const fromDb = await loadFromDatabase();
  if (fromDb) return fromDb;

  const fallback = fallbackPrices();
  cache = { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS };
  return fallback;
}

export function verifyFuelWebhookSecret(authHeader: string | undefined): boolean {
  const secret = process.env.N8N_FUEL_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  if (!authHeader) return false;
  if (authHeader === `Bearer ${secret}`) return true;
  if (authHeader === secret) return true;
  return false;
}

function readLastUpdated(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return new Date().toISOString().slice(0, 10);
  }
  const record = raw as Record<string, unknown>;
  for (const field of ["lastUpdated", "updatedAt", "date", "report_date"]) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return new Date().toISOString().slice(0, 10);
}

function buildChilePetrolDieselResponse(
  chile: Record<FuelType, ChileFuelEntry>,
  lastUpdated: string,
  source: ChilePetrolDieselResponse["source"],
  savedAt?: Date
): ChilePetrolDieselResponse {
  return {
    lastUpdated,
    source,
    savedAt: savedAt?.toISOString(),
    petrol: chile.gasoline,
    diesel: chile.diesel,
  };
}

function parseSingleChileEntry(
  raw: unknown,
  fuelType: "gasoline" | "diesel"
): ChileFuelEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const nested =
    (record.chile as Record<string, unknown> | undefined)?.[fuelType] ??
    (fuelType === "gasoline"
      ? record.petrol ?? record.gasoline
      : record.diesel);

  const source =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : record;

  const clp = readClpFromRecord(source);
  if (clp == null || clp <= 0) return null;

  return {
    label: readLabelFromRecord(source, DEFAULT_CHILE[fuelType].label),
    clpPerLiter: clp,
    usdPerLiter: readUsdFromRecord(source),
  };
}

async function mergeAndSaveChileType(
  fuelType: "gasoline" | "diesel",
  entry: ChileFuelEntry,
  raw: unknown,
  ingestSource: "webhook" | "n8n" = "webhook"
): Promise<ChilePetrolDieselResponse> {
  const existing = await FuelPriceSnapshot.findOne({ snapshotKey: "latest" }).lean<IFuelPriceSnapshot>();

  const chile: Record<FuelType, ChileFuelEntry> = {
    gasoline: {
      label: existing?.chile?.gasoline?.label ?? DEFAULT_CHILE.gasoline.label,
      clpPerLiter: existing?.chile?.gasoline?.clpPerLiter ?? DEFAULT_CHILE.gasoline.clpPerLiter,
      usdPerLiter: existing?.chile?.gasoline?.usdPerLiter ?? DEFAULT_CHILE.gasoline.usdPerLiter,
    },
    diesel: {
      label: existing?.chile?.diesel?.label ?? DEFAULT_CHILE.diesel.label,
      clpPerLiter: existing?.chile?.diesel?.clpPerLiter ?? DEFAULT_CHILE.diesel.clpPerLiter,
      usdPerLiter: existing?.chile?.diesel?.usdPerLiter ?? DEFAULT_CHILE.diesel.usdPerLiter,
    },
    kerosene: {
      label: existing?.chile?.kerosene?.label ?? DEFAULT_CHILE.kerosene.label,
      clpPerLiter: existing?.chile?.kerosene?.clpPerLiter ?? DEFAULT_CHILE.kerosene.clpPerLiter,
      usdPerLiter: existing?.chile?.kerosene?.usdPerLiter ?? DEFAULT_CHILE.kerosene.usdPerLiter,
    },
  };
  chile[fuelType] = entry;

  const lastUpdated = readLastUpdated(raw);

  const doc = await FuelPriceSnapshot.findOneAndUpdate(
    { snapshotKey: "latest" },
    {
      snapshotKey: "latest",
      lastUpdated,
      source: ingestSource,
      chile,
      pakistan: existing?.pakistan ?? {},
      rawPayload: raw,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  cache = null;

  return buildChilePetrolDieselResponse(
    chile,
    doc.lastUpdated,
    "database",
    doc.updatedAt
  );
}

export async function ingestChilePetrol(
  raw: unknown
): Promise<ChilePetrolDieselResponse | null> {
  const entry = parseSingleChileEntry(raw, "gasoline");
  if (!entry) return null;
  return mergeAndSaveChileType("gasoline", entry, raw, "webhook");
}

export async function ingestChileDiesel(
  raw: unknown
): Promise<ChilePetrolDieselResponse | null> {
  const entry = parseSingleChileEntry(raw, "diesel");
  if (!entry) return null;
  return mergeAndSaveChileType("diesel", entry, raw, "webhook");
}

export async function getChilePetrolDieselPrices(): Promise<ChilePetrolDieselResponse> {
  const doc = await FuelPriceSnapshot.findOne({ snapshotKey: "latest" }).lean<IFuelPriceSnapshot>();
  if (doc?.chile?.gasoline && doc?.chile?.diesel) {
    return buildChilePetrolDieselResponse(
      doc.chile as Record<FuelType, ChileFuelEntry>,
      doc.lastUpdated,
      "database",
      doc.updatedAt
    );
  }

  return buildChilePetrolDieselResponse(DEFAULT_CHILE, new Date().toISOString().slice(0, 10), "fallback");
}
