import type { Metadata } from "next";
import { TryItPage } from "@/components/try-it";

export const metadata: Metadata = {
  title: "SecondKey — Try it yourself",
  description: "Run the live agent on Google Cloud from your own terminal, and watch where it stops.",
};

export default function Try() {
  return <TryItPage />;
}
