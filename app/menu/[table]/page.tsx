import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MenuExperience } from "@/components/menu/MenuExperience";

export const metadata: Metadata = {
  title: "المنيو",
  description: "اختار مشروبك من منيو Yapa واطلبه مباشرة على ترابيزتك.",
};

export default async function MenuPage({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  if (!/^\d{1,3}$/.test(table) || Number(table) < 1) redirect("/menu/12");
  return <MenuExperience tableNumber={String(Number(table))} />;
}
