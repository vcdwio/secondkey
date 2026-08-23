import type { Metadata } from "next";
import { ContextOpsControlRoom } from "@/components/contextops-control-room";

export const metadata: Metadata = {
  title: "Verge AI - The Fortified Enterprise Fleet",
  description: "A fortified, evidence-backed operating fleet for client operations, resource allocation and governed approval.",
};

export default function Home() {
  return <ContextOpsControlRoom />;
}
