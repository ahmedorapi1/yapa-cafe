import type { Metadata } from "next";

import { StaffDashboard } from "@/components/staff/StaffDashboard";

export const metadata: Metadata = {
  title: { absolute: "Frosty — Staff Dashboard" },
  description: "لوحة طلبات Frosty المباشرة.",
};

export default function StaffPage() {
  return <StaffDashboard />;
}
