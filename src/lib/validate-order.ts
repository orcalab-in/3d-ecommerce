export interface OrderDetailsInput {
  name: string;
  whatsapp: string;
  address: string;
  pincode: string;
  notes: string;
  consent: boolean;
}

export function validateOrderDetails(d: OrderDetailsInput): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push("Name is required.");
  if (!/^[0-9+\-\s()]{7,15}$/.test(d.whatsapp.trim())) {
    errors.push("Enter a valid WhatsApp number.");
  }
  if (!d.address.trim()) errors.push("Delivery address is required.");
  if (!/^\d{6}$/.test(d.pincode.trim())) errors.push("Enter a valid 6-digit pincode.");
  if (!d.consent) errors.push("Please confirm you own the rights to use this photo.");
  return errors;
}
