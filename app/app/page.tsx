import type { Metadata } from "next";
import { ContextOpsControlRoom } from "@/components/contextops-control-room";

export const metadata: Metadata = {
  title: "SecondKey — Control Room",
  description: "The Monday-morning triage surface: computed priorities, evidence, and the approval gate.",
};

export default function ControlRoomPage() {
  return <ContextOpsControlRoom />;
}
