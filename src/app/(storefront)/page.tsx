import Link from "next/link";
import { SELF_CANCEL_ALLOWED_STATUSES, SIZE_OPTIONS } from "@/lib/config";
import { loadSettings } from "@/lib/settings";
import StlUploadLink from "./StlUploadLink";

// Pricing/WhatsApp number/Diwali cutoff are admin-editable (see /admin/settings)
// -- force dynamic rendering so changes show up immediately, not just after a rebuild.
export const dynamic = "force-dynamic";

const SAMPLES = [
  { label: "A family portrait", emoji: "👨‍👩‍👧" },
  { label: "A wedding photo", emoji: "💍" },
  { label: "A pet's best angle", emoji: "🐾" },
];

const STEPS = [
  { emoji: "📷", title: "Upload", body: "Pick a clear, well-lit photo — JPG, PNG or HEIC." },
  { emoji: "🎛️", title: "Preview & customize", body: "Crop, adjust, and see it glow before you commit." },
  { emoji: "💬", title: "We confirm on WhatsApp", body: "Final price and delivery details, no surprises." },
  { emoji: "📦", title: "Delivered", body: "Printed to order on our Bambu Lab A1 and shipped to you." },
];

export default async function LandingPage() {
  const settings = await loadSettings();

  const faqs = [
    {
      q: "Do I need to own the rights to the photo?",
      a: "Yes — you'll confirm this when you order. We only print photos you have the right to use.",
    },
    {
      q: "Can I cancel after ordering?",
      a: `Yes, free of charge, as long as the order is still in "${SELF_CANCEL_ALLOWED_STATUSES.join('" or "')}" status — before we've started printing. Log in to see your orders and cancel anytime in that window.`,
    },
    {
      q: "How long does delivery take?",
      a: settings.diwaliCutoffDate
        ? `Usually a few days after your quote is confirmed. ${settings.diwaliCutoffMessage}`
        : "Usually a few days after your quote is confirmed — we'll give you a clearer estimate on WhatsApp.",
    },
    {
      q: "My photo is a HEIC file — is that okay?",
      a: "We accept HEIC and convert it automatically. Live preview works best in Safari for HEIC; other browsers will still process the order correctly, just without a live preview.",
    },
    {
      q: "Can I track my order?",
      a: "Yes — create an account with your email (no password needed, just a login link) to see all your orders and their status in one place.",
    },
  ];

  return (
    <main className="flex-1">
      <section className="px-6 pt-14 pb-10 text-center sm:pt-20">
        <h1 className="text-3xl font-bold tracking-tight text-ember sm:text-5xl">
          Your photo, glowing on a shelf
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-foreground/80 sm:text-lg">
          Upload a photo, preview it as a backlit lithophane lamp panel, pick
          a size, and we&apos;ll print it on our Bambu Lab A1 and confirm
          pricing with you on WhatsApp.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/create"
            className="w-full max-w-xs rounded-full bg-amber px-8 py-3.5 text-center text-base font-semibold text-white shadow-md transition hover:bg-amber-dark sm:w-auto"
          >
            Upload your photo
          </Link>
          <StlUploadLink />
        </div>
        {settings.diwaliCutoffDate && (
          <p className="mx-auto mt-6 max-w-md rounded-lg bg-amber/10 px-4 py-2 text-sm text-amber-dark">
            🪔 {settings.diwaliCutoffMessage}
          </p>
        )}
      </section>

      {/* How it works */}
      <section className="bg-white/50 px-6 py-12">
        <h2 className="mb-8 text-center text-lg font-semibold text-ember">How it works</h2>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber/15 text-xl">
                {step.emoji}
              </div>
              <div className="text-sm font-semibold text-ember">
                {i + 1}. {step.title}
              </div>
              <p className="text-xs text-foreground/60">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample cards (placeholders until a real test print exists) */}
      <section className="px-6 py-16">
        <h2 className="mb-6 text-center text-lg font-semibold text-ember">Photo in, lamp out</h2>
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
          {SAMPLES.map((sample) => (
            <div
              key={sample.label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-amber/20 bg-white/60 p-5 text-center shadow-sm"
            >
              <div className="flex h-24 w-full items-center justify-center rounded-xl bg-neutral-200 text-3xl">
                {sample.emoji}
              </div>
              <div className="text-xs font-medium text-foreground/50">↓ becomes ↓</div>
              <div
                className="flex h-24 w-full items-center justify-center rounded-xl text-3xl"
                style={{
                  background:
                    "radial-gradient(circle at 50% 40%, #ffe3ad 0%, #c9772d 70%, #7a3b2e 100%)",
                  boxShadow: "0 0 24px 4px rgba(201,119,45,0.55)",
                }}
              >
                {sample.emoji}
              </div>
              <p className="text-sm text-foreground/70">{sample.label}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-md text-center text-xs text-foreground/50">
          Sample placeholders — real previews are generated live from your
          own photo in the next step.
        </p>
      </section>

      {/* Pricing preview */}
      <section className="bg-white/50 px-6 py-12">
        <h2 className="mb-2 text-center text-lg font-semibold text-ember">Pricing</h2>
        <p className="mb-6 text-center text-xs text-foreground/50">
          Shown upfront — no back-and-forth needed, though we&apos;ll always confirm on WhatsApp.
        </p>
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          {(Object.keys(SIZE_OPTIONS) as (keyof typeof SIZE_OPTIONS)[]).map((sizeId) => (
            <div key={sizeId} className="rounded-xl border border-amber/20 bg-white p-4 text-center shadow-sm">
              <div className="font-semibold">{SIZE_OPTIONS[sizeId].label}</div>
              <div className="mt-1 text-2xl font-bold text-amber-dark">₹{settings.pricing[sizeId].none}</div>
              <div className="text-xs text-foreground/50">₹{settings.pricing[sizeId].led} with LED base</div>
            </div>
          ))}
        </div>
      </section>

      {/* Shop teaser */}
      <section className="px-6 py-12 text-center">
        <h2 className="mb-2 text-lg font-semibold text-ember">Don&apos;t have a photo in mind?</h2>
        <p className="mx-auto mb-5 max-w-md text-sm text-foreground/70">
          Browse our ready-made pieces — figurines and other small prints, no upload needed.
        </p>
        <Link
          href="/shop"
          className="inline-block rounded-full border border-amber/40 px-6 py-2.5 text-sm font-semibold text-amber-dark"
        >
          Browse the shop
        </Link>
      </section>

      {/* FAQ */}
      <section className="bg-white/50 px-6 py-12">
        <h2 className="mb-6 text-center text-lg font-semibold text-ember">Questions</h2>
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-lg bg-white p-4 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
                <span className="flex items-center justify-between">
                  {faq.q}
                  <span className="ml-2 text-foreground/40 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-sm text-foreground/70">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Trust footer */}
      <section className="px-6 py-10 text-center text-sm text-foreground/60">
        <p>
          Questions before ordering?{" "}
          <a
            href={`https://wa.me/${settings.whatsappNumber}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-ember underline underline-offset-2"
          >
            Message us on WhatsApp
          </a>
        </p>
        <p className="mt-2">
          <Link href="/account/login" className="underline underline-offset-2 hover:text-ember">
            Track an existing order
          </Link>
        </p>
      </section>
    </main>
  );
}
