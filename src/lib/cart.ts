import { BaseOptionId, SizeOptionId } from "./config";
import { AdjustState, CropState } from "./imaging";

interface CartItemBase {
  id: string;
  qty: number;
}

export interface PhotoLampCartItem extends CartItemBase {
  type: "photo_lamp";
  file: File;
  /** Data URL snapshot of the live preview, for display in cart/checkout only. */
  previewThumbnail: string;
  sizeId: SizeOptionId;
  baseOption: BaseOptionId;
  crop: CropState;
  adjust: AdjustState;
  unitPrice: number;
}

export interface StlUploadCartItem extends CartItemBase {
  type: "stl_upload";
  file: File;
  sizeNotes: string;
  colour: string;
}

export interface CatalogCartItem extends CartItemBase {
  type: "catalog_product";
  productId: string;
  name: string;
  unitPrice: number;
  thumbnailUrl?: string;
}

export type CartItem = PhotoLampCartItem | StlUploadCartItem | CatalogCartItem;

export function itemLabel(item: CartItem): string {
  if (item.type === "photo_lamp") return `Photo lamp — ${item.sizeId}`;
  if (item.type === "stl_upload") return "STL/3MF upload";
  return item.name;
}

export function itemUnitPrice(item: CartItem): number | null {
  if (item.type === "stl_upload") return null;
  return item.unitPrice;
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const price = itemUnitPrice(item);
    return sum + (price ?? 0) * item.qty;
  }, 0);
}

export function cartHasUnpricedItem(items: CartItem[]): boolean {
  return items.some((item) => item.type === "stl_upload");
}
