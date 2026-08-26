import type { Metadata } from "next";
import { Cover } from "@/components/cover";

export const metadata: Metadata = {
  title: "SecondKey — Governed Enterprise Agents",
  description: "Autonomy until it matters. Reversible actions run; irreversible actions wait for a human.",
};

export default function Home() {
  return <Cover />;
}
