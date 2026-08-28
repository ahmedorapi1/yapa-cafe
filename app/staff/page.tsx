import type { Metadata } from "next";

import { StaffDashboard } from "@/components/staff/StaffDashboard";

export const metadata: Metadata = {
  title: "Staff Dashboard",
  description: "لوحة طلبات Yapa المباشرة.",
};

export default function StaffPage() {
  return <StaffDashboard />;
}
