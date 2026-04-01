"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type OrderItemRow = {
  id: number;
  item_name: string;
  quantity: number;
  unit_price?: number | null;
  status?: "pending" | "preparing" | "ready";
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
  remarks?: string | null;
  order_items?: OrderItemRow[];
};

type ReadyNotification = {
  uniqueKey: string;
  orderId: number;
  tableNumber: string;
  items: {
    id: number;
    item_name: string;
    quantity: number;
  }[];
};

type GroupedTableItem = {
  item_name: string;
  quantity: number;
  total: number;
  statuses: string[];
};

type GroupedTableOrder = {
  table_number: string;
  order_ids: number[];
  remarks: string[];
  items: GroupedTableItem[];
  total: number;
  unpaid_orders_count: number;
  sourceOrders: OrderRow[];
};

const RESTAURANT_ID =
  typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("id") || 1)
    : 1;

export default function WaiterPage() {
  const [restaurantName, setRestaurantName] = useState("");

  const [tableNumber, setTableNumber] = useState("");
  const [items, setItems] = useState<OrderItemInput[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const [readyNotifications, setReadyNotifications] = useState<ReadyNotification[]>([]);
  const [seenReadyItemIds, setSeenReadyItemIds] = useState<number[]>([]);

  const [tableSearch, setTableSearch] = useState("");
  const [tableOrdersOpen, setTableOrdersOpen] = useState(false);
  const [paidHistoryOpen, setPaidHistoryOpen] = useState(false);

  const [tablePaymentMethods, setTablePaymentMethods] = useState<
    Record<string, "cash" | "qr" | "card">
  >({});
  const [markingPaidTable, setMarkingPaidTable] = useState<string | null>(null);

  const [moveFromTable, setMoveFromTable] = useState("");
  const [moveToTable, setMoveToTable] = useState("");
  const [movingTable, setMovingTable] = useState(false);
  const [tableChangeOpen, setTableChangeOpen] = useState(false);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editOrderTableNumber, setEditOrderTableNumber] = useState("");
  const [editItems, setEditItems] = useState<OrderItemInput[]>([]);
  const [editSearchTerm, setEditSearchTerm] = useState("");
  const [editRemarksOpen, setEditRemarksOpen] = useState(false);
  const [editRemarks, setEditRemarks] = useState("");
  const [savingEditOrder, setSavingEditOrder] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null);

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [dbPassword, setDbPassword] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => {
      setToast("");
    }, 2000);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLogin = localStorage.getItem(`waiter_logged_in_${RESTAURANT_ID}`);
    if (savedLogin === "true") {
      setUnlocked(true);
    }

    const savedSound = localStorage.getItem(
      `waiter_sound_enabled_${RESTAURANT_ID}`
    );
    if (savedSound === "true") {
      setSoundEnabled(true);
    }
  }, []);

  async function fetchRestaurant() {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", RESTAURANT_ID)
      .single();

    if (!error && data) {
      const restaurantData = data as Record<string, any>;
      setRestaurantName(
        restaurantData.name ||
          restaurantData.restaurant_name ||
          restaurantData.restaurant ||
          restaurantData.title ||
          "Restaurant"
      );
      setDbPassword(restaurantData.waiter_password || "");
    }
  }

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
      localStorage.setItem(`waiter_logged_in_${RESTAURANT_ID}`, "true");
      showToast("Welcome back!");
    } else {
      alert("Wrong password");
    }
  }

  function handleLogout() {
    localStorage.removeItem(`waiter_logged_in_${RESTAURANT_ID}`);
    setUnlocked(false);
    setPassword("");
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
    if (!soundEnabled) return;
    audioRef.current?.play().catch(() => {});
  }

  async function enableSound() {
    try {
      if (audioRef.current) {
        audioRef.current.volume = 0;
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1;
      }

      setSoundEnabled(true);
      localStorage.setItem(`waiter_sound_enabled_${RESTAURANT_ID}`, "true");
      showToast("Waiter sound enabled");
    } catch {
      alert("Could not enable sound. Please tap again.");
    }
  }

  useEffect(() => {
    fetchRestaurant();
    fetchOrders();
    fetchMenu();
    fetchPopularItems();
    fetchWaiterPassword();

    const ordersChannel = supabase
      .channel(`waiter-orders-realtime-${RESTAURANT_ID}`)
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
      .channel(`waiter-order-items-realtime-${RESTAURANT_ID}`)
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
      .channel(`waiter-menu-items-realtime-${RESTAURANT_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `restaurant_id=eq.${RESTAURANT_ID}`,
        },
        () => {
          fetchMenu();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchRestaurant();
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
    const newNotifications: ReadyNotification[] = [];

    orders.forEach((order) => {
      if (order.is_paid === true) return;

      const newlyReadyItems = (order.order_items || []).filter(
        (item) => item.status === "ready" && !seenReadyItemIds.includes(item.id)
      );

      if (newlyReadyItems.length > 0) {
        newlyReadyItems.forEach((item) => {
          newNotifications.push({
            uniqueKey: `${order.id}-${item.id}`,
            orderId: order.id,
            tableNumber: String(order.table_number),
            items: [
              {
                id: item.id,
                item_name: item.item_name,
                quantity: Number(item.quantity || 0),
              },
            ],
          });
        });
      }
    });

    if (newNotifications.length === 0) return;

    setReadyNotifications((prev) => [...prev, ...newNotifications]);
    setSeenReadyItemIds((prev) => [
      ...prev,
      ...newNotifications.flatMap((notification) =>
        notification.items.map((item) => item.id)
      ),
    ]);
  }, [orders, seenReadyItemIds]);

  useEffect(() => {
    if (readyNotifications.length === 0) return;
    playNotificationBeep();
  }, [readyNotifications.length, soundEnabled]);

  function closeCurrentReadyNotification() {
    setReadyNotifications((prev) => prev.slice(1));
  }

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
    setEditRemarks(order.remarks || "");
    setEditRemarksOpen(!!order.remarks);
  }

  function cancelEditOrder() {
    setEditingOrderId(null);
    setEditOrderTableNumber("");
    setEditItems([]);
    setEditSearchTerm("");
    setEditRemarks("");
    setEditRemarksOpen(false);
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
        remarks: editRemarks.trim() || null,
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
      status: "pending",
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
    showToast("Order updated successfully");
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
    showToast("Order cancelled successfully");
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
          remarks: remarks.trim() || null,
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
      status: "pending",
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
    setRemarks("");
    setRemarksOpen(false);
    fetchOrders();
    fetchPopularItems();
    showToast("Order sent to kitchen");
  }

  async function handleAddMenuItem(e: React.FormEvent) {
    e.preventDefault();

    if (!newItemName.trim()) {
      alert("Please enter item name");
      return;
    }

    if (!newItemPrice.trim() || Number(newItemPrice) <= 0) {
      alert("Please enter valid price");
      return;
    }

    const { error } = await supabase.from("menu_items").insert([
      {
        restaurant_id: RESTAURANT_ID,
        item_name: newItemName.trim(),
        price: Number(newItemPrice),
      },
    ]);

    if (error) {
      alert("Failed to add menu item");
      return;
    }

    setNewItemName("");
    setNewItemPrice("");
    await fetchMenu();
    showToast("Menu item added successfully");
  }

  const groupedTableOrders = useMemo(() => {
    const unpaidOrders = orders.filter((order) => order.is_paid !== true);
    const map: Record<string, GroupedTableOrder> = {};

    unpaidOrders.forEach((order) => {
      const tableNo = String(order.table_number || "").trim();
      if (!tableNo) return;

      if (!map[tableNo]) {
        map[tableNo] = {
          table_number: tableNo,
          order_ids: [],
          remarks: [],
          items: [],
          total: 0,
          unpaid_orders_count: 0,
          sourceOrders: [],
        };
      }

      map[tableNo].order_ids.push(order.id);
      map[tableNo].unpaid_orders_count += 1;
      map[tableNo].sourceOrders.push(order);

      if (order.remarks && order.remarks.trim()) {
        map[tableNo].remarks.push(order.remarks.trim());
      }

      order.order_items?.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal = quantity * unitPrice;

        const existingItem = map[tableNo].items.find(
          (entry) => entry.item_name === item.item_name
        );

        if (existingItem) {
          existingItem.quantity += quantity;
          existingItem.total += lineTotal;
          existingItem.statuses.push(item.status || "pending");
        } else {
          map[tableNo].items.push({
            item_name: item.item_name,
            quantity,
            total: lineTotal,
            statuses: [item.status || "pending"],
          });
        }

        map[tableNo].total += lineTotal;
      });
    });

    return Object.values(map)
      .sort((a, b) => {
        const aNum = Number(a.table_number);
        const bNum = Number(b.table_number);

        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          return aNum - bNum;
        }

        return a.table_number.localeCompare(b.table_number);
      })
      .map((table) => ({
        ...table,
        items: table.items.sort((a, b) => {
          const aHasReady = a.statuses.includes("ready");
          const bHasReady = b.statuses.includes("ready");

          if (aHasReady && !bHasReady) return -1;
          if (!aHasReady && bHasReady) return 1;

          return a.item_name.localeCompare(b.item_name);
        }),
      }));
  }, [orders]);

  const filteredGroupedTableOrders = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();

    if (!search) return groupedTableOrders;

    return groupedTableOrders.filter((table) =>
      table.table_number.toLowerCase().includes(search)
    );
  }, [groupedTableOrders, tableSearch]);

  const recentPaidOrders = useMemo(() => {
    return orders
      .filter((order) => order.is_paid === true)
      .sort((a, b) => {
        const aTime = a.paid_at
          ? new Date(a.paid_at).getTime()
          : new Date(a.created_at).getTime();
        const bTime = b.paid_at
          ? new Date(b.paid_at).getTime()
          : new Date(b.created_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [orders]);

  async function markGroupedTableAsPaid(
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

    setMarkingPaidTable(normalizedTableNo);

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

    setMarkingPaidTable(null);

    if (error) {
      alert("Failed to mark orders as paid");
      return;
    }

    await fetchOrders();
    showToast(`Table ${normalizedTableNo} paid successfully`);

    setReadyNotifications((prev) =>
      prev.filter(
        (notification) => notification.tableNumber.trim() !== normalizedTableNo
      )
    );
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
    setMoveFromTable("");
    setMoveToTable("");
    showToast(`Table moved from ${oldTable} to ${newTable}`);
  }

  const currentReadyNotification = readyNotifications[0] || null;

  function getGroupedPaymentButtonClass(
    tableNo: string,
    method: "cash" | "qr" | "card"
  ) {
    const selected = tablePaymentMethods[tableNo] || "cash";

    return `py-2 rounded-xl text-sm font-medium ${
      selected === method
        ? "bg-blue-600 text-white"
        : "bg-gray-200 text-gray-800"
    }`;
  }

  function getItemStatusClass(status?: string) {
    if (status === "ready") {
      return "bg-green-100 text-green-700";
    }
    if (status === "preparing") {
      return "bg-yellow-100 text-yellow-700";
    }
    return "bg-gray-200 text-gray-700";
  }

  function formatPaymentMethod(method?: string | null) {
    if (method === "qr") return "QR";
    if (method === "card") return "Card";
    return "Cash";
  }

  function getOrderTotal(order: OrderRow) {
    return (
      order.order_items?.reduce((sum, item) => {
        return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
      }, 0) || 0
    );
  }

  if (!unlocked) {
    return (
      <>
        {toast && (
          <div className="fixed top-4 right-4 z-50">
            <div className="bg-green-600 text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold">
              {toast}
            </div>
          </div>
        )}

        <main className="min-h-screen bg-gray-100 p-3">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow p-5 space-y-4 border">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  {restaurantName || "Restaurant"}
                </h1>
                <p className="text-sm text-gray-500 mt-1">Waiter Panel Login</p>
              </div>

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
                className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold"
              >
                Enter
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <audio ref={audioRef} src="/bell.mp3" preload="auto" />

      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-green-600 text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold">
            {toast}
          </div>
        </div>
      )}

      <main className="min-h-screen bg-gray-100 p-3">
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-white rounded-3xl shadow p-4 border space-y-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg font-bold shrink-0">
                  {restaurantName ? restaurantName.charAt(0).toUpperCase() : "R"}
                </div>

                <h1 className="text-lg font-bold text-center flex-1 mx-2 truncate">
                  {restaurantName || "Restaurant"}
                </h1>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-white text-red-600 px-3 py-1.5 rounded-full text-xs font-semibold shadow shrink-0"
                >
                  Logout
                </button>
              </div>

              <div className="flex justify-center">
                <div className="px-4 py-1.5 rounded-full bg-white/20 text-sm font-semibold">
                  Waiter Panel
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {currentReadyNotification && (
                <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-700">
                        📢 Table Ready
                      </p>
                      <h2 className="text-xl font-bold text-green-900 mt-1">
                        Table {currentReadyNotification.tableNumber} is ready
                      </h2>
                      <p className="text-sm text-green-800 mt-1">
                        Order #{currentReadyNotification.orderId}
                      </p>

                      <div className="mt-3 space-y-1">
                        {currentReadyNotification.items.map((item) => (
                          <p
                            key={item.id}
                            className="text-sm text-green-900 font-medium"
                          >
                            {item.item_name} x {item.quantity}
                          </p>
                        ))}
                      </div>

                      {readyNotifications.length > 1 && (
                        <p className="text-xs text-green-700 mt-3">
                          {readyNotifications.length - 1} more ready notification(s) remaining
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={closeCurrentReadyNotification}
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

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setRemarksOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between border rounded-2xl px-4 py-3 bg-gray-50"
                  >
                    <span className="text-sm font-semibold">Remarks Section</span>
                    <span className="text-sm font-semibold text-blue-600">
                      {remarksOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {remarksOpen && (
                    <div className="border rounded-2xl p-3 bg-gray-50">
                      <label className="block text-sm font-semibold mb-2">
                        Customer Remarks
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Example: cheese badi halnu, chini nahalnu, thorai piro..."
                        rows={3}
                        className="w-full border rounded-xl px-4 py-3 text-sm resize-none"
                      />
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

              <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                <button
                  type="button"
                  onClick={() => setTableOrdersOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <h2 className="text-xl font-bold">Table Orders</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Search and manage unpaid table orders
                    </p>
                  </div>

                  <span className="text-sm font-semibold text-blue-600">
                    {tableOrdersOpen ? "Hide" : "Show"}
                  </span>
                </button>

                {tableOrdersOpen && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        Search Table Number
                      </label>
                      <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Enter table number"
                        className="w-full border rounded-xl px-4 py-3"
                      />
                    </div>

                    {filteredGroupedTableOrders.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No unpaid table orders found.
                      </p>
                    )}

                    {filteredGroupedTableOrders.map((table) => {
                      const selectedPaymentMethod =
                        tablePaymentMethods[table.table_number] || "cash";

                      const readyItems = table.items.filter((item) =>
                        item.statuses.includes("ready")
                      );
                      const otherItems = table.items.filter(
                        (item) => !item.statuses.includes("ready")
                      );

                      const singleEditableOrder =
                        table.sourceOrders.length === 1 &&
                        table.sourceOrders[0].status === "pending" &&
                        table.sourceOrders[0].is_paid !== true
                          ? table.sourceOrders[0]
                          : null;

                      const isEditingThisCard =
                        singleEditableOrder &&
                        editingOrderId === singleEditableOrder.id;

                      return (
                        <div
                          key={table.table_number}
                          className={`border rounded-2xl p-4 bg-gray-50 space-y-4 ${
                            isEditingThisCard ? "border-2 border-yellow-300" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold">
                                  Table {table.table_number}
                                </h3>

                                <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700">
                                  Unpaid
                                </span>

                                {isEditingThisCard && (
                                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                                    Editing
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-gray-500 mt-1">
                                Unpaid Orders: {table.unpaid_orders_count}
                              </p>
                            </div>

                            {isEditingThisCard && (
                              <button
                                type="button"
                                onClick={cancelEditOrder}
                                className="bg-gray-400 text-white px-3 py-2 rounded-xl text-sm font-medium"
                              >
                                Close
                              </button>
                            )}
                          </div>

                          {!isEditingThisCard && (
                            <>
                              {readyItems.length > 0 && (
                                <div className="border border-green-200 rounded-2xl p-3 bg-green-50 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-green-700">
                                      Ready Items
                                    </p>
                                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-600 text-white animate-pulse">
                                      Ready
                                    </span>
                                  </div>

                                  {readyItems.map((item) => (
                                    <div
                                      key={`ready-${table.table_number}-${item.item_name}`}
                                      className="flex items-center justify-between border rounded-xl px-3 py-2 bg-white"
                                    >
                                      <div>
                                        <p className="text-sm font-medium text-green-800">
                                          {item.item_name} x {item.quantity}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                          Ready
                                        </span>
                                        <p className="text-sm font-semibold">
                                          Rs. {item.total}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {otherItems.length > 0 && (
                                <div className="space-y-2">
                                  {otherItems.map((item) => {
                                    const currentStatus = item.statuses.includes(
                                      "preparing"
                                    )
                                      ? "preparing"
                                      : item.statuses.includes("pending")
                                      ? "pending"
                                      : item.statuses[0] || "pending";

                                    return (
                                      <div
                                        key={`${table.table_number}-${item.item_name}`}
                                        className="flex items-center justify-between border rounded-xl px-3 py-2 bg-white"
                                      >
                                        <div>
                                          <p className="text-sm font-medium">
                                            {item.item_name} x {item.quantity}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getItemStatusClass(
                                              currentStatus
                                            )}`}
                                          >
                                            {currentStatus}
                                          </span>
                                          <p className="text-sm font-semibold">
                                            Rs. {item.total}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {table.remarks.length > 0 && (
                                <div className="border rounded-xl p-3 bg-yellow-50">
                                  <p className="text-xs font-semibold text-gray-600 mb-2">
                                    Remarks
                                  </p>
                                  <div className="space-y-1">
                                    {table.remarks.map((remark, index) => (
                                      <p
                                        key={`${table.table_number}-remark-${index}`}
                                        className="text-sm text-gray-800 whitespace-pre-wrap"
                                      >
                                        • {remark}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                <div className="flex items-center justify-between text-lg font-bold text-red-700">
                                  <span>Total</span>
                                  <span>Rs. {table.total}</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="block text-sm font-semibold">
                                  Payment Method
                                </label>

                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTablePaymentMethods((prev) => ({
                                        ...prev,
                                        [table.table_number]: "cash",
                                      }))
                                    }
                                    className={getGroupedPaymentButtonClass(
                                      table.table_number,
                                      "cash"
                                    )}
                                  >
                                    Cash
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTablePaymentMethods((prev) => ({
                                        ...prev,
                                        [table.table_number]: "qr",
                                      }))
                                    }
                                    className={getGroupedPaymentButtonClass(
                                      table.table_number,
                                      "qr"
                                    )}
                                  >
                                    QR
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTablePaymentMethods((prev) => ({
                                        ...prev,
                                        [table.table_number]: "card",
                                      }))
                                    }
                                    className={getGroupedPaymentButtonClass(
                                      table.table_number,
                                      "card"
                                    )}
                                  >
                                    Card
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  markGroupedTableAsPaid(
                                    table.table_number,
                                    selectedPaymentMethod
                                  )
                                }
                                disabled={markingPaidTable === table.table_number}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
                              >
                                {markingPaidTable === table.table_number
                                  ? "Marking..."
                                  : "Mark as Paid"}
                              </button>

                              {singleEditableOrder && (
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditOrder(singleEditableOrder)}
                                    className="bg-yellow-500 text-white py-2 rounded-xl font-semibold"
                                  >
                                    Edit Order
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCancelOrder(singleEditableOrder.id)
                                    }
                                    disabled={
                                      cancelingOrderId === singleEditableOrder.id
                                    }
                                    className="bg-red-600 text-white py-2 rounded-xl font-semibold"
                                  >
                                    {cancelingOrderId === singleEditableOrder.id
                                      ? "Canceling..."
                                      : "Cancel Order"}
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {isEditingThisCard && singleEditableOrder && (
                            <>
                              <div>
                                <label className="block text-sm font-semibold mb-2">
                                  Table Number
                                </label>
                                <input
                                  type="text"
                                  value={editOrderTableNumber}
                                  onChange={(e) =>
                                    setEditOrderTableNumber(e.target.value)
                                  }
                                  placeholder="Enter table number"
                                  className="w-full border rounded-xl px-4 py-3 bg-white"
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
                                    onChange={(e) =>
                                      setEditSearchTerm(e.target.value)
                                    }
                                    placeholder="Search item..."
                                    className="flex-1 border rounded-xl px-4 py-3 text-base bg-white"
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
                                    className="border rounded-2xl p-3 bg-white space-y-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <p className="font-medium">
                                          {item.item_name}
                                        </p>
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
                                        onClick={() =>
                                          decreaseEditQuantity(index)
                                        }
                                        className="bg-gray-300 px-4 py-2 rounded-xl text-lg font-bold"
                                      >
                                        -
                                      </button>

                                      <div className="flex-1 text-center border rounded-xl py-2 text-lg font-semibold bg-gray-50">
                                        {item.quantity}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          increaseEditQuantity(index)
                                        }
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

                              <div className="space-y-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditRemarksOpen((prev) => !prev)
                                  }
                                  className="w-full flex items-center justify-between border rounded-2xl px-4 py-3 bg-white"
                                >
                                  <span className="text-sm font-semibold">
                                    Remarks Section
                                  </span>
                                  <span className="text-sm font-semibold text-blue-600">
                                    {editRemarksOpen ? "Hide" : "Show"}
                                  </span>
                                </button>

                                {editRemarksOpen && (
                                  <div className="border rounded-2xl p-3 bg-white">
                                    <label className="block text-sm font-semibold mb-2">
                                      Customer Remarks
                                    </label>
                                    <textarea
                                      value={editRemarks}
                                      onChange={(e) =>
                                        setEditRemarks(e.target.value)
                                      }
                                      placeholder="Example: cheese badi halnu, chini nahalnu, thorai piro..."
                                      rows={3}
                                      className="w-full border rounded-xl px-4 py-3 text-sm resize-none"
                                    />
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

                              <button
                                type="button"
                                onClick={() =>
                                  handleCancelOrder(singleEditableOrder.id)
                                }
                                disabled={
                                  cancelingOrderId === singleEditableOrder.id
                                }
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold"
                              >
                                {cancelingOrderId === singleEditableOrder.id
                                  ? "Canceling..."
                                  : "Cancel Order"}
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                <button
                  type="button"
                  onClick={() => setPaidHistoryOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <h2 className="text-xl font-bold">Paid History</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Latest 10 paid orders
                    </p>
                  </div>

                  <span className="text-sm font-semibold text-blue-600">
                    {paidHistoryOpen ? "Hide" : "Show"}
                  </span>
                </button>

                {paidHistoryOpen && (
                  <div className="space-y-4 pt-2">
                    {recentPaidOrders.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No paid history available.
                      </p>
                    )}

                    {recentPaidOrders.map((order) => (
                      <div
                        key={order.id}
                        className="border rounded-[24px] p-4 bg-white space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-2xl font-bold leading-none">
                              Table {order.table_number}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              Order #{order.id}
                            </p>
                          </div>

                          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                            Paid
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-gray-800">
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

                        <div className="border-t border-gray-400 pt-3 space-y-1">
                          <p className="text-xl font-semibold">
                            Total:{" "}
                            <span className="font-normal">
                              Rs. {getOrderTotal(order)}
                            </span>
                          </p>
                          <p className="text-lg font-semibold">
                            Method:{" "}
                            <span className="font-normal">
                              {formatPaymentMethod(order.payment_method)}
                            </span>
                          </p>
                          <p className="text-lg font-semibold">
                            Paid At:{" "}
                            <span className="font-normal">
                              {order.paid_at
                                ? new Date(order.paid_at).toLocaleString()
                                : "-"}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                <button
                  type="button"
                  onClick={() => setTableChangeOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h2 className="text-xl font-bold">Table Change</h2>
                  <span className="text-sm font-semibold text-blue-600">
                    {tableChangeOpen ? "Hide" : "Show"}
                  </span>
                </button>

                {tableChangeOpen && (
                  <div className="space-y-4 pt-2">
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
                )}
              </div>

              <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                <button
                  type="button"
                  onClick={() => setAddMenuOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <h2 className="text-xl font-bold">Add Menu Items</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Add new items directly from waiter panel
                    </p>
                  </div>

                  <span className="text-sm font-semibold text-blue-600">
                    {addMenuOpen ? "Hide" : "Show"}
                  </span>
                </button>

                {addMenuOpen && (
                  <div className="space-y-4 pt-2">
                    <form onSubmit={handleAddMenuItem} className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          Item Name
                        </label>
                        <input
                          type="text"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          placeholder="Enter item name"
                          className="w-full border rounded-xl px-4 py-3"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          Price
                        </label>
                        <input
                          type="number"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                          placeholder="Enter item price"
                          className="w-full border rounded-xl px-4 py-3"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
                      >
                        Add Menu Item
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={enableSound}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold text-white ${
                    soundEnabled ? "bg-green-600" : "bg-blue-600"
                  }`}
                >
                  {soundEnabled ? "🔔 Sound On" : "🔔 Enable Sound"}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-red-600"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}