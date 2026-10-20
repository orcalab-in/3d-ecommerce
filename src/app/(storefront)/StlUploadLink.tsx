"use client";

import Link from "next/link";
import { track } from "@/lib/analytics/track";

export default function StlUploadLink() {
  return (
    <Link
      href="/create-stl"
      onClick={() => track("stl_link_clicked")}
      className="text-sm font-medium text-ember underline underline-offset-2 hover:text-amber-dark"
    >
      Have your own STL/3MF?
    </Link>
  );
}
