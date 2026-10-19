import Link from "next/link";
import { ORDER_CUTOFF } from "@/lib/config";

const SAMPLES = [
  { label: "A family portrait", emoji: "👨‍👩‍👧" },
  { label: "A wedding photo", emoji: "💍" },
  { label: "A pet's best angle", emoji: "🐾" },
];

export default function LandingPage() {
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
          <Link
            href="/create-stl"
            className="text-sm font-medium text-ember underline underline-offset-2 hover:text-amber-dark"
          >
            Have your own STL/3MF?
          </Link>
        </div>
        {ORDER_CUTOFF.diwaliCutoffDate && (
          <p className="mx-auto mt-6 max-w-md rounded-lg bg-amber/10 px-4 py-2 text-sm text-amber-dark">
            🪔 {ORDER_CUTOFF.message}
          </p>
        )}
      </section>

      <section className="px-6 pb-16">
        <h2 className="mb-6 text-center text-lg font-semibold text-ember">
          Photo in, lamp out
        </h2>
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
    </main>
  );
}
