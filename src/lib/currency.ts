export type CurrencyCode = "PKR" | "CLP";

/** 1 CLP = 0.31 PKR */
export const CLP_TO_PKR = 0.31;
export const PKR_TO_CLP = 1 / CLP_TO_PKR;

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  PKR: "Pakistani Rupee (₨)",
  CLP: "Chilean Peso (CLP)",
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value === "PKR" || value === "CLP";
}

export function toPKR(amount: number, currency: CurrencyCode): number {
  if (currency === "PKR") return amount;
  return amount * CLP_TO_PKR;
}

export function toCLP(amount: number, currency: CurrencyCode): number {
  if (currency === "CLP") return amount;
  return amount * PKR_TO_CLP;
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  if (from === to) return amount;
  return to === "PKR" ? toPKR(amount, from) : toCLP(amount, from);
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const rounded = Math.round(amount);
  if (currency === "CLP") {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(rounded)} CLP`;
  }
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function formatDualMoney(amount: number, sourceCurrency: CurrencyCode): string {
  const pkr = toPKR(amount, sourceCurrency);
  const clp = toCLP(amount, sourceCurrency);
  return `${formatMoney(pkr, "PKR")} · ${formatMoney(clp, "CLP")}`;
}

export function currencySymbol(currency: CurrencyCode): string {
  return currency === "CLP" ? "CLP" : "₨";
}
