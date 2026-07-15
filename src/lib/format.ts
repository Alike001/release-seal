import { formatEther } from "viem";

export function formatGas(value: bigint | undefined) {
  return value === undefined ? "NOT PROVIDED" : value.toLocaleString("en-US");
}

export function formatMon(value: bigint | undefined) {
  if (value === undefined) return "NOT PROVIDED";
  const formatted = formatEther(value);
  const [whole, fraction = ""] = formatted.split(".");
  return `${whole}.${fraction.slice(0, 8).padEnd(8, "0")} MON`;
}

export function shortHash(value: string | undefined, size = 6) {
  if (!value) return "NOT PROVIDED";
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`;
}
