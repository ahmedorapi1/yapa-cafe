"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#100d0b] px-6 text-center text-stone-100">
      <div>
        <p className="font-serif text-3xl tracking-[0.18em] text-amber-200" dir="ltr">
          YAPA
        </p>
        <h1 className="mt-6 text-2xl font-semibold">حصلت مشكلة بسيطة</h1>
        <p className="mt-3 text-sm text-stone-400">جرّب تفتح الصفحة تاني.</p>
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-amber-300 px-6 py-3 text-sm font-bold text-stone-950"
        >
          حاول مرة تانية
        </button>
      </div>
    </main>
  );
}
