"use client";

import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export const posthogEnabled = Boolean(POSTHOG_KEY && POSTHOG_HOST);

// Module-level (not inside a component) so it runs exactly once per page
// load, before any track() call. Guarded by `typeof window` so it's a
// no-op during SSR.
if (typeof window !== "undefined" && posthogEnabled) {
  posthog.init(POSTHOG_KEY as string, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we send $pageview manually (see PostHogPageView) -- App Router navigations aren't full page loads
    person_profiles: "identified_only",
    session_recording: {
      maskAllInputs: true,
      // Order form values (name/WhatsApp/address) never show up in replay.
      // Customer photos are shown in the cart/checkout as an <img> thumbnail
      // (a canvas.toDataURL() snapshot) -- block all images and file inputs
      // so no photo pixel data ever reaches PostHog.
      blockSelector: 'input[type="file"], img',
      // recordCanvas defaults to false (not set here) -- the live lithophane
      // preview renders the customer's photo onto a <canvas>/WebGL surface,
      // so canvas recording must stay off.
    },
  });
}

export default posthog;
