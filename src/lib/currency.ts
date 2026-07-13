export type CurrencyCode = "USD" | "JPY" | "CLP";

/** Approximate rates vs USD */
export const CLP_PER_USD = 950;
export const JPY_PER_USD = 150;
export const CLP_TO_USD = 1 / CLP_PER_USD;
export const JPY_TO_USD = 1 / JPY_PER_USD;
export const USD_TO_CLP = CLP_PER_USD;
export const USD_TO_JPY = JPY_PER_USD;

export const CURRENCY_CODES: CurrencyCode[] = ["USD", "JPY", "CLP"];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "US Dollar ($)",
  JPY: "Japanese Yen (¥)",
  CLP: "Chilean Peso (CLP)",
};

export const CURRENCY_SHORT: Record<CurrencyCode, string> = {
  USD: "USD",
  JPY: "JPY",
  CLP: "CLP",
};

export function normalizeCurrency(value: string): CurrencyCode {
  if (value === "JPY") return "JPY";
  if (value === "CLP") return "CLP";
  return "USD";
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value === "USD" || value === "JPY" || value === "CLP";
}

export function toUSD(amount: number, currency: string): number {
  const c = normalizeCurrency(currency);
  if (c === "USD") return amount;
  if (c === "JPY") return amount * JPY_TO_USD;
  return amount * CLP_TO_USD;
}

export function toJPY(amount: number, currency: string): number {
  const c = normalizeCurrency(currency);
  if (c === "JPY") return amount;
  return toUSD(amount, c) * USD_TO_JPY;
}

export function toCLP(amount: number, currency: string): number {
  const c = normalizeCurrency(currency);
  if (c === "CLP") return amount;
  return toUSD(amount, c) * USD_TO_CLP;
}

/** @deprecated Use toUSD */
export const toPKR = toUSD;

export function convertCurrency(
  amount: number,
  from: string,
  to: CurrencyCode
): number {
  const fromNorm = normalizeCurrency(from);
  if (fromNorm === to) return amount;
  if (to === "USD") return toUSD(amount, fromNorm);
  if (to === "JPY") return toJPY(amount, fromNorm);
  return toCLP(amount, fromNorm);
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  if (currency === "CLP") {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(Math.round(amount))} CLP`;
  }
  if (currency === "JPY") {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Primary display pair: USD · JPY */
export function formatDualMoney(amount: number, sourceCurrency: string): string {
  const usd = toUSD(amount, sourceCurrency);
  const jpy = toJPY(amount, sourceCurrency);
  return `${formatMoney(usd, "USD")} · ${formatMoney(jpy, "JPY")}`;
}

export function currencySymbol(currency: CurrencyCode): string {
  if (currency === "JPY") return "¥";
  if (currency === "CLP") return "CLP";
  return "$";
}
