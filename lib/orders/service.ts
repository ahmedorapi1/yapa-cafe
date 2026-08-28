"use client";

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { createId } from "@/lib/utils/createId";
import type {
  CafeOrder,
  OrderingSession,
  OrderItemRecord,
  OrderStatus,
} from "@/types";

const ORDERS_KEY = "yapa_demo_orders_v1";
const CHANNEL_NAME = "yapa_orders_channel";

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

export async function syncSession(session: OrderingSession) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("sessions").insert({
    id: session.id,
    table_number: session.tableNumber,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    active: session.active,
  });
  if (error) console.warn("Unable to sync ordering session", error.message);
}

export async function createOrder(input: {
  tableNumber: string;
  sessionId: string;
  total: number;
  items: OrderItemRecord[];
}): Promise<CafeOrder> {
  const order: CafeOrder = {
    id: createId(),
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
    .from("orders")
    .insert({
      id: order.id,
      display_id: order.displayId,
      table_number: order.tableNumber,
      status: order.status,
      total: order.total,
      session_id: order.sessionId,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: itemError } = await supabase.from("order_items").insert(
    input.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      price: item.price,
      quantity: item.quantity,
    })),
  );
  if (itemError) throw itemError;

  return { ...order, createdAt: String(data.created_at) };
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
  if (error) throw error;
  return (data ?? []).map((row) => mapOrder(row));
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
  if (error) throw error;
}

export function subscribeToOrders(callback: (orders: CafeOrder[]) => void) {
  const supabase = getSupabase();
  if (!supabase) {
    const refresh = () => void loadOrders().then(callback);
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

  const refresh = () => void loadOrders().then(callback);
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
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export { isSupabaseConfigured };
