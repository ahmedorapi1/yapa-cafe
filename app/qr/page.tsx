import type { Metadata } from "next";
import Image from "next/image";

import qrManifest from "@/public/qrs/manifest.json";
import { BrandMark } from "@/components/shared/BrandMark";

export const metadata: Metadata = {
  title: "Table QR Codes",
  description: "QR codes for Yapa Tables 1, 2, and 3.",
};

export default function QrCodesPage() {
  return (
    <main className="menu-shell min-h-dvh px-5 py-6 text-stone-50 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <BrandMark />
        <div className="mt-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/60" dir="ltr">
            MVP table setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold">QR Codes</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-stone-400">
            اعرض أو حمّل كود كل ترابيزة. كل كود يفتح رقم الترابيزة تلقائيًا.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {qrManifest.entries.map((entry) => (
            <article
              key={entry.table}
              className="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.04] p-4"
            >
              <div className="overflow-hidden rounded-[1.15rem] bg-[#fffdf9] p-3">
                <Image
                  src={entry.image}
                  alt={`QR code for Table ${entry.table}`}
                  width={720}
                  height={720}
                  className="h-auto w-full"
                  priority
                />
              </div>
              <h2 className="mt-4 text-xl font-semibold" dir="ltr">
                Table {entry.table}
              </h2>
              <p className="mt-2 break-all text-[10px] leading-5 text-stone-500" dir="ltr">
                {entry.url}
              </p>
              <a
                href={entry.image}
                download={`yapa-table-${entry.table}.png`}
                className="mt-4 flex h-11 items-center justify-center rounded-full bg-amber-300 text-sm font-bold text-[#21150b] transition hover:bg-amber-200"
              >
                Download PNG
              </a>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
