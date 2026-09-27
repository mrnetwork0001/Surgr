import type { Metadata } from "next";
import Cockpit from "@/components/Cockpit";

export const metadata: Metadata = {
  title: "Surgr Cockpit",
  description: "Live operating room transcript, closed-loop order board, WHO checklist and spoken safety alerts.",
};

export default function AppPage() {
  return <Cockpit />;
}
