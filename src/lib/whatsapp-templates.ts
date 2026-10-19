import { OrderStatus } from "./config";

export interface TemplateVars {
  orderNo: string;
  customerName: string;
  quoteAmount: string;
  neededBy: string;
}

/** Placeholder copy -- swap these for your real wording whenever. */
export const WHATSAPP_TEMPLATES: Partial<Record<OrderStatus, string>> = {
  Received:
    "Hi {{customerName}}, thanks for your order {{orderNo}} with Litho & Glow! We're reviewing your photo now and will send a quote shortly.",
  "Quote sent":
    "Hi {{customerName}}, your lithophane lamp (order {{orderNo}}) comes to ₹{{quoteAmount}}. Let us know if that works and we'll get printing!",
  "Quote confirmed":
    "Thanks {{customerName}}! Order {{orderNo}} is confirmed at ₹{{quoteAmount}}. We'll share payment details next.",
  Paid: "Payment received for order {{orderNo}} — thank you {{customerName}}! We'll start printing shortly.",
  Printing: "Your order {{orderNo}} is on the printer now 🖨️ — we'll update you once it's done.",
  "Print completed": "Good news {{customerName}} — order {{orderNo}} has finished printing and is being packed.",
  Packed: "Order {{orderNo}} is packed and ready to ship!",
  Shipped: "Order {{orderNo}} is on its way to you, {{customerName}}! Expected by {{neededBy}}.",
  Delivered: "Hope you're loving your lithophane lamp, {{customerName}}! Thanks for ordering with us 🙏",
  "Needs photo fix":
    "Hi {{customerName}}, we ran into an issue with the photo for order {{orderNo}} — could you send a clearer/higher-res version on WhatsApp?",
  Reprint: "We're reprinting order {{orderNo}} for you, {{customerName}} — sorry for the delay!",
  Cancelled: "Order {{orderNo}} has been cancelled as requested. Let us know if you'd like to reorder.",
};

export function fillTemplate(status: OrderStatus, vars: TemplateVars): string {
  const template = WHATSAPP_TEMPLATES[status] ?? "Hi {{customerName}}, update on order {{orderNo}}: status is now " + status;
  return template
    .replaceAll("{{orderNo}}", vars.orderNo)
    .replaceAll("{{customerName}}", vars.customerName)
    .replaceAll("{{quoteAmount}}", vars.quoteAmount || "___")
    .replaceAll("{{neededBy}}", vars.neededBy || "soon");
}
