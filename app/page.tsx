import type { Metadata } from "next";
import { ContextOpsControlRoom } from "@/components/contextops-control-room";

export const metadata: Metadata = {
  title: "Verge ContextOps — Unit Platform",
  description: "Evidence-backed client operations, resource allocation and approval across ten deployable business Units.",
};

export default function Home() {
  return <ContextOpsControlRoom />;
}
