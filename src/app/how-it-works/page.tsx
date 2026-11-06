import type { Metadata } from "next";
import HowItWorksClient from "./_client";

export const metadata: Metadata = {
  title: "How It Works — Portal",
  description: "Learn how Portal connects Indian buyers with verified travelers flying into India. Request products, compare quotes, and complete verified handovers.",
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}