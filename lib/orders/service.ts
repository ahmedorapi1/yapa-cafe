"use client";

import {
  getSupabase,
  isSupabaseConfigured,
  logSupabaseError,
} from "@/lib/supabase/client";
import { createUuid } from "@/lib/utils/createId";
import type {
  CafeOrder,
  OrderingSession,
  OrderItemRecord,
  OrderStatus,
} from "@/types";

const ORDERS_KEY = "yapa_demo_orders_v1";
const CHANNEL_NAME = "yapa_orders_channel";
const SESSION_DURATION_MS = 60 * 60 * 1000;
const TERMINAL_STATUSES: OrderStatus[] = ["COMPLETED", "REJECTED"];
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

function mapOrder(row: Record<string, unknown>): CafeOrder {
  const rawItems = (row.order_items ?? []) as Array<Record<string, unknown>>;
  return {
    id: String(row.id),
    displayId: Number(row.display_id),
    tableNumber: String(row.table_number),
    status: row.status as OrderStatus,
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

function newSession(tableNumber: string): OrderingSession {
  const createdAt = new Date();
  return {
    id: createUuid(),
    tableNumber,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + SESSION_DURATION_MS).toISOString(),
    active: true,
  };
}

function getLocalOrders(): CafeOrder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]") as CafeOrder[];
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
  startNewSession = false,
) {
  const supabase = getSupabase();
  if (!supabase) {
    const localSession =
      savedSession?.tableNumber === tableNumber &&
      !(startNewSession && isExpiredSession(savedSession))
        ? savedSession
        : newSession(tableNumber);
    logSessionStatus(localSession);
    return localSession;
  }

  // Supabase is the source of truth for a saved session. An expired or
  // inactive database record is returned as-is so a reload cannot silently
  // grant the customer another hour.
  if (savedSession?.id) {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, table_number, created_at, expires_at, active")
      .eq("id", savedSession.id)
      .maybeSingle();

    if (error) {
      logSupabaseError("session restore", error);
      throw error;
    }
    if (data) {
      const restored = mapSession(data);
      if (restored.tableNumber === tableNumber) {
        if (!startNewSession || !isExpiredSession(restored)) {
          logSessionStatus(restored);
          return restored;
        }
      } else if (!startNewSession) {
        const invalidSession = { ...restored, active: false };
        logSessionStatus(invalidSession);
        return invalidSession;
      }
    }
  }

  const session = newSession(tableNumber);
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      id: session.id,
      table_number: session.tableNumber,
      created_at: session.createdAt,
      expires_at: session.expiresAt,
      active: session.active,
    })
    .select("id, table_number, created_at, expires_at, active")
    .single();

  if (error) {
    logSupabaseError("session creation", error);
    throw error;
  }
  const created = mapSession(data);
  logSessionStatus(created);
  return created;
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
