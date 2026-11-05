import type { Metadata } from "next";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { ProductRequestForm } from "@/components/buyer/product-request-form";

export const metadata: Metadata = { title: "New product request" };

export default function NewBuyerRequestPage() {
  return (
    <BuyerShell active="new-request">
      <ProductRequestForm />
    </BuyerShell>
  );
}
