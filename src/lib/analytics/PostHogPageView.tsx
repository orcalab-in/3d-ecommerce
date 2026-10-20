"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog, { posthogEnabled } from "./posthog-client";

/**
 * App Router navigations don't trigger a full page load, so posthog-js's
 * built-in pageview autocapture (which listens for that) never fires here --
 * this sends $pageview manually on every route change instead.
 */
export default function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthogEnabled || !pathname) return;
    const query = searchParams.toString();
    posthog.capture("$pageview", {
      $current_url: query ? `${window.location.origin}${pathname}?${query}` : `${window.location.origin}${pathname}`,
    });
  }, [pathname, searchParams]);

  return null;
}
