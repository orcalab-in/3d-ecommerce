import posthog, { posthogEnabled } from "./posthog-client";

/** Event -> property shape. `undefined` means the event takes no properties. */
type EventProps = {
  upload_started: undefined;
  upload_succeeded: undefined;
  upload_failed: { reason: string };
  low_res_warning_shown: undefined;
  dark_photo_warning_shown: undefined;
  preview_adjusted: { control: string };
  size_selected: { size: string };
  led_option_selected: { option: string };
  order_form_started: undefined;
  order_submitted: { size: string | null; qty: number; type: string };
  stl_link_clicked: undefined;
  stl_upload_submitted: undefined;
};

export function track<E extends keyof EventProps>(
  event: E,
  ...args: EventProps[E] extends undefined ? [] : [props: EventProps[E]]
) {
  if (!posthogEnabled) return;
  posthog.capture(event, args[0]);
}
