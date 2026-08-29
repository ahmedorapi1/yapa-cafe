export type Category = "hot" | "fresh" | "cold";

export type OrderStatus =
  | "NEW"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "PAID"
  | "REJECTED";

export interface Product {
  id: string;
  name: string;
  category: Category;
  categoryLabel: string;
  description: string;
  price: number;
  image: string;
  ingredients: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItemRecord {
  id?: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface CafeOrder {
  id: string;
  displayId: number;
  tableNumber: string;
  status: OrderStatus;
  total: number;
  sessionId: string;
  createdAt: string;
  items: OrderItemRecord[];
}

export interface OrderingSession {
  id: string;
  tableNumber: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
}
