"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.button
            aria-label="إغلاق"
            className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-[5px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.section
            className={`relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-white/[0.08] bg-[#17120f] shadow-[0_-28px_80px_rgba(0,0,0,.5)] sm:rounded-[2rem] ${className}`}
            initial={{ y: "100%", opacity: 0.4, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between bg-[#17120f]/90 px-5 pb-2 pt-3 backdrop-blur-xl sm:rounded-t-[2rem]">
              <span className="h-1 w-12 rounded-full bg-stone-600 sm:hidden" />
              <span className="hidden text-sm font-semibold text-stone-300 sm:block">
                {title}
              </span>
              <button
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-stone-300 transition hover:bg-white/[0.12] hover:text-white"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
