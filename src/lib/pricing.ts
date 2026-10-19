import { BaseOptionId, SizeOptionId } from "./config";

/** Price (INR) for a photo-lamp order. STL/3MF uploads aren't priced by formula -- quote-only. */
export function computeLampPrice(
  pricing: Record<SizeOptionId, Record<BaseOptionId, number>>,
  sizeId: SizeOptionId,
  baseOption: BaseOptionId,
  qty: number
): number {
  const unitPrice = pricing[sizeId][baseOption];
  return unitPrice * Math.max(1, qty);
}
