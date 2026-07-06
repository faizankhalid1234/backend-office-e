export type CurrencyCode = "USD" | "CLP";

/** Approximate: 1 USD = 950 CLP */
export const CLP_PER_USD = 950;
export const CLP_TO_USD = 1 / CLP_PER_USD;
export const USD_TO_CLP = CLP_PER_USD;

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "US Dollar ($)",
  CLP: "Chilean Peso (CLP)",
};

export function normalizeCurrency(value: string): CurrencyCode {
  if (value === "CLP") return "CLP";
  return "USD";
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value === "USD" || value === "CLP";
}

export function toUSD(amount: number, currency: string): number {
  const c = normalizeCurrency(currency);
  if (c === "USD") return amount;
  return amount * CLP_TO_USD;
}

export function toCLP(amount: number, currency: string): number {
  const c = normalizeCurrency(currency);
  if (c === "CLP") return amount;
  return amount * USD_TO_CLP;
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
  return to === "USD" ? toUSD(amount, fromNorm) : toCLP(amount, fromNorm);
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  if (currency === "CLP") {
    const rounded = Math.round(amount);
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(rounded)} CLP`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDualMoney(amount: number, sourceCurrency: string): string {
  const usd = toUSD(amount, sourceCurrency);
  const clp = toCLP(amount, sourceCurrency);
  return `${formatMoney(usd, "USD")} · ${formatMoney(clp, "CLP")}`;
}

export function currencySymbol(currency: CurrencyCode): string {
  return currency === "CLP" ? "CLP" : "$";
}
