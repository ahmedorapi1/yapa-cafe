import type { CafeOrder, OrderStatus } from "@/types";

export type CustomerVisibleOrderStatus = Exclude<OrderStatus, "PAID">;

export function getCustomerVisibleStatus(
  status: OrderStatus,
): CustomerVisibleOrderStatus {
  return status === "PAID" ? "SERVED" : status;
}

export function maskPaidOrderForCustomer(order: CafeOrder): CafeOrder {
  const status = getCustomerVisibleStatus(order.status);
  return status === order.status ? order : { ...order, status };
}
