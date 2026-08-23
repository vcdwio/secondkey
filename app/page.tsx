import type { Metadata } from "next";
import { ContextOpsControlRoom } from "@/components/contextops-control-room";

export const metadata: Metadata = {
  title: "SecondKey — Governed Enterprise Agents",
  description: "Autonomy until it matters. Reversible actions run; irreversible actions wait for a human.",
};

export default function Home() {
  return <ContextOpsControlRoom />;
}
