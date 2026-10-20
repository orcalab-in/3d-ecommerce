import { loadSettings } from "@/lib/settings";
import CreateClient from "./CreateClient";

// Pricing is admin-editable (see /admin/settings) -- force dynamic rendering
// so price changes show up immediately, not just after a rebuild.
export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const settings = await loadSettings();
  return <CreateClient pricing={settings.pricing} />;
}
