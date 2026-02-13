export { cn } from "./cn";
export { getGreeting } from "./date";
export { formatDate, formatRelativeDate } from "./format-date";
export { formatName, getInitials } from "./format-name";
export {
  type AgentPricing,
  formatBalance,
  formatPricingDisplay,
} from "./format-price";

export function shortenAddress(address: string, length = 6): string {
  if (!address) return "";
  if (address.length <= length * 2) return address;
  return address.slice(0, length) + "…" + address.slice(-length);
}
