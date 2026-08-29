"use client";

import {
  getSupabase,
  isSupabaseConfigured,
  logSupabaseError,
} from "@/lib/supabase/client";
import { resolveSessionAccess } from "@/lib/orders/session-access";
import { createUuid } from "@/lib/utils/createId";
import type {
  CafeOrder,
  OrderingSession,
  OrderItemRecord,
  OrderStatus,
} from "@/types";

const ORDERS_KEY = "yapa_demo_orders_v1";
const CHANNEL_NAME = "yapa_orders_channel";
const TERMINAL_STATUSES: OrderStatus[] = ["PAID", "REJECTED"];
const isDevelopment = process.env.NODE_ENV !== "production";

type RealtimeOptions = {
  onConnected?: () => void;
  onError?: () => void;
};

export class OrderServiceError extends Error {
  constructor(
    public readonly code: "SESSION_EXPIRED" | "ORDER_FAILED",
    options?: { cause?: unknown },
  ) {
    super(code);
    this.name = "OrderServiceError";
    this.cause = options?.cause;
  }
}

export class SessionServiceError extends Error {
  constructor(
    public readonly code: "INVALID_TABLE_QR_TOKEN" | "SESSION_FAILED",
    options?: { cause?: unknown },
  ) {
    super(code);
    this.name = "SessionServiceError";
    this.cause = options?.cause;
  }
}

function mapOrder(row: Record<string, unknown>): CafeOrder {
  const rawItems = (row.order_items ?? []) as Array<Record<string, unknown>>;
  return {
    id: String(row.id),
    displayId: Number(row.display_id),
    tableNumber: String(row.table_number),
    status: normalizeOrderStatus(row.status),
    total: Number(row.total),
    sessionId: String(row.session_id),
    createdAt: String(row.created_at),
    items: rawItems.map((item) => ({
      id: String(item.id),
      productId: String(item.product_id),
      productName: String(item.product_name),
      price: Number(item.price),
      quantity: Number(item.quantity),
    })),
  };
}

function normalizeOrderStatus(status: unknown): OrderStatus {
  return status === "COMPLETED" ? "PAID" : (status as OrderStatus);
}

function mapSession(row: Record<string, unknown>): OrderingSession {
  return {
    id: String(row.id),
    tableNumber: String(row.table_number),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    active: Boolean(row.active),
  };
}

function logSessionStatus(session: OrderingSession) {
  if (!isDevelopment) return;
  const expired = isExpiredSession(session);
  console.info(`Session status: ${expired ? "EXPIRED" : "ACTIVE"}`);
  console.info(`Session expires at: ${session.expiresAt}`);
}

function isExpiredSession(session: OrderingSession) {
  return !session.active || Date.parse(session.expiresAt) <= Date.now();
}

function getLocalOrders(): CafeOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const orders = JSON.parse(
      localStorage.getItem(ORDERS_KEY) ?? "[]",
    ) as CafeOrder[];
    return orders.map((order) => ({
      ...order,
      status: normalizeOrderStatus(order.status),
    }));
  } catch {
    return [];
  }
}

function publishLocalOrders(orders: CafeOrder[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent("yapa-orders-updated"));
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage("updated");
    channel.close();
  }
}

export async function createOrRestoreSession(
  tableNumber: string,
  savedSession: OrderingSession | null,
  tableQrToken: string | null,
): Promise<OrderingSession | null> {
  const supabase = getSupabase();
  if (!supabase) {
    // Local fallback can restore its existing device-local demo session, but
    // it cannot securely validate a physical QR token or mint a new session.
    if (savedSession?.tableNumber !== tableNumber) return null;
    logSessionStatus(savedSession);
    return savedSession;
  }

  const session = await resolveSessionAccess({
    tableNumber,
    savedSessionId: savedSession?.id ?? null,
    tableQrToken,
    actions: {
      async startSession(input) {
        const { data, error } = await supabase
          .rpc("start_table_session", {
            p_table_number: input.tableNumber,
            p_table_qr_token: input.tableQrToken,
            p_existing_session_id: input.existingSessionId,
          })
          .single();

        if (error) {
          logSupabaseError("start_table_session RPC", error);
          if (error.message.includes("invalid_table_qr_token")) {
            throw new SessionServiceError("INVALID_TABLE_QR_TOKEN", {
              cause: error,
            });
          }
          throw new SessionServiceError("SESSION_FAILED", { cause: error });
        }

        return mapSession(data as Record<string, unknown>);
      },
      async restoreSession(input) {
        const { data, error } = await supabase
          .rpc("restore_table_session", {
            p_table_number: input.tableNumber,
            p_session_id: input.sessionId,
          })
          .maybeSingle();

        if (error) {
          logSupabaseError("restore_table_session RPC", error);
          throw new SessionServiceError("SESSION_FAILED", { cause: error });
        }

        return data ? mapSession(data as Record<string, unknown>) : null;
      },
    },
  });

  if (session) logSessionStatus(session);
  return session;
}

export async function resetDemo() {
  const supabase = getSupabase();
  if (!supabase) {
    const orders = getLocalOrders();
    const removedOrders = orders.filter((order) =>
      TERMINAL_STATUSES.includes(order.status),
    );
    publishLocalOrders(
      orders.filter((order) => !TERMINAL_STATUSES.includes(order.status)),
    );
    return {
      deletedOrders: removedOrders.length,
      deletedOrderItems: removedOrders.reduce(
        (total, order) => total + order.items.length,
        0,
      ),
      deletedSessions: 0,
    };
  }

  const { data, error } = await supabase.rpc("reset_demo").single();
  if (error) {
    logSupabaseError("reset_demo RPC", error);
    throw error;
  }

  const result = data as Record<string, unknown>;
  return {
    deletedOrders: Number(result.deleted_orders),
    deletedOrderItems: Number(result.deleted_order_items),
    deletedSessions: Number(result.deleted_sessions),
  };
}

export async function createOrder(input: {
  tableNumber: string;
  sessionId: string;
  total: number;
  items: OrderItemRecord[];
}): Promise<CafeOrder> {
  const order: CafeOrder = {
    id: createUuid(),
    displayId: 1000 + (Date.now() % 9000),
    tableNumber: input.tableNumber,
    status: "NEW",
    total: input.total,
    sessionId: input.sessionId,
    createdAt: new Date().toISOString(),
    items: input.items,
  };

  const supabase = getSupabase();
  if (!supabase) {
    publishLocalOrders([order, ...getLocalOrders()]);
    return order;
  }

  const { data, error } = await supabase
    .rpc("create_order", {
      p_id: order.id,
      p_display_id: order.displayId,
      p_table_number: order.tableNumber,
      p_session_id: order.sessionId,
      p_total: order.total,
      p_items: input.items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        price: item.price,
        quantity: item.quantity,
      })),
    })
    .single();

  if (error) {
    logSupabaseError("create_order RPC", error);
    if (
      error.message.includes("session_expired") ||
      error.message.includes("invalid_session")
    ) {
      throw new OrderServiceError("SESSION_EXPIRED", { cause: error });
    }
    throw new OrderServiceError("ORDER_FAILED", { cause: error });
  }

  return {
    ...order,
    createdAt: String((data as { created_at: unknown }).created_at),
  };
}

export async function loadOrders(): Promise<CafeOrder[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return getLocalOrders().sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  if (error) {
    logSupabaseError("order list query", error);
    throw error;
  }
  return (data ?? []).map((row) => mapOrder(row));
}

export async function loadOrder(id: string): Promise<CafeOrder | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return getLocalOrders().find((order) => order.id === id) ?? null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logSupabaseError("single order query", error);
    throw error;
  }
  return data ? mapOrder(data) : null;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = getSupabase();
  if (!supabase) {
    const orders = getLocalOrders().map((order) =>
      order.id === id ? { ...order, status } : order,
    );
    publishLocalOrders(orders);
    return;
  }

  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) {
    logSupabaseError("order status update", error);
    throw error;
  }
}

export function subscribeToOrders(
  callback: (orders: CafeOrder[]) => void,
  options: RealtimeOptions = {},
) {
  const supabase = getSupabase();
  if (!supabase) {
    const refresh = () =>
      void loadOrders()
        .then(callback)
        .catch(() => options.onError?.());
    const channel =
      typeof window !== "undefined" && "BroadcastChannel" in window
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;
    channel?.addEventListener("message", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("yapa-orders-updated", refresh);
    return () => {
      channel?.close();
      window.removeEventListener("storage", refresh);
      window.removeEventListener("yapa-orders-updated", refresh);
    };
  }

  const refresh = () =>
    void loadOrders()
      .then(callback)
      .catch(() => options.onError?.());
  const channel = supabase
    .channel("yapa-live-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      refresh,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_items" },
      refresh,
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        options.onConnected?.();
        refresh();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        options.onError?.();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToOrder(
  id: string,
  callback: (order: CafeOrder) => void,
  options: RealtimeOptions = {},
) {
  const supabase = getSupabase();
  const refresh = () =>
    void loadOrder(id)
      .then((order) => {
        if (order) callback(order);
      })
      .catch(() => options.onError?.());

  if (!supabase) {
    const channel =
      typeof window !== "undefined" && "BroadcastChannel" in window
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;
    channel?.addEventListener("message", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("yapa-orders-updated", refresh);
    return () => {
      channel?.close();
      window.removeEventListener("storage", refresh);
      window.removeEventListener("yapa-orders-updated", refresh);
    };
  }

  const channel = supabase
    .channel(`yapa-order-${id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${id}`,
      },
      refresh,
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        options.onConnected?.();
        refresh();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        options.onError?.();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export { isSupabaseConfigured };
