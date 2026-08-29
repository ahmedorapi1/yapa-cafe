"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  TimerOff,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { categories, products, statusCopy } from "@/lib/data/products";
import {
  createOrRestoreSession,
  createOrder,
  loadOrder,
  OrderServiceError,
  SessionServiceError,
  subscribeToOrder,
} from "@/lib/orders/service";
import {
  getCustomerVisibleStatus,
  maskPaidOrderForCustomer,
} from "@/lib/orders/customer-status";
import { parseMenuEntryUrl } from "@/lib/orders/menu-url";
import type {
  CafeOrder,
  CartItem,
  Category,
  OrderingSession,
  Product,
} from "@/types";
import { BottomSheet } from "@/components/shared/BottomSheet";
import { BrandMark } from "@/components/shared/BrandMark";

const categoryPresentation: Record<
  Category,
  {
    sectionId: string;
    image: string;
    treatment: string;
    glow: string;
    accent: string;
    arrow: string;
  }
> = {
  hot: {
    sectionId: "hot-drinks",
    image: "/products/2.png",
    treatment:
      "border-amber-200/20 bg-[linear-gradient(118deg,rgba(35,17,8,.9)_4%,rgba(91,43,13,.5)_51%,rgba(255,169,57,.12)_100%)] shadow-[0_24px_60px_rgba(38,17,6,.4)]",
    glow: "bg-amber-300/25",
    accent: "bg-amber-200",
    arrow: "bg-amber-100/15 text-amber-50 ring-amber-100/20",
  },
  fresh: {
    sectionId: "fresh-drinks",
    image: "/products/4.png",
    treatment:
      "border-lime-200/20 bg-[linear-gradient(118deg,rgba(8,28,17,.9)_4%,rgba(32,78,24,.5)_51%,rgba(213,255,76,.12)_100%)] shadow-[0_24px_60px_rgba(8,31,17,.38)]",
    glow: "bg-lime-300/20",
    accent: "bg-lime-200",
    arrow: "bg-lime-100/15 text-lime-50 ring-lime-100/20",
  },
  cold: {
    sectionId: "cold-drinks",
    image: "/products/5.png",
    treatment:
      "border-cyan-100/20 bg-[linear-gradient(118deg,rgba(7,22,35,.9)_4%,rgba(17,67,87,.5)_51%,rgba(117,231,255,.12)_100%)] shadow-[0_24px_60px_rgba(5,24,40,.4)]",
    glow: "bg-cyan-200/20",
    accent: "bg-cyan-100",
    arrow: "bg-cyan-50/15 text-cyan-50 ring-cyan-50/20",
  },
};

const statusSteps = ["NEW", "PREPARING", "READY", "SERVED"] as const;
const QR_REQUIRED_MESSAGE =
  "لإجراء طلب جديد، امسح QR الموجود على الترابيزة.";

function formatPrice(price: number) {
  return `${price.toLocaleString("en-US")} EGP`;
}

function sessionKey(tableNumber: string) {
  return `yapa_session_table_${tableNumber}`;
}

function timestamp() {
  return Date.now();
}

function ProductCard({
  product,
  onOpen,
  onQuickAdd,
}: {
  product: Product;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  return (
    <motion.article
      layout
      role="button"
      tabIndex={0}
      aria-label={`عرض ${product.name}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      whileTap={{ scale: 0.975 }}
      className="group cursor-pointer overflow-hidden rounded-[1.6rem] bg-[#1c1612] shadow-[0_18px_50px_rgba(0,0,0,.2)] ring-1 ring-white/[0.055] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-stone-900">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 23vw"
          priority
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#1c1612] to-transparent" />
        <button
          onClick={(event) => {
            event.stopPropagation();
            onQuickAdd();
          }}
          className="absolute bottom-3 left-3 grid size-10 place-items-center rounded-full bg-amber-300 text-[#20150b] shadow-[0_10px_25px_rgba(245,190,88,.24)] transition hover:bg-amber-200 active:scale-90"
          aria-label={`أضف ${product.name}`}
        >
          <Plus size={19} strokeWidth={2.4} />
        </button>
      </div>
      <div className="px-4 pb-4 pt-2.5">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-stone-50" dir="ltr">
          {product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="line-clamp-1 text-[11px] text-stone-400">{product.description}</p>
          <span className="shrink-0 text-xs font-bold text-amber-200" dir="ltr">
            {formatPrice(product.price)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export function MenuExperience({ tableNumber }: { tableNumber: string }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [session, setSession] = useState<OrderingSession | null>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<CafeOrder | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [statusSyncError, setStatusSyncError] = useState("");

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const customerOrderStatus = currentOrder
    ? getCustomerVisibleStatus(currentOrder.status)
    : null;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const key = sessionKey(tableNumber);
      let savedSession: OrderingSession | null = null;
      try {
        const saved = localStorage.getItem(key);
        savedSession = saved ? (JSON.parse(saved) as OrderingSession) : null;
      } catch {
        savedSession = null;
      }

      const savedOrderId = localStorage.getItem(`yapa_active_order_${tableNumber}`);
      if (savedOrderId) setCurrentOrderId(savedOrderId);

      const { tableQrToken, shouldCleanUrl, cleanUrl } = parseMenuEntryUrl(
        window.location.href,
      );

      void createOrRestoreSession(tableNumber, savedSession, tableQrToken)
        .then((activeSession) => {
          if (cancelled) return;
          if (shouldCleanUrl) {
            window.history.replaceState(null, "", cleanUrl);
          }
          if (!activeSession) {
            localStorage.removeItem(key);
            setSession(null);
            setExpired(false);
            setSessionError(QR_REQUIRED_MESSAGE);
            return;
          }
          localStorage.setItem(key, JSON.stringify(activeSession));
          setSession(activeSession);
          const sessionExpired =
            !activeSession.active ||
            Date.parse(activeSession.expiresAt) <= timestamp();
          setExpired(sessionExpired);
          setSessionError("");
        })
        .catch((error) => {
          if (cancelled) return;
          if (shouldCleanUrl) {
            window.history.replaceState(null, "", cleanUrl);
          }
          setSession(null);
          setExpired(false);
          setSessionError(
            error instanceof SessionServiceError &&
              error.code === "INVALID_TABLE_QR_TOKEN"
              ? QR_REQUIRED_MESSAGE
              : "تعذّر بدء جلسة الطلب دلوقتي. اتأكد من الإنترنت وامسح QR مرة تانية.",
          );
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tableNumber]);

  useEffect(() => {
    if (!session) return;
    const updateExpiry = () =>
      setExpired(
        !session.active || Date.parse(session.expiresAt) <= timestamp(),
      );
    updateExpiry();
    const timer = window.setInterval(updateExpiry, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!currentOrderId) return;
    void loadOrder(currentOrderId)
      .then((order) => {
        if (order) setCurrentOrder(maskPaidOrderForCustomer(order));
      })
      .catch(() => setStatusSyncError("تعذّر تحديث حالة الطلب مؤقتًا."));
    return subscribeToOrder(
      currentOrderId,
      (order) => setCurrentOrder(maskPaidOrderForCustomer(order)),
      {
        onConnected: () => setStatusSyncError(""),
        onError: () =>
          setStatusSyncError("تعذّر تحديث حالة الطلب مؤقتًا. بنحاول نتصل تاني."),
      },
    );
  }, [currentOrderId]);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...current, { product, quantity }];
    });
  }, []);

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setDetailQuantity(1);
    setIngredientsOpen(false);
  };

  const scrollToCategory = useCallback((category: Category) => {
    document
      .getElementById(categoryPresentation[category].sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const placeOrder = async () => {
    if (!session || expired || !cart.length || submitting) return;
    setSubmitError("");
    const fingerprint = JSON.stringify(
      cart.map((item) => [item.product.id, item.quantity]).sort(),
    );
    const duplicateKey = `yapa_last_submit_${tableNumber}`;
    try {
      const previous = JSON.parse(localStorage.getItem(duplicateKey) ?? "null") as {
        fingerprint: string;
        time: number;
      } | null;
      if (
        previous?.fingerprint === fingerprint &&
        timestamp() - previous.time < 8000
      ) {
        return;
      }
    } catch {
      // A malformed demo cache should never block ordering.
    }

    setSubmitting(true);
    localStorage.setItem(
      duplicateKey,
      JSON.stringify({ fingerprint, time: timestamp() }),
    );

    try {
      const order = await createOrder({
        tableNumber,
        sessionId: session.id,
        total,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
        })),
      });
      localStorage.setItem(`yapa_active_order_${tableNumber}`, order.id);
      setCurrentOrderId(order.id);
      setCurrentOrder(maskPaidOrderForCustomer(order));
      setCart([]);
      setCartOpen(false);
      setStatusOpen(true);
    } catch (error) {
      if (
        error instanceof OrderServiceError &&
        error.code === "SESSION_EXPIRED"
      ) {
        setExpired(true);
        setSubmitError(
          "انتهت جلسة الطلب. من فضلك اعمل Scan للـ QR الموجود على الترابيزة مرة تانية.",
        );
      } else {
        setSubmitError("حصلت مشكلة بسيطة. جرّب تأكيد الطلب مرة تانية.");
      }
      localStorage.removeItem(duplicateKey);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="menu-shell min-h-dvh overflow-x-hidden pb-32 text-stone-50">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_78%_8%,rgba(222,154,64,.12),transparent_58%)]" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-7 pt-5 sm:px-8 sm:pt-7">
        <BrandMark />
        <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.045] px-3 py-2 text-xs text-stone-300 backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.75)]" />
          <span dir="ltr">Table {tableNumber}</span>
        </div>
      </header>

      <section className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="max-w-xl"
        >
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-200/80">
            <Sparkles size={15} /> أهلاً بيك في Yapa
          </p>
          <h1 className="text-balance text-[2rem] font-semibold leading-[1.28] tracking-tight text-stone-50 sm:text-5xl">
            تحب تطلب إيه النهارده؟
          </h1>
          <p className="mt-3 max-w-md text-sm leading-7 text-stone-400">
            اختار مشروبك، وإحنا هنحضّرهولك بكل هدوء على ترابيزتك.
          </p>
        </motion.div>

        {expired && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-start gap-3 rounded-2xl border border-red-300/15 bg-red-300/[0.07] p-4 text-sm leading-6 text-red-100"
          >
            <TimerOff className="mt-0.5 shrink-0" size={18} />
            <p>
              {QR_REQUIRED_MESSAGE} تقدر تتفرج على المنيو، لكن تأكيد طلب جديد
              متوقف.
            </p>
          </motion.div>
        )}

        {sessionError && (
          <div className="mt-6 rounded-2xl border border-red-300/15 bg-red-300/[0.07] p-4 text-sm leading-6 text-red-100">
            {sessionError}
          </div>
        )}

        {currentOrder && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setStatusOpen(true)}
            className="mt-6 flex w-full items-center justify-between rounded-[1.35rem] border border-amber-200/15 bg-amber-200/[0.06] p-4 text-right transition hover:bg-amber-200/[0.09]"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-amber-300 text-stone-950">
                <ClipboardList size={18} />
              </span>
              <span>
                <span className="block text-xs text-stone-400" dir="ltr">
                  Order #{currentOrder.displayId}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-stone-100">
                  {statusCopy[customerOrderStatus ?? "SERVED"].label}
                </span>
              </span>
            </span>
            <span className="text-xs text-amber-200">تابع طلبك</span>
          </motion.button>
        )}

        <div className="mt-9">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-200/60" dir="ltr">
                Explore the menu
              </p>
              <h2 className="mt-1 text-xl font-semibold text-stone-100">اختار عالم مشروبك</h2>
            </div>
            <span className="text-xs text-stone-500">اسحب للتصفح</span>
          </div>

          <div
            className="-mx-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0"
            aria-label="أقسام المشروبات"
          >
            {categories.map((category, index) => {
              const presentation = categoryPresentation[category.id];
              const productCount = products.filter(
                (product) => product.category === category.id,
              ).length;

              return (
                <motion.button
                  key={category.id}
                  type="button"
                  aria-controls={presentation.sectionId}
                  onClick={() => scrollToCategory(category.id)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * index, duration: 0.38 }}
                  whileTap={{ scale: 0.985 }}
                  className={`group relative h-[11.75rem] w-[82vw] max-w-[22rem] shrink-0 snap-start overflow-hidden rounded-[1.65rem] border text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto ${presentation.treatment}`}
                >
                  <Image
                    src={presentation.image}
                    alt=""
                    fill
                    sizes="(max-width: 639px) 82vw, 33vw"
                    priority={index === 0}
                    className="object-cover object-center opacity-[0.78] transition duration-700 group-hover:scale-[1.025] group-hover:opacity-[0.84]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-l from-black/15 via-black/20 to-black/65" />
                  <span
                    className={`absolute -left-8 -top-10 size-32 rounded-full blur-3xl ${presentation.glow}`}
                  />

                  <span className="absolute inset-x-4 top-4 flex items-center justify-between">
                    <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-md">
                      {productCount.toLocaleString("ar-EG")} مشروب
                    </span>
                    <span
                      className={`grid size-9 place-items-center rounded-full ring-1 backdrop-blur-md ${presentation.arrow}`}
                    >
                      <ArrowLeft size={16} strokeWidth={1.8} />
                    </span>
                  </span>

                  <span className="absolute inset-x-5 bottom-5">
                    <span className={`mb-3 block h-0.5 w-8 rounded-full ${presentation.accent}`} />
                    <span className="block text-[1.35rem] font-semibold leading-none tracking-tight text-white">
                      {category.label}
                    </span>
                    <span
                      className="mt-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/65"
                      dir="ltr"
                    >
                      {category.eyebrow}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="mt-12 space-y-16">
          {categories.map((category, index) => {
            const presentation = categoryPresentation[category.id];
            const categoryProducts = products.filter(
              (product) => product.category === category.id,
            );
            const headingId = `${presentation.sectionId}-heading`;

            return (
              <motion.section
                key={category.id}
                id={presentation.sectionId}
                aria-labelledby={headingId}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.08 }}
                transition={{ duration: 0.4, delay: index * 0.04 }}
                className="scroll-mt-8"
              >
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div className="flex items-stretch gap-3">
                    <span className={`w-0.5 rounded-full ${presentation.accent}`} />
                    <div>
                      <h2
                        id={headingId}
                        className="text-xl font-semibold tracking-tight text-stone-100"
                      >
                        {category.label}
                      </h2>
                      <p
                        className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500"
                        dir="ltr"
                      >
                        {category.eyebrow}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-stone-500">
                    {categoryProducts.length.toLocaleString("ar-EG")} مشروب
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                  {categoryProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpen={() => openProduct(product)}
                      onQuickAdd={() => addToCart(product)}
                    />
                  ))}
                </div>
              </motion.section>
            );
          })}
        </div>
      </section>

      <BottomSheet
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name ?? "تفاصيل المشروب"}
      >
        {selectedProduct && (
          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-[16/12] overflow-hidden rounded-[1.55rem] bg-stone-900"
            >
              <Image
                src={selectedProduct.image}
                alt={selectedProduct.name}
                fill
                sizes="(max-width: 640px) 100vw, 576px"
                priority
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-4 right-4 rounded-full bg-black/45 px-3 py-1.5 text-xs text-stone-200 backdrop-blur-md">
                {selectedProduct.categoryLabel}
              </span>
            </motion.div>

            <div className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white" dir="ltr">
                    {selectedProduct.name}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-stone-400">
                    {selectedProduct.description}
                  </p>
                </div>
                <span className="shrink-0 text-base font-bold text-amber-200" dir="ltr">
                  {formatPrice(selectedProduct.price)}
                </span>
              </div>

              <button
                onClick={() => setIngredientsOpen((open) => !open)}
                className="mt-5 flex w-full items-center justify-between rounded-2xl bg-white/[0.045] px-4 py-3.5 text-sm text-stone-200 ring-1 ring-white/[0.055]"
              >
                <span>إيه اللي جواه؟</span>
                <motion.span animate={{ rotate: ingredientsOpen ? 180 : 0 }}>
                  <ChevronDown size={17} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {ingredientsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2 px-1 pt-3" dir="ltr">
                      {selectedProduct.ingredients.map((ingredient) => (
                        <span
                          key={ingredient}
                          className="rounded-full border border-amber-200/10 bg-amber-200/[0.055] px-3 py-1.5 text-[11px] text-amber-100/80"
                        >
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6 flex items-center gap-3" dir="ltr">
                <div className="flex h-14 items-center rounded-full bg-white/[0.055] p-1 ring-1 ring-white/[0.06]">
                  <button
                    onClick={() => setDetailQuantity((value) => Math.max(1, value - 1))}
                    className="grid size-11 place-items-center rounded-full text-stone-300 transition hover:bg-white/[0.06]"
                    aria-label="تقليل الكمية"
                  >
                    <Minus size={17} />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-white">
                    {detailQuantity}
                  </span>
                  <button
                    onClick={() => setDetailQuantity((value) => value + 1)}
                    className="grid size-11 place-items-center rounded-full text-stone-300 transition hover:bg-white/[0.06]"
                    aria-label="زيادة الكمية"
                  >
                    <Plus size={17} />
                  </button>
                </div>
                <button
                  onClick={() => {
                    addToCart(selectedProduct, detailQuantity);
                    setSelectedProduct(null);
                  }}
                  className="flex h-14 flex-1 items-center justify-between rounded-full bg-amber-300 px-5 font-bold text-[#22150b] transition hover:bg-amber-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span dir="rtl">أضف للطلب</span>
                  <span className="text-sm" dir="ltr">
                    {formatPrice(selectedProduct.price * detailQuantity)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={cartOpen} onClose={() => setCartOpen(false)} title="طلبك">
        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/60" dir="ltr">
                Your order
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">طلبك</h2>
            </div>
            <span className="text-sm text-stone-400">{itemCount} مشروب</span>
          </div>

          <div className="space-y-3">
            {cart.map((item) => (
              <motion.div
                layout
                key={item.product.id}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.05]"
              >
                <Image
                  src={item.product.image}
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-stone-100" dir="ltr">
                    {item.product.name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-amber-200" dir="ltr">
                    {formatPrice(item.product.price * item.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-1" dir="ltr">
                  <button
                    onClick={() => updateCartQuantity(item.product.id, -1)}
                    className="grid size-8 place-items-center rounded-full bg-white/[0.055] text-stone-300"
                    aria-label="تقليل الكمية"
                  >
                    {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.product.id, 1)}
                    className="grid size-8 place-items-center rounded-full bg-white/[0.055] text-stone-300"
                    aria-label="زيادة الكمية"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-white/[0.07] pt-5 text-sm">
            <div className="flex items-center justify-between text-stone-400">
              <span>المجموع الفرعي</span>
              <span dir="ltr">{formatPrice(total)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold text-white">
              <span>الإجمالي</span>
              <span className="text-amber-200" dir="ltr">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          {submitError && (
            <p className="mt-4 rounded-xl bg-red-300/10 p-3 text-sm text-red-200">
              {submitError}
            </p>
          )}

          <button
            disabled={!cart.length || !session || expired || submitting}
            onClick={placeOrder}
            className="mt-6 flex h-15 w-full items-center justify-center gap-2 rounded-full bg-amber-300 px-6 font-bold text-[#22150b] transition hover:bg-amber-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-stone-900/30 border-t-stone-900" />
                بنأكد طلبك…
              </>
            ) : (
              <>
                <Check size={19} /> تأكيد الطلب
              </>
            )}
          </button>
          <p className="mt-3 text-center text-[11px] text-stone-500">
            مفيش دفع أونلاين — الحساب مع فريق Yapa
          </p>
        </div>
      </BottomSheet>

      <BottomSheet open={statusOpen} onClose={() => setStatusOpen(false)} title="حالة الطلب">
        {currentOrder && (
          <div className="px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2 text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto grid size-20 place-items-center rounded-full bg-amber-300/10 text-amber-200 ring-1 ring-amber-200/20"
            >
              {currentOrder.status === "REJECTED" ? (
                <TimerOff size={34} />
              ) : (
                <CheckCircle2 size={36} strokeWidth={1.7} />
              )}
            </motion.div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-amber-200/65" dir="ltr">
              Order received
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              {statusCopy[customerOrderStatus ?? "SERVED"].label}
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-stone-400">
              {statusCopy[customerOrderStatus ?? "SERVED"].detail}
            </p>

            {statusSyncError && (
              <p className="mx-auto mt-3 max-w-sm rounded-xl bg-red-300/10 px-3 py-2 text-xs leading-5 text-red-200">
                {statusSyncError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <span className="rounded-full bg-white/[0.055] px-4 py-2 text-stone-300" dir="ltr">
                Order #{currentOrder.displayId}
              </span>
              <span className="rounded-full bg-white/[0.055] px-4 py-2 text-stone-300" dir="ltr">
                Table {currentOrder.tableNumber}
              </span>
            </div>

            {currentOrder.status !== "REJECTED" && (
              <div className="mt-9 rounded-[1.5rem] bg-white/[0.035] p-5 ring-1 ring-white/[0.055]">
                <div className="flex items-center" dir="ltr">
                  {statusSteps.map((step, index) => {
                    const currentIndex = statusSteps.indexOf(
                      customerOrderStatus as (typeof statusSteps)[number],
                    );
                    const complete = index <= currentIndex;
                    return (
                      <div key={step} className="flex flex-1 items-center last:flex-none">
                        <motion.span
                          animate={{
                            backgroundColor: complete ? "#f5c66f" : "#39312c",
                            scale: index === currentIndex ? 1.12 : 1,
                          }}
                          className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-stone-950"
                        >
                          {complete ? <Check size={13} /> : index + 1}
                        </motion.span>
                        {index < statusSteps.length - 1 && (
                          <span
                            className={`h-px flex-1 ${index < currentIndex ? "bg-amber-300" : "bg-stone-700"}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1 text-[9px] text-stone-500">
                  <span>استلام</span>
                  <span>تحضير</span>
                  <span>جاهز</span>
                  <span>تقديم</span>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-black/20 p-4 text-right">
              {currentOrder.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-stone-300" dir="ltr">
                    {item.quantity} × {item.productName}
                  </span>
                  <span className="text-stone-500" dir="ltr">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>

      <AnimatePresence>
        {itemCount > 0 && !cartOpen && !selectedProduct && !statusOpen && (
          <motion.div
            initial={{ y: 110, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 110, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="mx-auto flex h-16 w-full max-w-lg items-center justify-between rounded-full border border-amber-100/20 bg-amber-300 px-5 text-[#20140b] shadow-[0_20px_60px_rgba(0,0,0,.5)] transition hover:bg-amber-200 active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-stone-950/10">
                  <ShoppingBag size={18} />
                </span>
                <span className="text-right">
                  <span className="block text-xs font-semibold opacity-65">شوف طلبك</span>
                  <span className="block text-sm font-extrabold">{itemCount} مشروب</span>
                </span>
              </span>
              <span className="font-extrabold" dir="ltr">
                {formatPrice(total)}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
