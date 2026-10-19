import { loadSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export default async function AdminSettingsPage() {
  const settings = await loadSettings();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-ember">Settings</h1>
      <SettingsForm initial={settings} />
    </div>
  );
}
