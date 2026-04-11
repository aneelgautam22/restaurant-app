import Dexie, { Table } from "dexie";

export type SyncStatus =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete";

export type LocalMenuItem = {
  id?: number;
  server_id?: number | null;
  restaurant_id: number;
  item_name: string;
  price: number;
  created_at?: string;
  updated_at?: string;
  sync_status?: SyncStatus;
};

export type LocalOrder = {
  id?: number;
  server_id?: number | null;
  restaurant_id: number;
  table_number: string;
  status: string;
  remarks?: string | null;
  waiter_cleared?: boolean | null;
  is_paid?: boolean | null;
  payment_method?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at?: string;
  sync_status?: "synced" | "pending_create" | "pending_update";
};

export type LocalOrderItem = {
  id?: number;
  local_order_id?: number | null;
  server_order_id?: number | null;
  server_id?: number | null;
  item_name: string;
  quantity: number;
  unit_price?: number | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
  sync_status?: SyncStatus;
};

export type SyncQueueItem = {
  id?: number;
  restaurant_id: number;
  entity: "menu_item" | "order" | "order_item";
  action: "create" | "update" | "delete";
  local_id?: number | null;
  server_id?: number | null;
  payload: string;
  created_at: string;
  processed: 0 | 1;
};

export type LocalRestaurantCache = {
  id?: number;
  restaurant_id: number;
  name?: string;
  owner_password?: string;
  waiter_password?: string;
  kitchen_password?: string;
  profit_percent?: number;
  is_setup_done?: boolean;
  updated_at?: string;
};

class MiniAppDB extends Dexie {
  menu_items!: Table<LocalMenuItem, number>;
  orders!: Table<LocalOrder, number>;
  order_items!: Table<LocalOrderItem, number>;
  sync_queue!: Table<SyncQueueItem, number>;
  restaurant_cache!: Table<LocalRestaurantCache, number>;

  constructor() {
    super("mini_restaurant_offline_db");

    this.version(3).stores({
      menu_items:
        "++id, restaurant_id, [restaurant_id+server_id], server_id, item_name, sync_status, updated_at",
      orders:
        "++id, restaurant_id, [restaurant_id+server_id], server_id, table_number, status, is_paid, created_at, updated_at, sync_status",
      order_items:
        "++id, local_order_id, server_order_id, server_id, [local_order_id+server_id], item_name, sync_status, updated_at",
      sync_queue:
        "++id, restaurant_id, entity, action, local_id, server_id, processed, created_at",
      restaurant_cache:
        "++id, restaurant_id, [restaurant_id+updated_at], updated_at",
    });
  }
}

export const miniDB = new MiniAppDB();