export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3" aria-label="Yapa Café">
      <span
        className={`grid shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-200/[0.08] text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,.1)] ${compact ? "size-9 text-lg" : "size-11 text-xl"}`}
        aria-hidden="true"
      >
        ي
      </span>
      <span className="leading-none">
        <span
          className={`block font-serif tracking-[0.16em] text-stone-50 ${compact ? "text-xl" : "text-2xl"}`}
          dir="ltr"
        >
          YAPA
        </span>
        {!compact && (
          <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.34em] text-amber-200/65">
            café
          </span>
        )}
      </span>
    </div>
  );
}
