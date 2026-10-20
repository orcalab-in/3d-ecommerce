import { PostHog } from "posthog-node";

// Same project key used client-side -- it's a write-only ingestion token,
// not a secret, so posthog-node can reuse the NEXT_PUBLIC_ one server-side.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/**
 * Fire-and-flush a single server-side event. Each call makes its own short-
 * lived client and shuts it down immediately so the event is actually sent
 * before a serverless function instance can suspend -- fine for low-frequency
 * admin actions like this one, not meant for hot paths.
 */
export async function trackServerEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
) {
  if (!POSTHOG_KEY || !POSTHOG_HOST) return;
  const client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
  try {
    client.capture({ distinctId, event, properties });
  } finally {
    await client.shutdown();
  }
}
