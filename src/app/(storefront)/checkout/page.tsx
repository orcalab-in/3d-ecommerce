import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-auth";
import CheckoutClient from "./CheckoutClient";

// A logged-in customer's saved profile can change between visits, so this
// page must not be statically cached.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return <CheckoutClient />;

  const admin = supabaseAdmin();
  const { data: customer } = await admin
    .from("customers")
    .select("name, whatsapp, address, pincode")
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  if (!customer) return <CheckoutClient />;

  return (
    <CheckoutClient
      initialProfile={{
        name: customer.name ?? "",
        whatsapp: customer.whatsapp ?? "",
        address: customer.address ?? "",
        pincode: customer.pincode ?? "",
      }}
    />
  );
}
