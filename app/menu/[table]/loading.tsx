export default function MenuLoading() {
  return (
    <main className="menu-shell min-h-dvh px-5 py-6 text-stone-50">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-11 w-32 rounded-full bg-white/[0.055]" />
        <div className="mt-12 h-8 w-64 rounded-full bg-white/[0.055]" />
        <div className="mt-3 h-4 w-48 rounded-full bg-white/[0.04]" />
        <div className="mt-12 grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 rounded-[1.4rem] bg-white/[0.04]" />
          ))}
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3.5">
          {[0, 1].map((item) => (
            <div key={item} className="h-72 rounded-[1.6rem] bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </main>
  );
}
