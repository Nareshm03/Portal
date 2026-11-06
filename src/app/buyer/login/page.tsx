import type { Metadata } from "next";
import { BuyerAuthShell } from "@/components/buyer/buyer-auth-shell";
import { BuyerLoginForm } from "@/components/buyer/buyer-login-form";

export const metadata: Metadata = { title: "Buyer sign in" };

export default function BuyerLoginPage() {
  return (
    <BuyerAuthShell>
      <BuyerLoginForm />
    </BuyerAuthShell>
  );
}
