"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OrderItemInput = {
  item_name: string;
  quantity: number;
  price: number;
};

type MenuItem = {
  id: number;
  item_name: string;
  price: number;
  created_at?: string;
};

type PopularItem = {
  item_name: string;
  total_sold: number;
};

type OrderRow = {
  id: number;
  table_number: string;
  status: string;
  created_at: string;
  waiter_cleared?: boolean | null;
  is_paid?: boolean | null;
  payment_method?: string | null;
  paid_at?: string | null;
  order_items?: {
    id: number;
    item_name: string;
    quantity: number;
    unit_price?: number | null;
  }[];
};

type SalesItem = {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
};

type BillItem = {
  item_name: string;
  quantity: number;
  total: number;
};

const RESTAURANT_ID =
  typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("id") || 1)
    : 1;

export default function WaiterPage() {
  const [tableNumber, setTableNumber] = useState("");
  const [items, setItems] = useState<OrderItemInput[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [readyPopupOrder, setReadyPopupOrder] = useState<OrderRow | null>(null);
  const [lastReadyAlertIds, setLastReadyAlertIds] = useState<number[]>([]);

  const [waiterBillTableNumber, setWaiterBillTableNumber] = useState("");
  const [waiterPaymentMethod, setWaiterPaymentMethod] = useState<
    "cash" | "qr" | "card"
  >("cash");
  const [markingPaidWaiter, setMarkingPaidWaiter] = useState(false);
  const [moveFromTable, setMoveFromTable] = useState("");
  const [moveToTable, setMoveToTable] = useState("");
  const [movingTable, setMovingTable] = useState(false);

  // Waiter order edit states
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editOrderTableNumber, setEditOrderTableNumber] = useState("");
  const [editItems, setEditItems] = useState<OrderItemInput[]>([]);
  const [editSearchTerm, setEditSearchTerm] = useState("");
  const [savingEditOrder, setSavingEditOrder] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null);

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [dbPassword, setDbPassword] = useState("");



  async function fetchWaiterPassword() {
    const { data, error } = await supabase
      .from("restaurants")
      .select("waiter_password")
      .eq("id", RESTAURANT_ID)
      .single();

    if (!error && data) {
      setDbPassword(data.waiter_password || "");
    }
  }

  async function handleUnlock() {
    const { data, error } = await supabase
      .from("restaurants")
      .select("waiter_password")
      .eq("id", RESTAURANT_ID)
      .single();

    if (error || !data) {
      alert("Failed to check waiter password");
      return;
    }

    if (password === (data.waiter_password || "")) {
      setDbPassword(data.waiter_password || "");
      setUnlocked(true);
    } else {
      alert("Wrong password");
    }
  }

  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as OrderRow[]);
    }
  }

  async function fetchMenu() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("item_name", { ascending: true });

    if (!error && data) {
      setMenuItems(data as MenuItem[]);
    }
  }

  async function fetchPopularItems() {
  const { data, error } = await supabase
    .from("order_items")
    .select("item_name, quantity, orders!inner(restaurant_id)")
    .eq("orders.restaurant_id", RESTAURANT_ID);

    if (error || !data) return;

    const totals: Record<string, number> = {};

    data.forEach((item) => {
      const name = String(item.item_name || "");
      const qty = Number(item.quantity || 0);

      if (!name) return;

      totals[name] = (totals[name] || 0) + qty;
    });

    const sorted = Object.entries(totals)
      .map(([item_name, total_sold]) => ({
        item_name,
        total_sold,
      }))
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 6);

    setPopularItems(sorted);
  }


 function playNotificationBeep() {
  if (typeof window === "undefined") return;

  const audio = new Audio("/bell.mp3");
  audio.play().catch(() => {});
}

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    fetchPopularItems();
    fetchWaiterPassword();

    const ordersChannel = supabase
      .channel("waiter-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${RESTAURANT_ID}`,
        },
        () => {
          fetchOrders();
          fetchPopularItems();
        }
      )
      .subscribe();

    const orderItemsChannel = supabase
      .channel("waiter-order-items-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          fetchOrders();
          fetchPopularItems();
        }
      )
      .subscribe();

    const menuItemsChannel = supabase
      .channel("waiter-menu-items-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${RESTAURANT_ID}` },
        () => {
          fetchMenu();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchOrders();
      fetchMenu();
      fetchPopularItems();
    }, 2000);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(orderItemsChannel);
      supabase.removeChannel(menuItemsChannel);
      clearInterval(interval);
    };
  }, []);


  useEffect(() => {
    const currentReadyOrders = orders.filter(
      (order) =>
        order.is_paid !== true &&
        order.status === "ready" &&
        order.waiter_cleared !== true
    );

    if (currentReadyOrders.length === 0) return;

    const newReadyOrders = currentReadyOrders.filter(
      (order) => !lastReadyAlertIds.includes(order.id)
    );

    if (newReadyOrders.length === 0) return;

    const latestReadyOrder = [...newReadyOrders].sort((a, b) => b.id - a.id)[0];

    playNotificationBeep();
    setReadyPopupOrder(latestReadyOrder);
    setLastReadyAlertIds((prev) => [
      ...prev,
      ...newReadyOrders.map((order) => order.id),
    ]);
  }, [orders, lastReadyAlertIds]);

  function addMenuItemToOrder(menu: MenuItem) {
    const existing = items.find((i) => i.item_name === menu.item_name);

    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.item_name === menu.item_name
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          item_name: menu.item_name,
          quantity: 1,
          price: Number(menu.price),
        },
      ]);
    }
  }

  function increaseQuantity(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseQuantity(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Edit order helper functions
  function startEditOrder(order: OrderRow) {
    if (order.status !== "pending" || order.is_paid === true) {
      alert("Only pending unpaid orders can be edited");
      return;
    }

    setEditingOrderId(order.id);
    setEditOrderTableNumber(String(order.table_number));
    setEditItems(
      (order.order_items || []).map((item) => ({
        item_name: item.item_name,
        quantity: Number(item.quantity || 0),
        price: Number(item.unit_price || 0),
      }))
    );
    setEditSearchTerm("");
  }

  function cancelEditOrder() {
    setEditingOrderId(null);
    setEditOrderTableNumber("");
    setEditItems([]);
    setEditSearchTerm("");
  }

  function addMenuItemToEditOrder(menu: MenuItem) {
    const existing = editItems.find((i) => i.item_name === menu.item_name);

    if (existing) {
      setEditItems((prev) =>
        prev.map((i) =>
          i.item_name === menu.item_name
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      );
    } else {
      setEditItems((prev) => [
        ...prev,
        {
          item_name: menu.item_name,
          quantity: 1,
          price: Number(menu.price),
        },
      ]);
    }
  }

  function increaseEditQuantity(index: number) {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseEditQuantity(index: number) {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === index && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  const editFilteredMenuItems = useMemo(() => {
    if (!editSearchTerm.trim()) {
      return menuItems.slice(0, 12);
    }

    return menuItems.filter((menu) =>
      menu.item_name.toLowerCase().includes(editSearchTerm.toLowerCase())
    );
  }, [menuItems, editSearchTerm]);

  const editOrderTotal = useMemo(() => {
    return editItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [editItems]);

  async function saveEditedOrder() {
    if (!editingOrderId) return;

    if (!editOrderTableNumber.trim()) {
      alert("Please enter table number");
      return;
    }

    if (editItems.length === 0) {
      alert("Please keep at least one item or use cancel order");
      return;
    }

    const targetOrder = orders.find((order) => order.id === editingOrderId);

    if (!targetOrder) {
      alert("Order not found");
      return;
    }

    if (targetOrder.status !== "pending" || targetOrder.is_paid === true) {
      alert("Only pending unpaid orders can be edited");
      return;
    }

    setSavingEditOrder(true);

    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        table_number: editOrderTableNumber.trim(),
      })
      .eq("id", editingOrderId)
      .eq("restaurant_id", RESTAURANT_ID);

    if (updateOrderError) {
      setSavingEditOrder(false);
      alert("Failed to update order");
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", editingOrderId);

    if (deleteItemsError) {
      setSavingEditOrder(false);
      alert("Failed to update order items");
      return;
    }

    const newOrderItemsPayload = editItems.map((item) => ({
      order_id: editingOrderId,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { error: insertItemsError } = await supabase
      .from("order_items")
      .insert(newOrderItemsPayload);

    setSavingEditOrder(false);

    if (insertItemsError) {
      alert("Failed to save edited items");
      return;
    }

    await fetchOrders();
    fetchPopularItems();
    cancelEditOrder();
    alert("Order updated successfully");
  }

  async function handleCancelOrder(orderId: number) {
    const targetOrder = orders.find((order) => order.id === orderId);

    if (!targetOrder) {
      alert("Order not found");
      return;
    }

    if (targetOrder.status !== "pending" || targetOrder.is_paid === true) {
      alert("Only pending unpaid orders can be cancelled");
      return;
    }

    const confirmCancel = confirm(
      `Cancel order #${orderId} for table ${targetOrder.table_number}?`
    );
    if (!confirmCancel) return;

    setCancelingOrderId(orderId);

    const { error: deleteItemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (deleteItemsError) {
      setCancelingOrderId(null);
      alert("Failed to delete order items");
      return;
    }

    const { error: deleteOrderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("restaurant_id", RESTAURANT_ID);

    setCancelingOrderId(null);

    if (deleteOrderError) {
      alert("Failed to cancel order");
      return;
    }

    if (editingOrderId === orderId) {
      cancelEditOrder();
    }

    await fetchOrders();
    fetchPopularItems();
    alert("Order cancelled successfully");
  }

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const popularMenuItems = useMemo(() => {
    if (popularItems.length === 0) {
      return menuItems.slice(0, 6);
    }

    const mapped = popularItems
      .map((popular) =>
        menuItems.find((menu) => menu.item_name === popular.item_name)
      )
      .filter(Boolean) as MenuItem[];

    return mapped.slice(0, 6);
  }, [popularItems, menuItems]);

  const filteredMenuItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return popularMenuItems;
    }

    return menuItems.filter((menu) =>
      menu.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [menuItems, searchTerm, popularMenuItems]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!tableNumber.trim()) {
      alert("Please enter table number");
      return;
    }

    if (items.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setLoading(true);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          restaurant_id: RESTAURANT_ID,
          table_number: tableNumber,
          status: "pending",
          waiter_cleared: false,
          is_paid: false,
          payment_method: null,
          paid_at: null,
        },
      ])
      .select()
      .single();

    if (orderError || !orderData) {
      setLoading(false);
      alert("Failed to create order");
      return;
    }

    const orderItemsPayload = items.map((item) => ({
      order_id: orderData.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    setLoading(false);

    if (itemsError) {
      alert("Order created, but items failed");
      return;
    }

    setTableNumber("");
    setItems([]);
    setSearchTerm("");
    fetchOrders();
    fetchPopularItems();
    alert("Order sent to kitchen");
  }

  async function handleWaiterOk(orderId: number) {
    const { error } = await supabase
      .from("orders")
      .update({ waiter_cleared: true })
      .eq("id", orderId)
      .eq("restaurant_id", RESTAURANT_ID);

    if (error) {
      alert("Failed to clear order");
      return;
    }

    fetchOrders();
  }








  const waiterVisibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.is_paid === true) return false;
      if (order.status === "ready") {
        return !order.waiter_cleared;
      }
      return true;
    });
  }, [orders]);


  function buildBillData(tableNo: string) {
    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      return {
        matchedOrders: [] as OrderRow[],
        billItems: [] as BillItem[],
        grandTotal: 0,
      };
    }

    const matchedOrders = orders.filter(
      (order) =>
        String(order.table_number).trim() === normalizedTableNo &&
        order.is_paid !== true
    );

    const billMap: Record<string, BillItem> = {};

    matchedOrders.forEach((order) => {
      order.order_items?.forEach((item) => {
        const itemName = item.item_name;
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal = quantity * unitPrice;

        if (!billMap[itemName]) {
          billMap[itemName] = {
            item_name: itemName,
            quantity: 0,
            total: 0,
          };
        }

        billMap[itemName].quantity += quantity;
        billMap[itemName].total += lineTotal;
      });
    });

    const billItems = Object.values(billMap).sort((a, b) =>
      a.item_name.localeCompare(b.item_name)
    );

    const grandTotal = billItems.reduce((sum, item) => sum + item.total, 0);

    return {
      matchedOrders,
      billItems,
      grandTotal,
    };
  }

  const waiterBillData = useMemo(() => {
    return buildBillData(waiterBillTableNumber);
  }, [waiterBillTableNumber, orders]);

  async function markTableAsPaid(
    tableNo: string,
    paymentMethod: "cash" | "qr" | "card"
  ) {
    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      alert("Please enter table number");
      return;
    }

    const unpaidOrdersForTable = orders.filter(
      (order) =>
        String(order.table_number).trim() === normalizedTableNo &&
        order.is_paid !== true
    );

    if (unpaidOrdersForTable.length === 0) {
      alert("No unpaid orders found for this table");
      return;
    }

    const confirmPay = confirm(
      `Mark all unpaid orders for table ${normalizedTableNo} as paid with ${paymentMethod.toUpperCase()}?`
    );
    if (!confirmPay) return;

    setMarkingPaidWaiter(true);

    const orderIds = unpaidOrdersForTable.map((order) => order.id);

    const { error } = await supabase
      .from("orders")
      .update({
        is_paid: true,
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
      })
      .in("id", orderIds)
      .eq("restaurant_id", RESTAURANT_ID);

    setMarkingPaidWaiter(false);

    if (error) {
      alert("Failed to mark orders as paid");
      return;
    }

    await fetchOrders();

    alert(`Table ${normalizedTableNo} marked as paid`);

    setWaiterBillTableNumber("");
    setWaiterPaymentMethod("cash");
  }

  async function handleTableMove() {
    const oldTable = moveFromTable.trim();
    const newTable = moveToTable.trim();

    if (!oldTable || !newTable) {
      alert("Please enter both current table and new table");
      return;
    }

    if (oldTable === newTable) {
      alert("Current table and new table cannot be same");
      return;
    }

    const unpaidOrdersForOldTable = orders.filter(
      (order) =>
        String(order.table_number).trim() === oldTable && order.is_paid !== true
    );

    if (unpaidOrdersForOldTable.length === 0) {
      alert("No unpaid orders found for current table");
      return;
    }

    const confirmMove = confirm(
      `Move all unpaid orders from table ${oldTable} to table ${newTable}?`
    );
    if (!confirmMove) return;

    setMovingTable(true);

    const orderIds = unpaidOrdersForOldTable.map((order) => order.id);

    const { error } = await supabase
      .from("orders")
      .update({ table_number: newTable })
      .in("id", orderIds)
      .eq("restaurant_id", RESTAURANT_ID);

    setMovingTable(false);

    if (error) {
      alert("Failed to move table");
      return;
    }

    await fetchOrders();
    alert(`Moved unpaid orders from table ${oldTable} to table ${newTable}`);
    setMoveFromTable("");
    setMoveToTable("");
  }




  if (!unlocked) {
    return (
      <main className="min-h-screen bg-gray-100 p-3">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <h1 className="text-2xl font-bold text-center">Waiter Login</h1>

            <input
              type="password"
              placeholder="Enter waiter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-xl px-4 py-3"
            />

            <button
              type="button"
              onClick={handleUnlock}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Enter
            </button>
          </div>
        </div>
      </main>
    );
  }






  return (
    <main className="min-h-screen bg-gray-100 p-3">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow p-4">
          <h1 className="text-2xl font-bold mb-4 text-center">
            Waiter Panel
          </h1>

          <div className="space-y-4">
              {readyPopupOrder && (
                <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-green-700">
                        📢 Table Ready
                      </p>
                      <h2 className="text-xl font-bold text-green-900 mt-1">
                        Table {readyPopupOrder.table_number} is ready
                      </h2>
                      <p className="text-sm text-green-800 mt-2">
                        Order #{readyPopupOrder.id} is ready to serve.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setReadyPopupOrder(null)}
                      className="bg-white border border-green-300 px-3 py-1 rounded-lg text-sm font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Table Number
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Enter table number"
                    className="w-full border rounded-xl px-4 py-3 text-lg"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold">Menu</label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search item..."
                      className="flex-1 border rounded-xl px-4 py-3 text-base"
                    />

                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="bg-gray-300 px-4 py-3 rounded-xl text-sm font-medium"
                    >
                      Clear
                    </button>
                  </div>

                  {!searchTerm.trim() && (
                    <p className="text-xs text-gray-500">
                      Showing top 6 popular items
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {filteredMenuItems.length === 0 && (
                      <p className="col-span-3 text-sm text-gray-500">
                        No matching items found.
                      </p>
                    )}

                    {filteredMenuItems.map((menu) => (
                      <button
                        key={menu.id}
                        type="button"
                        onClick={() => addMenuItemToOrder(menu)}
                        className="bg-gray-200 py-2 rounded-xl text-sm font-medium"
                      >
                        {menu.item_name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold">Selected Items</label>

                  {items.length === 0 && (
                    <p className="text-sm text-gray-500">No items selected yet.</p>
                  )}

                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="border rounded-2xl p-3 bg-gray-50 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-gray-500">
                            Rs. {item.price} each
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="bg-red-500 text-white px-3 py-2 rounded-xl text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decreaseQuantity(index)}
                          className="bg-gray-300 px-4 py-2 rounded-xl text-lg font-bold"
                        >
                          -
                        </button>

                        <div className="flex-1 text-center border rounded-xl py-2 text-lg font-semibold bg-white">
                          {item.quantity}
                        </div>

                        <button
                          type="button"
                          onClick={() => increaseQuantity(index)}
                          className="bg-gray-300 px-4 py-2 rounded-xl text-lg font-bold"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right font-semibold text-sm">
                        Subtotal: Rs. {item.price * item.quantity}
                      </div>
                    </div>
                  ))}

                  {items.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>Rs. {totalAmount}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-4 rounded-2xl text-lg font-bold"
                >
                  {loading ? "Sending..." : "Send to Kitchen"}
                </button>
              </form>

              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="text-xl font-bold mb-3">Recent Orders</h2>

                <div className="space-y-3">
                  {waiterVisibleOrders.length === 0 && (
                    <p className="text-gray-500 text-sm">No unpaid active orders.</p>
                  )}

                  {waiterVisibleOrders.map((order) => {
                    const canEditOrCancel =
                      order.status === "pending" && order.is_paid !== true;

                    return (
                      <div
                        key={order.id}
                        className="border rounded-2xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-base">
                              Table {order.table_number}
                            </p>
                            <p className="text-xs text-gray-500">
                              Order #{order.id}
                            </p>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                              order.status === "ready"
                                ? "bg-green-100 text-green-700"
                                : order.status === "preparing"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        <div className="text-sm text-gray-700 space-y-1">
                          {order.order_items?.length ? (
                            order.order_items.map((item) => (
                              <p key={item.id}>
                                {item.item_name} x {item.quantity}
                              </p>
                            ))
                          ) : (
                            <p>No items</p>
                          )}
                        </div>

                        {order.status === "ready" && !order.waiter_cleared && (
                          <button
                            type="button"
                            onClick={() => {
                              handleWaiterOk(order.id);
                              if (readyPopupOrder?.id === order.id) {
                                setReadyPopupOrder(null);
                              }
                            }}
                            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold mt-2"
                          >
                            OK
                          </button>
                        )}

                        {canEditOrCancel && (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => startEditOrder(order)}
                              className="bg-yellow-500 text-white py-2 rounded-xl font-semibold"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancelingOrderId === order.id}
                              className="bg-red-600 text-white py-2 rounded-xl font-semibold"
                            >
                              {cancelingOrderId === order.id
                                ? "Canceling..."
                                : "Cancel"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {editingOrderId !== null && (
                <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">
                      Edit Order #{editingOrderId}
                    </h2>

                    <button
                      type="button"
                      onClick={cancelEditOrder}
                      className="bg-gray-400 text-white px-4 py-2 rounded-xl text-sm font-medium"
                    >
                      Close
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Table Number
                    </label>
                    <input
                      type="text"
                      value={editOrderTableNumber}
                      onChange={(e) => setEditOrderTableNumber(e.target.value)}
                      placeholder="Enter table number"
                      className="w-full border rounded-xl px-4 py-3"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold">
                      Add More Items
                    </label>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editSearchTerm}
                        onChange={(e) => setEditSearchTerm(e.target.value)}
                        placeholder="Search item..."
                        className="flex-1 border rounded-xl px-4 py-3 text-base"
                      />

                      <button
                        type="button"
                        onClick={() => setEditSearchTerm("")}
                        className="bg-gray-300 px-4 py-3 rounded-xl text-sm font-medium"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                      {editFilteredMenuItems.length === 0 && (
                        <p className="col-span-3 text-sm text-gray-500">
                          No matching items found.
                        </p>
                      )}

                      {editFilteredMenuItems.map((menu) => (
                        <button
                          key={menu.id}
                          type="button"
                          onClick={() => addMenuItemToEditOrder(menu)}
                          className="bg-gray-200 py-2 rounded-xl text-sm font-medium"
                        >
                          {menu.item_name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold">
                      Edit Selected Items
                    </label>

                    {editItems.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No items left. Add one item or use cancel order.
                      </p>
                    )}

                    {editItems.map((item, index) => (
                      <div
                        key={`${item.item_name}-${index}`}
                        className="border rounded-2xl p-3 bg-gray-50 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{item.item_name}</p>
                            <p className="text-sm text-gray-500">
                              Rs. {item.price} each
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeEditItem(index)}
                            className="bg-red-500 text-white px-3 py-2 rounded-xl text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decreaseEditQuantity(index)}
                            className="bg-gray-300 px-4 py-2 rounded-xl text-lg font-bold"
                          >
                            -
                          </button>

                          <div className="flex-1 text-center border rounded-xl py-2 text-lg font-semibold bg-white">
                            {item.quantity}
                          </div>

                          <button
                            type="button"
                            onClick={() => increaseEditQuantity(index)}
                            className="bg-gray-300 px-4 py-2 rounded-xl text-lg font-bold"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right font-semibold text-sm">
                          Subtotal: Rs. {item.price * item.quantity}
                        </div>
                      </div>
                    ))}

                    {editItems.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between text-lg font-bold">
                          <span>Updated Total</span>
                          <span>Rs. {editOrderTotal}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={saveEditedOrder}
                      disabled={savingEditOrder}
                      className="bg-blue-600 text-white py-3 rounded-xl font-semibold"
                    >
                      {savingEditOrder ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                      type="button"
                      onClick={cancelEditOrder}
                      className="bg-gray-400 text-white py-3 rounded-xl font-semibold"
                    >
                      Cancel Edit
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                <h2 className="text-xl font-bold">Table Bill Lookup</h2>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Enter Table Number
                  </label>
                  <input
                    type="text"
                    value={waiterBillTableNumber}
                    onChange={(e) => setWaiterBillTableNumber(e.target.value)}
                    placeholder="Enter table number"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                {waiterBillTableNumber.trim() && (
                  <div className="border rounded-2xl p-4 bg-gray-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">
                        Table {waiterBillTableNumber}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Unpaid Orders: {waiterBillData.matchedOrders.length}
                      </p>
                    </div>

                    {waiterBillData.matchedOrders.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No unpaid orders found for this table.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {waiterBillData.billItems.map((item) => (
                            <div
                              key={item.item_name}
                              className="flex items-center justify-between border-b pb-2 text-sm"
                            >
                              <div>
                                <p className="font-medium">{item.item_name}</p>
                                <p className="text-gray-500">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                              <p className="font-semibold">Rs. {item.total}</p>
                            </div>
                          ))}
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                          <div className="flex items-center justify-between text-lg font-bold">
                            <span>Grand Total</span>
                            <span>Rs. {waiterBillData.grandTotal}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold">
                            Payment Method
                          </label>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setWaiterPaymentMethod("cash")}
                              className={`py-2 rounded-xl text-sm font-medium ${
                                waiterPaymentMethod === "cash"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              Cash
                            </button>

                            <button
                              type="button"
                              onClick={() => setWaiterPaymentMethod("qr")}
                              className={`py-2 rounded-xl text-sm font-medium ${
                                waiterPaymentMethod === "qr"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              QR
                            </button>

                            <button
                              type="button"
                              onClick={() => setWaiterPaymentMethod("card")}
                              className={`py-2 rounded-xl text-sm font-medium ${
                                waiterPaymentMethod === "card"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              Card
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            markTableAsPaid(
                              waiterBillTableNumber,
                              waiterPaymentMethod
                            )
                          }
                          disabled={markingPaidWaiter}
                          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
                        >
                          {markingPaidWaiter ? "Marking..." : "Mark as Paid"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                <h2 className="text-xl font-bold">Table Change</h2>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Current Table Number
                  </label>
                  <input
                    type="text"
                    value={moveFromTable}
                    onChange={(e) => setMoveFromTable(e.target.value)}
                    placeholder="Enter current table number"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    New Table Number
                  </label>
                  <input
                    type="text"
                    value={moveToTable}
                    onChange={(e) => setMoveToTable(e.target.value)}
                    placeholder="Enter new table number"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTableMove}
                  disabled={movingTable}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold"
                >
                  {movingTable ? "Moving..." : "Move Table"}
                </button>

                <p className="text-xs text-gray-500">
                  This will move all unpaid orders from current table to new
                  table.
                </p>
              </div>
            </div>
        </div>
      </div>
    </main>
  );
}