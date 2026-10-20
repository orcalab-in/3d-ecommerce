import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/" className="text-sm text-ember underline underline-offset-2">
        ← Back
      </Link>
      <h1 className="text-xl font-bold text-ember">Privacy & analytics</h1>
      <p className="text-sm text-foreground/70">
        We use PostHog to understand how people use this site -- which pages get visited, where
        people drop off while ordering, and how long it takes us to process an order. This helps
        us fix confusing steps and keep things running smoothly.
      </p>
      <p className="text-sm text-foreground/70">
        We never send your photo, any file you upload, or your name, phone number, address, or
        order notes to our analytics tool. Session replay (a recording of how you interact with
        the page) masks every form field and blocks all images and file inputs, so none of that
        content is ever captured.
      </p>
      <p className="text-sm text-foreground/70">
        Your order details are only ever used to print and deliver your order, and to confirm
        pricing and delivery with you on WhatsApp.
      </p>
    </main>
  );
}
