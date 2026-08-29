import type { Metadata } from "next";

import { MenuExperience } from "@/components/menu/MenuExperience";
import { BrandMark } from "@/components/shared/BrandMark";

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
  if (!(["1", "2", "3"] as const).includes(table as "1" | "2" | "3")) {
    return (
      <main className="menu-shell grid min-h-dvh place-items-center px-6 text-center text-stone-50">
        <div>
          <div className="flex justify-center">
            <BrandMark />
          </div>
          <h1 className="mt-8 text-3xl font-semibold">Invalid table</h1>
          <p className="mt-3 text-sm leading-7 text-stone-400">
            رابط الترابيزة غير صالح. امسح QR الموجود على الترابيزة مرة تانية.
          </p>
        </div>
      </main>
    );
  }
  return <MenuExperience tableNumber={table} />;
}
