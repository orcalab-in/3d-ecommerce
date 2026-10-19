"use client";

import { useRouter } from "next/navigation";

export default function AccountLogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/account/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="text-sm text-foreground/60 hover:text-ember"
    >
      Log out
    </button>
  );
}
