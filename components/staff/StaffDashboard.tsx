"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  BellRing,
  Check,
  ChefHat,
  CircleCheckBig,
  Clock3,
  Coffee,
  RefreshCw,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { statusCopy } from "@/lib/data/products";
import {
  isSupabaseConfigured,
  loadOrders,
  resetDemo,
  subscribeToOrders,
  updateOrderStatus,
} from "@/lib/orders/service";
import type { CafeOrder, OrderStatus } from "@/types";

const REALTIME_ERROR = "انقطع التحديث المباشر مؤقتًا. بنحاول نتصل تاني.";

type StaffFilter = "ALL" | "UNPAID" | OrderStatus;

const filters: Array<{ id: StaffFilter; label: string }> = [
  { id: "ALL", label: "الكل" },
  { id: "NEW", label: "جديد" },
  { id: "PREPARING", label: "قيد التحضير" },
  { id: "READY", label: "جاهز" },
  { id: "SERVED", label: "تم التقديم" },
  { id: "UNPAID", label: "غير مدفوع" },
  { id: "PAID", label: "مدفوع" },
  { id: "REJECTED", label: "مرفوض" },
];

const statusStyles: Record<OrderStatus, string> = {
  NEW: "bg-amber-300/12 text-amber-200 ring-amber-200/15",
  PREPARING: "bg-sky-300/10 text-sky-200 ring-sky-200/15",
  READY: "bg-emerald-300/10 text-emerald-200 ring-emerald-200/15",
  SERVED: "bg-violet-300/10 text-violet-200 ring-violet-200/15",
  PAID: "bg-emerald-300/12 text-emerald-200 ring-emerald-200/20",
  REJECTED: "bg-red-300/10 text-red-200 ring-red-200/15",
};

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatPrice(price: number) {
  return `${price.toLocaleString("en-US")} EGP`;
}

function OrderCard({
  order,
  onStatus,
  busy,
}: {
  order: CafeOrder;
  onStatus: (status: OrderStatus) => void;
  busy: boolean;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`overflow-hidden rounded-[1.6rem] border bg-[#181411] shadow-[0_22px_60px_rgba(0,0,0,.22)] ${
        order.status === "NEW" ? "border-amber-200/20" : "border-white/[0.065]"
      } ${
        order.status === "PAID" || order.status === "REJECTED"
          ? "opacity-70"
          : ""
      }`}
    >
      {order.status === "NEW" && (
        <div className="flex items-center justify-between bg-amber-300 px-5 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#25170c]">
          <span>طلب جديد</span>
          <BellRing size={13} />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
              الترابيزة
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-white" dir="ltr">
              {order.tableNumber}
            </p>
          </div>
          <div className="text-left">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ring-1 ${statusStyles[order.status]}`}
            >
              {statusCopy[order.status].staffLabel}
            </span>
            <p className="mt-3 text-xs text-stone-500" dir="ltr">
              Order #{order.displayId}
            </p>
          </div>
        </div>

        <div className="my-5 h-px bg-white/[0.065]" />

        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={`${order.id}-${item.productId}`} className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-stone-200" dir="ltr">
                <span className="font-bold text-amber-200">{item.quantity} ×</span>{" "}
                {item.productName}
              </p>
              <span className="shrink-0 text-xs text-stone-500" dir="ltr">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-end justify-between rounded-2xl bg-white/[0.035] p-4">
          <div>
            <p className="text-[10px] text-stone-500">الإجمالي</p>
            <p className="mt-1 text-lg font-bold text-amber-200" dir="ltr">
              {formatPrice(order.total)}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-stone-400" dir="ltr">
            <Clock3 size={13} /> {formatTime(order.createdAt)}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          {order.status === "NEW" && (
            <>
              <button
                disabled={busy}
                onClick={() => onStatus("PREPARING")}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-amber-300 text-sm font-bold text-[#21150b] transition hover:bg-amber-200 disabled:opacity-50"
              >
                <ChefHat size={16} /> ابدأ التحضير
              </button>
              <button
                disabled={busy}
                onClick={() => onStatus("REJECTED")}
                className="grid size-11 place-items-center rounded-full bg-red-300/10 text-red-200 transition hover:bg-red-300/15 disabled:opacity-50"
                aria-label="رفض الطلب"
              >
                <X size={17} />
              </button>
            </>
          )}
          {order.status === "PREPARING" && (
            <>
              <button
                disabled={busy}
                onClick={() => onStatus("READY")}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-300 text-sm font-bold text-[#102117] transition hover:bg-emerald-200 disabled:opacity-50"
              >
                <BellRing size={16} /> جاهز للتقديم
              </button>
              <button
                disabled={busy}
                onClick={() => onStatus("REJECTED")}
                className="grid size-11 place-items-center rounded-full bg-red-300/10 text-red-200 transition hover:bg-red-300/15 disabled:opacity-50"
                aria-label="رفض الطلب"
              >
                <X size={17} />
              </button>
            </>
          )}
          {order.status === "READY" && (
            <button
              disabled={busy}
              onClick={() => onStatus("SERVED")}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-stone-100 text-sm font-bold text-stone-950 transition hover:bg-white disabled:opacity-50"
            >
              <Check size={16} /> تم التقديم
            </button>
          )}
          {order.status === "SERVED" && (
            <button
              disabled={busy}
              onClick={() => onStatus("PAID")}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-300 text-sm font-bold text-[#102117] transition hover:bg-emerald-200 disabled:opacity-50"
            >
              <CircleCheckBig size={16} /> تأكيد الدفع
            </button>
          )}
          {(order.status === "PAID" || order.status === "REJECTED") && (
            <div className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.035] text-xs text-stone-500">
              <CircleCheckBig size={15} /> لا يوجد إجراء مطلوب
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function StaffDashboard() {
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [filter, setFilter] = useState<StaffFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setError("");
    try {
      setOrders(await loadOrders());
    } catch {
      setError("تعذّر تحميل الطلبات. جرّب التحديث.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToOrders((incoming) => {
      setOrders(incoming);
      setLoading(false);
    }, {
      onConnected: () => {
        setRealtimeConnected(true);
        setError((current) => (current === REALTIME_ERROR ? "" : current));
      },
      onError: () => {
        setRealtimeConnected(false);
        setError(REALTIME_ERROR);
      },
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const visibleOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          if (filter === "ALL") return true;
          if (filter === "UNPAID") return order.status !== "PAID";
          return order.status === filter;
        })
        .sort((a, b) => {
          if (filter === "ALL") {
            const aFinished = a.status === "PAID" || a.status === "REJECTED";
            const bFinished = b.status === "PAID" || b.status === "REJECTED";
            if (aFinished !== bFinished) return aFinished ? 1 : -1;
          }
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        }),
    [orders, filter],
  );

  const summary = {
    NEW: orders.filter((order) => order.status === "NEW").length,
    PREPARING: orders.filter((order) => order.status === "PREPARING").length,
    READY: orders.filter((order) => order.status === "READY").length,
  };

  const changeStatus = async (order: CafeOrder, status: OrderStatus) => {
    setBusyId(order.id);
    setError("");
    try {
      await updateOrderStatus(order.id, status);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? { ...item, status } : item)),
      );
    } catch {
      setError("تعذّر تحديث حالة الطلب. جرّب مرة تانية.");
    } finally {
      setBusyId(null);
    }
  };

  // DEMO ONLY: remove or protect this control before a production rollout.
  const clearDemo = async () => {
    setResetting(true);
    setError("");
    setNotice("");
    try {
      await resetDemo();
      setOrders(await loadOrders());
      setFilter("ALL");
      setResetOpen(false);
      setNotice("تم مسح الطلبات المدفوعة والمرفوضة بنجاح");
    } catch {
      setError("تعذّر تنظيف طلبات الديمو. جرّب مرة تانية.");
    } finally {
      setResetting(false);
    }
  };

  const configured = isSupabaseConfigured();
  const connectionLabel = !configured
    ? "وضع العرض المحلي"
    : realtimeConnected
      ? "متصل مباشر"
      : "جاري إعادة الاتصال";

  return (
    <>
      <main className="staff-shell min-h-dvh text-stone-50">
      <header className="border-b border-white/[0.06] bg-[#100d0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-5">
            <Image
              src="/frosty-logo.jpg"
              alt="Frosty"
              width={96}
              height={36}
              priority
              className="h-9 w-24 object-cover object-center"
            />
            <div className="hidden h-7 w-px bg-white/10 sm:block" />
            <div>
              <p className="text-sm font-semibold text-stone-100">Frosty Staff</p>
              <p className="mt-0.5 text-[10px] text-stone-500">لوحة الطلبات المباشرة</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs text-stone-400">
            <span
              className={`size-2 rounded-full ${
                !configured
                  ? "bg-stone-500"
                  : realtimeConnected
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.6)]"
                    : "animate-pulse bg-amber-300"
              }`}
            />
            {connectionLabel}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/60" dir="ltr">
              Live service
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              الطلبات الحالية
            </h1>
            <p className="mt-2 text-sm text-stone-500">أحدث الطلبات تظهر هنا لحظة بلحظة.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setResetOpen(true)}
              className="flex h-10 w-fit items-center gap-2 rounded-full px-3 text-[11px] text-stone-500 ring-1 ring-white/[0.055] transition hover:bg-red-300/[0.06] hover:text-red-200"
            >
              <Trash2 size={13} /> Reset Demo
            </button>
            <button
              onClick={refresh}
              className="flex h-10 w-fit items-center gap-2 rounded-full bg-white/[0.05] px-4 text-xs text-stone-300 ring-1 ring-white/[0.06] transition hover:bg-white/[0.08]"
            >
              <RefreshCw size={14} /> تحديث
            </button>
          </div>
        </div>

        <section className="mt-7 grid grid-cols-3 gap-3 sm:max-w-2xl sm:gap-4">
          {[
            { id: "NEW" as const, label: "طلبات جديدة", value: summary.NEW, icon: Coffee },
            {
              id: "PREPARING" as const,
              label: "قيد التحضير",
              value: summary.PREPARING,
              icon: ChefHat,
            },
            { id: "READY" as const, label: "جاهزة", value: summary.READY, icon: UtensilsCrossed },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className="rounded-[1.35rem] bg-white/[0.04] p-4 text-right ring-1 ring-white/[0.055] transition hover:bg-white/[0.065] sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xl font-bold text-white" dir="ltr">
                    {item.value}
                  </span>
                  <span className="grid size-8 place-items-center rounded-full bg-amber-200/[0.08] text-amber-200">
                    <Icon size={15} />
                  </span>
                </div>
                <p className="mt-4 text-[10px] leading-4 text-stone-500 sm:text-xs">{item.label}</p>
              </button>
            );
          })}
        </section>

        <div className="mt-8 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-semibold transition ${
                filter === item.id
                  ? "bg-amber-300 text-[#21150b]"
                  : "bg-white/[0.045] text-stone-400 ring-1 ring-white/[0.055] hover:text-stone-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-300/[0.07] p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.07] p-4 text-sm text-emerald-100">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-96 animate-pulse rounded-[1.6rem] bg-white/[0.035]" />
            ))}
          </div>
        ) : visibleOrders.length ? (
          <motion.section layout className="mt-6 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                busy={busyId === order.id}
                onStatus={(status) => changeStatus(order, status)}
              />
            ))}
          </motion.section>
        ) : (
          <div className="mt-6 grid min-h-80 place-items-center rounded-[1.8rem] border border-dashed border-white/[0.08] bg-white/[0.02] px-6 text-center">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/[0.04] text-stone-500">
                <Coffee size={26} strokeWidth={1.5} />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-stone-200">لا توجد طلبات حالياً</h2>
              <p className="mt-2 text-sm text-stone-500">الطلبات الجديدة هتظهر هنا فوراً.</p>
            </div>
          </div>
        )}
      </div>
      </main>

      <AnimatePresence>
        {resetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm"
            onClick={() => !resetting && setResetOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-demo-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-[1.6rem] border border-white/[0.08] bg-[#181411] p-6 text-right shadow-2xl"
            >
              <span className="grid size-11 place-items-center rounded-full bg-red-300/10 text-red-200">
                <Trash2 size={18} />
              </span>
              <h2 id="reset-demo-title" className="mt-5 text-xl font-semibold text-white">
                هل تريد مسح الطلبات المنتهية؟
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                سيتم مسح الطلبات المدفوعة والمرفوضة فقط. الطلبات الجديدة وقيد
                التحضير والجاهزة والمقدمة ستبقى كما هي، ولن تتأثر منتجات المنيو.
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  disabled={resetting}
                  onClick={() => setResetOpen(false)}
                  className="h-11 flex-1 rounded-full bg-white/[0.05] text-sm font-semibold text-stone-300 ring-1 ring-white/[0.07] disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  disabled={resetting}
                  onClick={() => void clearDemo()}
                  className="h-11 flex-1 rounded-full bg-red-300 text-sm font-bold text-[#2a1111] transition hover:bg-red-200 disabled:opacity-50"
                >
                  {resetting ? "جاري المسح..." : "مسح المنتهية"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
