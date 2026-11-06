import type { Metadata } from "next";
import { BuyerAuthShell } from "@/components/buyer/buyer-auth-shell";
import { BuyerRegisterForm } from "@/components/buyer/buyer-register-form";

export const metadata: Metadata = { title: "Buyer registration" };

export default function BuyerRegisterPage() {
  return (
    <BuyerAuthShell>
      <BuyerRegisterForm />
    </BuyerAuthShell>
  );
}
