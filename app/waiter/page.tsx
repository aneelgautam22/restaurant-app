"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppSplash from "@/components/AppSplash";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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


type ConfirmModalState = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  variant: "default" | "success" | "warning";
  onConfirm: null | (() => void | Promise<void>);
};

function WaiterPageContent() {
  const searchParams = useSearchParams();
  const restaurantIdParam = searchParams.get("id");
const restaurantId = restaurantIdParam ? Number(restaurantIdParam) : null;

  const [restaurantName, setRestaurantName] = useState("");
  useEffect(() => {
  if (!restaurantId) return;

  localStorage.setItem("lastRestaurantId", String(restaurantId));
  localStorage.setItem("lastPanel", "waiter");
}, [restaurantId]);

  const [tableNumber, setTableNumber] = useState("");
  const [items, setItems] = useState<OrderItemInput[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stableOrders, setStableOrders] = useState<OrderRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState("");

  const [readyNotifications, setReadyNotifications] = useState<ReadyNotification[]>([]);
  const [seenReadyItemIds, setSeenReadyItemIds] = useState<number[]>([]);

  const [tableSearch, setTableSearch] = useState("");
  const [selectedTablePopup, setSelectedTablePopup] = useState<GroupedTableOrder | null>(null);

  const [tablePaymentMethods, setTablePaymentMethods] = useState<
    Record<string, "cash" | "qr" | "card">
  >({});
  const [markingPaidTable, setMarkingPaidTable] = useState<string | null>(null);

  const [moveFromTable, setMoveFromTable] = useState("");
  const [moveToTable, setMoveToTable] = useState("");
  const [movingTable, setMovingTable] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [savingMenu, setSavingMenu] = useState(false);
  const [deletingMenuId, setDeletingMenuId] = useState<number | null>(null);

  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editOrderTableNumber, setEditOrderTableNumber] = useState("");
  const [editItems, setEditItems] = useState<OrderItemInput[]>([]);
  const [editSearchTerm, setEditSearchTerm] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [savingEditOrder, setSavingEditOrder] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null);

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(true);

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [toast, setToast] = useState("");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false,
    title: "",
    message: "",
    confirmText: "OK",
    variant: "default",
    onConfirm: null,
  });


  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [orderDetailsView, setOrderDetailsView] = useState<"both" | "kot" | "customer">("both");
  const [orderDetailsTableNumber, setOrderDetailsTableNumber] = useState("");

  const [activeTab, setActiveTab] = useState<
    "order" | "paid" | "change" | "menu"
  >("order");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [cartDragStartY, setCartDragStartY] = useState<number | null>(null);
  const [cartDragOffset, setCartDragOffset] = useState(0);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  }

  function closeConfirmModal() {
    setConfirmModal({
      open: false,
      title: "",
      message: "",
      confirmText: "OK",
      variant: "default",
      onConfirm: null,
    });
  }

  function openConfirmModal(options: Omit<ConfirmModalState, "open">) {
    setConfirmModal({
      open: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      variant: options.variant,
      onConfirm: options.onConfirm,
    });
  }

  function isSameLocalDay(dateStr?: string | null) {
    if (!dateStr) return false;
    const target = new Date(dateStr);
    const now = new Date();
    return (
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate()
    );
  }


  useEffect(() => {
    const t = setTimeout(() => {
      setStableOrders(orders);
    }, 80);

    return () => clearTimeout(t);
  }, [orders]);


  const todayOrders = useMemo(() => {
    return orders.filter((order) => isSameLocalDay(order.created_at));
  }, [orders]);

  const todayStableOrders = useMemo(() => {
    return stableOrders.filter((order) => isSameLocalDay(order.created_at));
  }, [stableOrders]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!restaurantId) {
      setCheckingLogin(false);
      return;
    }

    const savedLogin = localStorage.getItem(`waiter_logged_in_${restaurantId}`);
    if (savedLogin === "true") {
      setUnlocked(true);
    }

    const savedSound = localStorage.getItem(`waiter_sound_enabled_${restaurantId}`);
    if (savedSound === "true") {
      setSoundEnabled(true);
    }

    setCheckingLogin(false);
  }, [restaurantId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  async function fetchRestaurant() {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
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
    }
  }

  async function handleUnlock() {
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

    const { data, error } = await supabase
      .from("restaurants")
      .select("waiter_password")
      .eq("id", restaurantId)
      .single();

    if (error || !data) {
      alert("Failed to check waiter password");
      return;
    }

    if (password === (data.waiter_password || "")) {
      setUnlocked(true);
      localStorage.setItem(`waiter_logged_in_${restaurantId}`, "true");
      showToast("Welcome back!");
    } else {
      alert("Wrong password");
    }
  }

  function handleLogout() {
    if (restaurantId) {
      localStorage.removeItem(`waiter_logged_in_${restaurantId}`);
    }
    setUnlocked(false);
    setPassword("");
    setMenuOpen(false);
  }

  async function fetchOrders() {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as OrderRow[]);
    }
  }

  async function fetchMenu() {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMenuItems(data as MenuItem[]);
    }
  }

  async function fetchPopularItems() {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from("order_items")
      .select("item_name, quantity, orders!inner(restaurant_id)")
      .eq("orders.restaurant_id", restaurantId);

    if (error || !data) return;

    const totals: Record<string, number> = {};

    data.forEach((item) => {
      const name = String(item.item_name || "");
      const qty = Number(item.quantity || 0);
      if (!name) return;
      totals[name] = (totals[name] || 0) + qty;
    });

    const sorted = Object.entries(totals)
      .map(([item_name, total_sold]) => ({ item_name, total_sold }))
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 6);

    setPopularItems(sorted);
  }

  function playNotificationBeep() {
    if (typeof window === "undefined") return;
    if (!soundEnabled) return;
    audioRef.current?.play().catch(() => {});
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  async function subscribeWaiterPush() {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator)) {
      throw new Error("Service worker not supported");
    }

    if (!("PushManager" in window)) {
      throw new Error("Push notification not supported");
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidKey) {
      throw new Error("Missing public VAPID key");
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Notification permission denied");
    }

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        subscription,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save notification subscription");
    }
  }

  async function enableSound() {
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

    try {
      if (audioRef.current) {
        audioRef.current.volume = 0;
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1;
      }

      await subscribeWaiterPush();

      setSoundEnabled(true);
      localStorage.setItem(`waiter_sound_enabled_${restaurantId}`, "true");
      showToast("Waiter sound + notification enabled");
      setMenuOpen(false);
    } catch (error) {
      console.error(error);
      alert("Could not enable notification. Please allow notification and tap again.");
    }
  }

  useEffect(() => {
    if (!restaurantId) return;

    fetchRestaurant();
    fetchOrders();
    fetchMenu();
    fetchPopularItems();

    const ordersChannel = supabase
      .channel(`waiter-orders-realtime-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchOrders();
          fetchPopularItems();
        }
      )
      .subscribe();

    const orderItemsChannel = supabase
      .channel(`waiter-order-items-realtime-${restaurantId}`)
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
      .channel(`waiter-menu-items-realtime-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `restaurant_id=eq.${restaurantId}`,
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
  }, [restaurantId]);

  useEffect(() => {
    const newNotifications: ReadyNotification[] = [];

    todayOrders.forEach((order) => {
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
  }, [todayOrders, seenReadyItemIds]);

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
          i.item_name === menu.item_name ? { ...i, quantity: i.quantity + 1 } : i
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
    const confirmRemove = confirm("Remove this item?");
    if (!confirmRemove) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function closeOrderModal() {
    setOrderModalOpen(false);
    setCartSheetOpen(false);
    setCartDragStartY(null);
    setCartDragOffset(0);
  }

  function openCartSheet() {
    if (items.length === 0) return;
    setCartSheetOpen(true);
  }

  function closeCartSheet() {
    setCartSheetOpen(false);
    setCartDragStartY(null);
    setCartDragOffset(0);
  }

  function handleCartTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    setCartDragStartY(e.touches[0].clientY);
  }

  function handleCartTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (cartDragStartY === null) return;
    const diff = e.touches[0].clientY - cartDragStartY;
    if (diff > 0) {
      setCartDragOffset(diff);
    }
  }

  function handleCartTouchEnd() {
    if (cartDragOffset > 110) {
      closeCartSheet();
      return;
    }

    setCartDragStartY(null);
    setCartDragOffset(0);
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
  }

  function cancelEditOrder() {
    setEditingOrderId(null);
    setEditOrderTableNumber("");
    setEditItems([]);
    setEditSearchTerm("");
    setEditRemarks("");
  }

  function addMenuItemToEditOrder(menu: MenuItem) {
    const existing = editItems.find((i) => i.item_name === menu.item_name);

    if (existing) {
      setEditItems((prev) =>
        prev.map((i) =>
          i.item_name === menu.item_name ? { ...i, quantity: i.quantity + 1 } : i
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
      return menuItems.slice(0, 8);
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
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

    if (!editOrderTableNumber.trim()) {
      alert("Please enter table number");
      return;
    }

    if (!/^\d+$/.test(editOrderTableNumber.trim())) {
      alert("Please enter valid table number");
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
      .eq("restaurant_id", restaurantId);

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
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

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
      .eq("restaurant_id", restaurantId);

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
    setSelectedTablePopup(null);
    showToast("Order cancelled successfully");
  }

  async function handleSaveMenuItem(e: React.FormEvent) {
    e.preventDefault();

    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

    if (!newItemName.trim()) {
      alert("Please enter item name");
      return;
    }

    if (!newItemPrice.trim() || Number(newItemPrice) <= 0) {
      alert("Please enter valid price");
      return;
    }

    setSavingMenu(true);

    if (editingMenuId) {
      const { error } = await supabase
        .from("menu_items")
        .update({
          item_name: newItemName.trim(),
          price: Number(newItemPrice),
        })
        .eq("id", editingMenuId)
        .eq("restaurant_id", restaurantId);

      setSavingMenu(false);

      if (error) {
        alert("Failed to update menu item");
        return;
      }

      setEditingMenuId(null);
      setNewItemName("");
      setNewItemPrice("");
      await fetchMenu();
      showToast("Menu item updated");
      return;
    }

    const { error } = await supabase.from("menu_items").insert([
      {
        restaurant_id: restaurantId,
        item_name: newItemName.trim(),
        price: Number(newItemPrice),
      },
    ]);

    setSavingMenu(false);

    if (error) {
      alert("Failed to add menu item");
      return;
    }

    setNewItemName("");
    setNewItemPrice("");
    await fetchMenu();
    showToast("Menu item added successfully");
  }

  function startEditMenuItem(menu: MenuItem) {
    setEditingMenuId(menu.id);
    setNewItemName(menu.item_name);
    setNewItemPrice(String(menu.price));
    window.scrollTo(0, 0);
  }

  function cancelMenuEdit() {
    setEditingMenuId(null);
    setNewItemName("");
    setNewItemPrice("");
  }

  async function handleDeleteMenuItem(menuId: number) {
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

    const confirmDelete = confirm("Delete this menu item?");
    if (!confirmDelete) return;

    setDeletingMenuId(menuId);

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", menuId)
      .eq("restaurant_id", restaurantId);

    setDeletingMenuId(null);

    if (error) {
      alert("Failed to delete menu item");
      return;
    }

    if (editingMenuId === menuId) {
      cancelMenuEdit();
    }

    await fetchMenu();
    showToast("Menu item deleted");
  }

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const popularMenuItems = useMemo(() => {
    if (popularItems.length === 0) {
      return menuItems.slice(0, 6);
    }

    const mapped = popularItems
      .map((popular) => menuItems.find((menu) => menu.item_name === popular.item_name))
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

  const filteredManageMenuItems = useMemo(() => {
    const source = [...menuItems];
    if (!menuSearch.trim()) {
      return source.slice(0, 5);
    }

    return source.filter((menu) =>
      menu.item_name.toLowerCase().includes(menuSearch.toLowerCase())
    );
  }, [menuItems, menuSearch]);

  const popularItemNames = useMemo(() => {
    return new Set(popularMenuItems.map((item) => item.item_name));
  }, [popularMenuItems]);

  const searchResultMenuItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return menuItems.filter((menu) =>
      menu.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [menuItems, searchTerm]);

  const selectedPreviewItems = useMemo(() => {
    return items.slice(0, 4);
  }, [items]);

  async function submitOrder() {
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

    if (!tableNumber.trim()) {
      alert("Please enter table number");
      return;
    }

    if (!/^\d+$/.test(tableNumber.trim())) {
      alert("Please enter valid table number");
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
          restaurant_id: restaurantId,
          table_number: tableNumber.trim(),
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
    setOrderModalOpen(false);
    setCartSheetOpen(false);
    fetchOrders();
    fetchPopularItems();
    showToast("Order sent to kitchen");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitOrder();
  }

  const groupedTableOrders = useMemo(() => {
    const unpaidOrders = todayStableOrders.filter((order) => order.is_paid !== true);
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
  }, [todayStableOrders]);

  useEffect(() => {
    if (!selectedTablePopup) return;

    const latestTable = groupedTableOrders.find(
      (table) => table.table_number === selectedTablePopup.table_number
    );

    if (!latestTable) {
      setSelectedTablePopup(null);
      return;
    }

    setSelectedTablePopup(latestTable);
  }, [groupedTableOrders, selectedTablePopup]);

  const filteredGroupedTableOrders = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();

    if (!search) return groupedTableOrders;

    return groupedTableOrders.filter((table) =>
      table.table_number.toLowerCase().includes(search)
    );
  }, [groupedTableOrders, tableSearch]);

  useEffect(() => {
    if (!orderDetailsOpen) return;

    if (groupedTableOrders.length === 0) {
      setOrderDetailsTableNumber("");
      return;
    }

    if (
      !orderDetailsTableNumber ||
      !groupedTableOrders.some((table) => table.table_number === orderDetailsTableNumber)
    ) {
      setOrderDetailsTableNumber(groupedTableOrders[0].table_number);
    }
  }, [groupedTableOrders, orderDetailsOpen, orderDetailsTableNumber]);

  const selectedOrderDetailsTable = useMemo(() => {
    if (!orderDetailsTableNumber) return groupedTableOrders[0] || null;
    return (
      groupedTableOrders.find((table) => table.table_number === orderDetailsTableNumber) ||
      groupedTableOrders[0] ||
      null
    );
  }, [groupedTableOrders, orderDetailsTableNumber]);

  const recentPaidOrders = useMemo(() => {
    return todayStableOrders
      .filter((order) => order.is_paid === true)
      .sort((a, b) => {
        const aTime = a.paid_at
          ? new Date(a.paid_at).getTime()
          : new Date(a.created_at).getTime();
        const bTime = b.paid_at
          ? new Date(b.paid_at).getTime()
          : new Date(b.created_at).getTime();
        return bTime - aTime;
      });
  }, [todayStableOrders]);

  async function markGroupedTableAsPaid(
    tableNo: string,
    paymentMethod: "cash" | "qr" | "card"
  ) {
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      alert("Please enter table number");
      return;
    }

    const unpaidOrdersForTable = todayOrders.filter(
      (order) =>
        String(order.table_number).trim() === normalizedTableNo &&
        order.is_paid !== true
    );

    if (unpaidOrdersForTable.length === 0) {
      alert("No unpaid orders found for this table");
      return;
    }

    openConfirmModal({
      title: "Confirm Payment",
      message: `Mark all unpaid orders for table ${normalizedTableNo} as paid with ${paymentMethod.toUpperCase()}?`,
      confirmText: "Mark as Paid",
      variant: "success",
      onConfirm: async () => {
        closeConfirmModal();
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
          .eq("restaurant_id", restaurantId);

        setMarkingPaidTable(null);

        if (error) {
          alert("Failed to mark orders as paid");
          return;
        }

        await fetchOrders();
        showToast(`Table ${normalizedTableNo} paid successfully`);

        setReadyNotifications((prev) =>
          prev.filter((notification) => notification.tableNumber.trim() !== normalizedTableNo)
        );
        setSelectedTablePopup(null);
      },
    });
  }

  async function handleTableMove() {
    if (!restaurantId) {
      alert("Invalid restaurant link");
      return;
    }

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

    const unpaidOrdersForOldTable = todayOrders.filter(
      (order) =>
        String(order.table_number).trim() === oldTable && order.is_paid !== true
    );

    if (unpaidOrdersForOldTable.length === 0) {
      alert("No unpaid orders found for current table");
      return;
    }

    openConfirmModal({
      title: "Move Table",
      message: `Move all unpaid orders from table ${oldTable} to table ${newTable}?`,
      confirmText: "Move Table",
      variant: "warning",
      onConfirm: async () => {
        closeConfirmModal();
        setMovingTable(true);

        const orderIds = unpaidOrdersForOldTable.map((order) => order.id);

        const { error } = await supabase
          .from("orders")
          .update({ table_number: newTable })
          .in("id", orderIds)
          .eq("restaurant_id", restaurantId);

        setMovingTable(false);

        if (error) {
          alert("Failed to move table");
          return;
        }

        await fetchOrders();
        setMoveFromTable("");
        setMoveToTable("");
        showToast(`Table moved from ${oldTable} to ${newTable}`);
        setOrderModalOpen(false);
      },
    });
  }

  const currentReadyNotification = readyNotifications[0] || null;

  function getGroupedPaymentButtonClass(
    tableNo: string,
    method: "cash" | "qr" | "card"
  ) {
    const selected = tablePaymentMethods[tableNo] || "cash";

    return `py-2 rounded-xl text-sm font-medium border active:scale-[0.98] active:opacity-85 ${
      selected === method
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-800 border-gray-300"
    }`;
  }

  function getItemStatusClass(status?: string) {
    if (status === "ready") {
      return "bg-green-100 text-green-700";
    }
    if (status === "preparing") {
      return "bg-orange-100 text-orange-700";
    }
    return "bg-yellow-100 text-yellow-700";
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

  function formatShortPaidTime(dateStr?: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const today = new Date();
    const sameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (sameDay) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    return date.toLocaleString([], {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getBottomButtonClass(tab: "order" | "paid" | "change" | "menu") {
    return `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold active:scale-[0.95] active:opacity-80 ${
      activeTab === tab ? "text-red-600" : "text-black"
    }`;
  }

  function getCreateMenuButtonClass(menu: MenuItem, index: number) {
    const selectedItem = items.find((i) => i.item_name === menu.item_name);
    const isSelected = !!selectedItem;
    const isPopularDefault = index === 0 && !searchTerm.trim();

    if (isSelected) {
      return "bg-green-50 border-green-500 text-green-800";
    }

    if (isPopularDefault) {
      return "bg-amber-50 border-amber-300 text-amber-800";
    }

    return "bg-gray-50 border-gray-200 text-slate-800";
  }

  function formatBillDate(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getPrimaryOrderTime(table: GroupedTableOrder) {
    return table.sourceOrders
      .map((order) => order.created_at)
      .sort()[0] || null;
  }

  function getBillDocumentHtml(table: GroupedTableOrder, type: "kot" | "customer") {
    const billTitle = type === "kot" ? "Kitchen Order Ticket (KOT)" : "Customer Bill";
    const createdAt = formatBillDate(getPrimaryOrderTime(table));
    const remarksHtml =
      table.remarks.length > 0
        ? `<div class="section"><div class="section-title">Remarks</div>${table.remarks
            .map((remark) => `<div class="remark">• ${escapeHtml(remark)}</div>`)
            .join("")}</div>`
        : "";

    const rows = table.items
      .map((item, index) => {
        if (type === "kot") {
          return `<tr><td>${index + 1}</td><td>${escapeHtml(item.item_name)}</td><td>${item.quantity}</td></tr>`;
        }

        const unitPrice = item.quantity > 0 ? Math.round(item.total / item.quantity) : 0;
        return `<tr><td>${index + 1}</td><td>${escapeHtml(item.item_name)}</td><td>${item.quantity}</td><td>Rs. ${unitPrice}</td><td>Rs. ${item.total}</td></tr>`;
      })
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(restaurantName || "Restaurant")} - ${billTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
    .page { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .title { font-size: 28px; font-weight: 800; margin: 0; }
    .sub { color: #475569; margin-top: 6px; }
    .badge { background: ${type === "kot" ? "#eff6ff" : "#fef2f2"}; color: ${type === "kot" ? "#1d4ed8" : "#dc2626"}; border: 1px solid ${type === "kot" ? "#bfdbfe" : "#fecaca"}; padding: 8px 14px; border-radius: 999px; font-weight: 700; }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; }
    .meta-label { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 6px; font-weight: 700; }
    .meta-value { font-size: 18px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f8fafc; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
    .section { margin-top: 20px; }
    .section-title { font-size: 16px; font-weight: 800; margin-bottom: 10px; }
    .remark { background: #fff7ed; border: 1px solid #fed7aa; padding: 10px 12px; border-radius: 12px; margin-bottom: 8px; }
    .total { margin-top: 20px; display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-radius: 16px; background: #fef2f2; border: 1px solid #fecaca; font-size: 22px; font-weight: 800; color: #b91c1c; }
    @media print { body { background: #fff; padding: 0; } .page { max-width: 100%; border: 0; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="top" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 45%, ${type === "kot" ? "#2563eb" : "#dc2626"} 100%); padding:24px; color:#fff; border-radius:20px; margin-bottom:20px;"><div style="display:flex; align-items:center; gap:14px;"><div style="width:68px; height:68px; border-radius:20px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; overflow:hidden;"><img src="/logo.png" alt="Restaurant Logo" style="width:100%; height:100%; object-fit:contain; padding:8px;" /></div><div><h1 class="title" style="color:#fff;">${escapeHtml(restaurantName || "Restaurant")}</h1><div class="sub" style="color:rgba(255,255,255,0.82);">${billTitle}</div></div></div><div class="badge" style="background:rgba(255,255,255,0.12); color:#fff; border:1px solid rgba(255,255,255,0.24);">Table ${escapeHtml(table.table_number)}</div></div>

    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Table</div>
        <div class="meta-value">${escapeHtml(table.table_number)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Created At</div>
        <div class="meta-value" style="font-size:16px;">${escapeHtml(createdAt)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Order Count</div>
        <div class="meta-value">${table.unpaid_orders_count}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Order IDs</div>
        <div class="meta-value" style="font-size:16px;">${escapeHtml(table.order_ids.join(", "))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>Qty</th>
          ${type === "customer" ? "<th>Rate</th><th>Total</th>" : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${remarksHtml}

    ${type === "customer" ? `<div class="total"><span>Grand Total</span><span>Rs. ${table.total}</span></div>` : `<div class="remark">Kitchen copy only • Price hidden for kitchen team.</div>`}<div class="section" style="margin-top:20px;border-top:1px dashed #cbd5e1;padding-top:14px;display:flex;justify-content:space-between;gap:16px;font-size:12px;color:#64748b;"><div><strong style="color:#0f172a;">${escapeHtml(restaurantName || "Restaurant")}</strong><br/>Thank you for choosing us.</div><div style="text-align:right;">Powered by Restrofy<br/>Generated from Waiter Panel</div></div>
  </div>
</body>
</html>`;
  }

  function printBill(table: GroupedTableOrder, type: "kot" | "customer") {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(getBillDocumentHtml(table, type));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  async function downloadBill(table: GroupedTableOrder, type: "kot" | "customer") {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-99999px";
    iframe.style.top = "0";
    iframe.style.width = "900px";
    iframe.style.height = "1400px";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);

    iframe.srcdoc = getBillDocumentHtml(table, type);

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      setTimeout(() => resolve(), 600);
    });

    const targetDoc = iframe.contentDocument;
    if (!targetDoc?.body) {
      document.body.removeChild(iframe);
      alert("Failed to generate PDF");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));

    const canvas = await html2canvas(targetDoc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: targetDoc.body.scrollWidth,
      height: targetDoc.body.scrollHeight,
      windowWidth: targetDoc.body.scrollWidth,
      windowHeight: targetDoc.body.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight, undefined, "FAST");
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight, undefined, "FAST");
      heightLeft -= usableHeight;
    }

    pdf.save(`${(restaurantName || "restaurant").replace(/\s+/g, "-").toLowerCase()}-table-${table.table_number}-${type}-bill.pdf`);
    document.body.removeChild(iframe);
  }

  function renderBillCard(table: GroupedTableOrder, type: "kot" | "customer", expanded = false) {
    const label = type === "kot" ? "KOT Bill" : "Customer Bill";
    const accent = type === "kot"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-red-200 bg-red-50 text-red-700";

    return (
      <div className={`rounded-[28px] border bg-white shadow-sm ${expanded ? "p-5" : "p-4"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${accent}`}>
              {label}
            </div>
            <h3 className="mt-3 text-2xl font-extrabold text-slate-900">
              {restaurantName || "Restaurant"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Table {table.table_number} • {formatBillDate(getPrimaryOrderTime(table))}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Orders</p>
            <p className="text-lg font-extrabold text-slate-900">{table.unpaid_orders_count}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-500">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold uppercase tracking-wide text-slate-700">Footer</p>
              <p className="mt-1">Thank you for choosing {restaurantName || "Restaurant"}.</p>
              <p>Please keep this bill for your record.</p>
            </div>
            <div className="text-right">
              <p className="font-bold uppercase tracking-wide text-slate-700">Powered by</p>
              <p className="mt-1">Restrofy Waiter Panel</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Order IDs</p>
            <p className="mt-1 text-sm font-bold text-slate-900 break-words">
              {table.order_ids.join(", ")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Table</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{table.table_number}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left font-extrabold text-slate-500">Item</th>
                <th className="px-3 py-3 text-center font-extrabold text-slate-500">Qty</th>
                {type === "customer" && (
                  <>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500">Rate</th>
                    <th className="px-3 py-3 text-right font-extrabold text-slate-500">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {table.items.map((item) => {
                const unitPrice = item.quantity > 0 ? Math.round(item.total / item.quantity) : 0;

                return (
                  <tr key={`${type}-${table.table_number}-${item.item_name}`} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.item_name}</td>
                    <td className="px-3 py-3 text-center font-bold text-slate-900">{item.quantity}</td>
                    {type === "customer" && (
                      <>
                        <td className="px-3 py-3 text-right font-semibold text-slate-700">Rs. {unitPrice}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-900">Rs. {item.total}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {table.remarks.length > 0 && (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-slate-900">Remarks</p>
            <div className="mt-2 space-y-1">
              {table.remarks.map((remark, index) => (
                <p key={`${type}-remark-${index}`} className="text-sm text-slate-800">
                  • {remark}
                </p>
              ))}
            </div>
          </div>
        )}

        {type === "customer" && (
          <div className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-4 flex items-center justify-between">
            <span className="text-base font-bold text-red-600">Grand Total</span>
            <span className="text-2xl font-extrabold text-red-700">Rs. {table.total}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => printBill(table, type)}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white active:scale-[0.98] active:opacity-90"
          >
            Print
          </button>

          <button
            type="button"
            onClick={() => downloadBill(table, type)}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white active:scale-[0.98] active:opacity-90"
          >
            Download PDF
          </button>
        </div>
      </div>
    );
  }

  const restaurantInitial = (restaurantName || "R").trim().charAt(0).toUpperCase();

  if (!restaurantIdParam || Number.isNaN(restaurantId)) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a_0%,_#020617_100%)] flex items-center justify-center p-4">
      <div className="bg-white shadow rounded-2xl p-4 text-center text-sm text-red-600 font-medium">
        Invalid restaurant link. Please use the correct restaurant URL.
      </div>
    </main>
  );
}

  if (checkingLogin) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#19335d_0%,_#08142f_45%,_#030814_100%)] flex items-center justify-center p-4">
        <div className="text-white text-sm font-semibold">Loading...</div>
      </main>
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

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#19335d_0%,_#08142f_45%,_#030814_100%)] px-4 py-6">
        <div className="max-w-md mx-auto min-h-screen flex items-start justify-center">
          <div className="w-full pt-6">
            <div className="text-center mb-5">
<div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[18px] bg-black p-1 shadow-md shrink-0 border-4 border-white overflow-hidden">
  <img
    src="/logo.png"
    alt="Restrofy Logo"
    className="h-full w-full object-cover scale-125"
  />
</div>

            <p className="mt-2 text-sm font-bold tracking-[0.25em] uppercase">
  <span className="text-white">RESTRO</span>
  <span className="text-red-500">FY</span>
</p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                {restaurantName || "Restaurant"}
              </h1>

              <p className="mt-1 text-sm text-slate-300">Waiter Panel Login</p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.38)] p-3">
              <div className="rounded-[22px] bg-white/88 text-slate-900 p-4 shadow-inner border border-white/70">
                <div className="mb-4 rounded-[18px] bg-slate-100/90 border border-slate-200 p-3">
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-slate-500">
                    Secure Access
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-slate-800">
                    Enter waiter password
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-slate-500">
                    Access your waiter workspace for orders and table handling.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <input
                      type="password"
                      placeholder="Enter waiter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent outline-none text-[15px] text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleUnlock}
                    className="w-full rounded-[18px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 text-[16px] font-extrabold shadow-[0_12px_28px_rgba(37,99,235,0.32)] active:scale-[0.98] active:opacity-90 transition"
                  >
                    Enter Waiter Panel
                  </button>
                </div>
              </div>
            </div>
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

      <main className="h-screen overflow-hidden bg-gray-100">
       <div className="max-w-md mx-auto h-full flex flex-col">
          <div className="sticky top-0 z-30 bg-gray-100 px-3 pt-3 pb-2">
           <div className="relative rounded-[28px] bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.25)] px-4 py-4">
              <div className="absolute inset-x-0 bottom-0 h-3 bg-blue-50 rounded-b-[28px]" />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
<div className="w-16 h-16 rounded-[18px] bg-black flex items-center justify-center shadow-md shrink-0 border-4 border-white overflow-hidden p-1">
  <img
    src="/logo.png"
    alt="Restrofy Logo"
    className="h-full w-full object-contain scale-100"
  />
</div>

                  <div className="min-w-0 flex-1">
                    <h1 className="text-[18px] sm:text-[20px] font-extrabold text-slate-900 truncate">
                      {restaurantName || "Restaurant"}
                    </h1>

                    <div className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-4 py-2 text-[13px] font-medium text-slate-700 border border-blue-100">
                      Waiter Panel
                    </div>
                  </div>
                </div>

                <div className="relative shrink-0 z-50" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-2xl font-bold shadow-sm active:scale-[0.96] active:bg-slate-200"
                  >
                    ⋮
                  </button>

                  <div
                    className={`absolute top-14 right-0 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[999] ${
                      menuOpen ? "block" : "hidden"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={enableSound}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] active:bg-slate-100"
                    >
                      <span className="text-lg">🔔</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {soundEnabled ? "Sound On" : "Enable Sound"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {soundEnabled ? "Notification enabled" : "Tap to enable bell"}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOrderDetailsOpen(true);
                        setOrderDetailsView("both");
                        if (groupedTableOrders.length > 0) {
                          setOrderDetailsTableNumber(groupedTableOrders[0].table_number);
                        }
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] active:bg-slate-100"
                    >
                      <span className="text-lg">🧾</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Order Details</p>
                        <p className="text-xs text-slate-500">View KOT and customer bills</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] active:bg-red-100"
                    >
                      <span className="text-lg">🚪</span>
                      <div>
                        <p className="text-sm font-semibold text-red-600">Logout</p>
                        <p className="text-xs text-slate-500">Exit waiter panel</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 pb-32 space-y-2 overflow-y-auto">
            {currentReadyNotification && (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-700">📢 Table Ready</p>
                    <h2 className="text-lg font-bold text-green-900 mt-1">
                      Table {currentReadyNotification.tableNumber} is ready
                    </h2>
                    <p className="text-xs text-green-800 mt-1">
                      Order #{currentReadyNotification.orderId}
                    </p>

                    <div className="mt-2 space-y-1">
                      {currentReadyNotification.items.map((item) => (
                        <p key={item.id} className="text-sm text-green-900 font-medium">
                          {item.item_name} x {item.quantity}
                        </p>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeCurrentReadyNotification}
                    className="bg-white border border-green-300 px-3 py-1 rounded-lg text-xs font-medium active:scale-[0.98] active:opacity-85"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {activeTab === "order" && (
              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-black/10 p-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search table..."
                      className="w-full border border-gray-300 rounded-2xl pl-11 pr-4 py-3 text-sm bg-white"
                    />
                  </div>
                </div>

                {filteredGroupedTableOrders.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-black/10 p-3">
                   <div className="text-center py-6">
  <p className="text-lg font-semibold text-slate-700">No Active Tables</p>
  <p className="text-sm text-slate-400 mt-1">Today ko fresh orders + button bata start gara</p>
</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {filteredGroupedTableOrders.map((table) => {
                    const readyItems = table.items.filter((item) =>
                      item.statuses.includes("ready")
                    );
                    const shortItems = table.items.slice(0, 1);
                    const singleEditableOrder =
                      table.sourceOrders.length === 1 &&
                      table.sourceOrders[0].status === "pending" &&
                      table.sourceOrders[0].is_paid !== true
                        ? table.sourceOrders[0]
                        : null;

                    let badgeText = "Pending";
                    let badgeClass = "bg-yellow-100 text-yellow-800";
                    if (readyItems.length > 0) {
                      badgeText = "Ready";
                      badgeClass = "bg-green-100 text-green-700";
                    } else if (table.items.some((item) => item.statuses.includes("preparing"))) {
                      badgeText = "Preparing";
                      badgeClass = "bg-orange-100 text-orange-700";
                    }

                    return (
                      <div
                        key={table.table_number}
                        className="bg-white rounded-[24px] shadow-md border border-black/10 p-3 space-y-3 min-h-[140px]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            cancelEditOrder();
                            setSelectedTablePopup(table);
                          }}
                          className="w-full text-left space-y-2 active:scale-[0.98] active:opacity-85"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-[18px] font-extrabold text-slate-900 truncate">
                                Table {table.table_number}
                              </h3>
                              <p className="text-[13px] text-slate-500">
                                {table.unpaid_orders_count} unpaid
                              </p>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${badgeClass}`}
                            >
                              {badgeText}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {shortItems.map((item) => (
                              <div
                                key={`${table.table_number}-${item.item_name}`}
                                className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2"
                              >
                                <span className="text-[13px] text-slate-900 truncate pr-2">
                                  {item.item_name} x {item.quantity}
                                </span>
                                <span className="text-[13px] font-semibold text-slate-900 whitespace-nowrap">
                                  Rs. {item.total}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="bg-red-50 border border-red-200 rounded-2xl px-3 py-3">
                            <div className="flex items-center justify-between">
                              <span className="text-red-600 font-semibold text-sm">Total</span>
                              <span className="text-red-600 font-extrabold text-[18px]">
                                Rs. {table.total}
                              </span>
                            </div>
                          </div>
                        </button>

                        {singleEditableOrder ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTablePopup(table);
                                startEditOrder(singleEditableOrder);
                              }}
                              className="bg-amber-400 text-white py-2.5 rounded-2xl text-sm font-bold shadow-sm active:scale-[0.98] active:opacity-85"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCancelOrder(singleEditableOrder.id)}
                              disabled={cancelingOrderId === singleEditableOrder.id}
                              className="bg-red-600 text-white py-2.5 rounded-2xl text-sm font-bold shadow-sm active:scale-[0.98] active:opacity-85 disabled:opacity-70"
                            >
                              {cancelingOrderId === singleEditableOrder.id ? "..." : "Cancel"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              cancelEditOrder();
                              setSelectedTablePopup(table);
                            }}
                            className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-2xl text-sm font-semibold active:scale-[0.98] active:bg-slate-200"
                          >
                            Open
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "paid" && (
              <div className="space-y-3">
                <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-4">
                  <h2 className="text-[18px] font-extrabold text-slate-900">Paid History</h2>
                  <p className="text-sm text-slate-500 mt-1">Today's paid records only</p>
                </div>

                {recentPaidOrders.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-black/10 p-4">
                    <p className="text-sm text-gray-500">No paid history for today.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {recentPaidOrders.map((order) => {
                    const itemLines = (order.order_items || []).map(
                      (item) => `${item.item_name} x ${item.quantity}`
                    );
                    const inlineItems =
                      itemLines.length <= 2
                        ? itemLines.join(", ")
                        : `${itemLines.slice(0, 2).join(", ")} +${itemLines.length - 2} more`;

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-[24px] shadow-sm border border-black/10 p-3 space-y-3 min-h-[160px] active:scale-[0.98] active:opacity-90"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-[18px] font-extrabold text-slate-900 truncate">
                              Table {order.table_number}
                            </h3>
                            <p className="text-[13px] text-slate-500">Order #{order.id}</p>
                          </div>

                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 whitespace-nowrap">
                            ✔ Paid
                          </span>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[13px] text-slate-800 leading-5">
                            {inlineItems || "No items"}
                          </p>

                          <div className="border-t border-gray-200 pt-2">
                            <p className="text-green-700 font-extrabold text-[17px]">
                              Rs. {getOrderTotal(order)}
                            </p>
                            <p className="text-[13px] text-slate-700 mt-1">
                              {formatPaymentMethod(order.payment_method)} •{" "}
                              {formatShortPaidTime(order.paid_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "change" && (
              <div className="space-y-3">
                <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔄</span>
                    <div>
                      <h2 className="text-[18px] font-extrabold text-slate-900">
                        Change Table
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Move all unpaid orders easily
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-4 space-y-4">
                  <div className="border rounded-[20px] p-4 bg-gray-50 space-y-4">
                    <div className="grid grid-cols-[1fr_32px_1fr] gap-2 items-end">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold">From Table</label>
                        <input
                          type="text"
                          value={moveFromTable}
                          onChange={(e) => setMoveFromTable(e.target.value)}
                          placeholder="1"
                          className="w-full border rounded-2xl px-4 py-3 bg-white"
                        />
                      </div>

                      <div className="text-center text-2xl font-bold text-gray-400 pb-3">
                        →
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-bold">To Table</label>
                        <input
                          type="text"
                          value={moveToTable}
                          onChange={(e) => setMoveToTable(e.target.value)}
                          placeholder="5"
                          className="w-full border rounded-2xl px-4 py-3 bg-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTableMove}
                      disabled={movingTable}
                      className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white py-3.5 rounded-2xl font-extrabold shadow-sm active:scale-[0.98] active:opacity-90 disabled:opacity-70"
                    >
                      {movingTable ? "Moving..." : "🔄 Move Table"}
                    </button>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">
                      ⚠️ All unpaid orders will be moved
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "menu" && (
              <div className="space-y-3">
                <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center text-xl">
                      🍽️
                    </div>
                    <div>
                      <h2 className="text-[18px] font-extrabold text-slate-900">
                        {editingMenuId ? "Update Menu Item" : "Add Menu Item"}
                      </h2>
                      <p className="text-sm text-slate-500">
                        Add, search, edit and delete menu items
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveMenuItem} className="space-y-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold">Item Name</label>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Enter item name"
                        className="w-full border border-gray-300 rounded-2xl px-4 py-3"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold">Price</label>
                      <div className="flex items-center border border-gray-300 rounded-2xl overflow-hidden bg-white">
                        <div className="px-4 py-3 text-sm font-bold text-slate-500 border-r bg-gray-50">
                          Rs.
                        </div>
                        <input
                          type="number"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                          placeholder="Enter item price"
                          className="w-full px-4 py-3 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="submit"
                        disabled={savingMenu}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-extrabold shadow-sm active:scale-[0.98] active:opacity-90 disabled:opacity-70"
                      >
                        {savingMenu
                          ? editingMenuId
                            ? "Updating..."
                            : "Adding..."
                          : editingMenuId
                          ? "Update Item"
                          : "+ Add Item"}
                      </button>

                      {editingMenuId && (
                        <button
                          type="button"
                          onClick={cancelMenuEdit}
                          className="w-full bg-slate-200 text-slate-800 py-3.5 rounded-2xl font-extrabold active:scale-[0.98] active:opacity-85"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-4 space-y-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      placeholder="Search menu..."
                      className="w-full border border-gray-300 rounded-2xl pl-11 pr-4 py-3 text-sm bg-white"
                    />
                  </div>

                  {filteredManageMenuItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No menu items found.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredManageMenuItems.map((menu) => (
                        <div
                          key={menu.id}
                          className="flex items-center justify-between gap-2 bg-gray-50 rounded-2xl px-3 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {menu.item_name}
                            </p>
                          </div>

                          <p className="text-sm font-bold text-slate-900 whitespace-nowrap">
                            Rs. {menu.price}
                          </p>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditMenuItem(menu)}
                              className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold border border-blue-100 active:scale-[0.98] active:opacity-85"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteMenuItem(menu.id)}
                              disabled={deletingMenuId === menu.id}
                              className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold border border-red-100 active:scale-[0.98] active:opacity-85 disabled:opacity-70"
                            >
                              {deletingMenuId === menu.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!menuSearch.trim() && (
                    <p className="text-xs text-slate-500">
                      Showing latest 5 items. Search to find any menu item.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {!selectedTablePopup && (
            <div className="fixed inset-x-0 bottom-[95px] z-40 px-4">
              <div className="max-w-md mx-auto flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    cancelEditOrder();
                    setSelectedTablePopup(null);
                    setCartSheetOpen(false);
                    setOrderModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-6 py-4 text-white text-[15px] font-extrabold shadow-[0_14px_32px_rgba(239,68,68,0.32)] active:scale-[0.98] active:opacity-90"
                >
                  <span className="text-[22px] leading-none">＋</span>
                  <span>Take Order</span>
                </button>
              </div>
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white pt-3 pb-4 backdrop-blur-xl border-t border-white/20 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <div className="max-w-md mx-auto flex items-center">
              <button
                type="button"
                onClick={() => {
                  cancelEditOrder();
                  setSelectedTablePopup(null);
                  closeOrderModal();
                  setActiveTab("order");
                }}
                className={getBottomButtonClass("order")}
              >
                <span className="text-base">🧾</span>
                <span>Order</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cancelEditOrder();
                  setSelectedTablePopup(null);
                  closeOrderModal();
                  setActiveTab("paid");
                }}
                className={getBottomButtonClass("paid")}
              >
                <span className="text-base">💰</span>
                <span>Paid</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cancelEditOrder();
                  setSelectedTablePopup(null);
                  closeOrderModal();
                  setActiveTab("change");
                }}
                className={getBottomButtonClass("change")}
              >
                <span className="text-base">🔄</span>
                <span>Change</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cancelEditOrder();
                  setSelectedTablePopup(null);
                  closeOrderModal();
                  setActiveTab("menu");
                }}
                className={getBottomButtonClass("menu")}
              >
                <span className="text-base">🍽️</span>
                <span>Menu</span>
              </button>
            </div>
          </div>
        </div>

        {orderDetailsOpen && (
          <div className="fixed inset-0 z-[80] bg-black/50">
            <div className="max-w-md mx-auto h-full bg-gray-100 flex flex-col">
              <div className="sticky top-0 z-10 border-b bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">Order Details</p>
                    <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Bills</h2>
                    <p className="mt-1 text-sm text-slate-500">KOT bill ra customer bill dubai herna milne</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOrderDetailsOpen(false)}
                    className="rounded-2xl bg-slate-200 px-3 py-2 text-sm font-semibold active:scale-[0.98] active:opacity-85"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-4">
                {groupedTableOrders.length === 0 ? (
                  <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-lg font-extrabold text-slate-900">No active table found</p>
                    <p className="mt-2 text-sm text-slate-500">Order garyo pachi bill yahi dekhine cha.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-extrabold text-slate-900">Select Table</p>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {groupedTableOrders.map((table) => {
                          const active = selectedOrderDetailsTable?.table_number === table.table_number;
                          return (
                            <button
                              key={`bill-table-${table.table_number}`}
                              type="button"
                              onClick={() => setOrderDetailsTableNumber(table.table_number)}
                              className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-extrabold active:scale-[0.98] active:opacity-90 ${
                                active
                                  ? "border-red-600 bg-red-600 text-white"
                                  : "border-slate-300 bg-slate-50 text-slate-800"
                              }`}
                            >
                              Table {table.table_number}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setOrderDetailsView("both")}
                          className={`rounded-2xl px-3 py-3 text-sm font-extrabold active:scale-[0.98] active:opacity-90 ${
                            orderDetailsView === "both"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          Both
                        </button>

                        <button
                          type="button"
                          onClick={() => setOrderDetailsView("kot")}
                          className={`rounded-2xl px-3 py-3 text-sm font-extrabold active:scale-[0.98] active:opacity-90 ${
                            orderDetailsView === "kot"
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          KOT Bill
                        </button>

                        <button
                          type="button"
                          onClick={() => setOrderDetailsView("customer")}
                          className={`rounded-2xl px-3 py-3 text-sm font-extrabold active:scale-[0.98] active:opacity-90 ${
                            orderDetailsView === "customer"
                              ? "bg-red-600 text-white"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          Customer Bill
                        </button>
                      </div>
                    </div>

                    {selectedOrderDetailsTable && orderDetailsView === "both" && (
                      <div className="space-y-4">
                        {renderBillCard(selectedOrderDetailsTable, "kot")}
                        {renderBillCard(selectedOrderDetailsTable, "customer")}
                      </div>
                    )}

                    {selectedOrderDetailsTable && orderDetailsView === "kot" &&
                      renderBillCard(selectedOrderDetailsTable, "kot", true)}

                    {selectedOrderDetailsTable && orderDetailsView === "customer" &&
                      renderBillCard(selectedOrderDetailsTable, "customer", true)}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {orderModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50">
            <div className="max-w-md mx-auto h-full bg-gray-100 flex flex-col">
              <div
                className="sticky top-0 z-10 bg-white border-b px-4 pb-4"
                style={{ paddingTop: "max(env(safe-area-inset-top), 18px)" }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="Table"
                    className="w-[34%] min-w-0 border border-gray-300 rounded-2xl px-3 py-3 text-[16px] font-semibold bg-white"
                  />

                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search menu..."
                    className="flex-1 min-w-0 border border-gray-300 rounded-2xl px-4 py-3 text-[16px] bg-white"
                  />

                  <button
                    type="button"
                    onClick={closeOrderModal}
                    className="shrink-0 bg-gray-200 px-3 py-3 rounded-2xl text-sm font-semibold active:opacity-85"
                  >
                    Close
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-3 pt-3 pb-40 space-y-3">
                  {!searchTerm.trim() && (
                    <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        Popular Items
                      </p>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {popularMenuItems.map((menu, index) => {
                          const selectedItem = items.find(
                            (i) => i.item_name === menu.item_name
                          );

                          return (
                            <button
                              key={menu.id}
                              type="button"
                              onClick={() => addMenuItemToOrder(menu)}
                              className={`relative shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold active:opacity-85 ${getCreateMenuButtonClass(
                                menu,
                                index
                              )}`}
                            >
                              <span className="truncate">
                                {index === 0 ? "🔥 " : ""}
                                {menu.item_name}
                              </span>

                              {selectedItem && (
                                <span className="ml-2 inline-flex rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                  x{selectedItem.quantity}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {searchTerm.trim() && (
                    <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        Search Results
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {searchResultMenuItems.length === 0 && (
                          <p className="col-span-2 text-xs text-gray-500">No matching items</p>
                        )}

                        {searchResultMenuItems.map((menu, index) => {
                          const selectedItem = items.find(
                            (i) => i.item_name === menu.item_name
                          );

                          return (
                            <button
                              key={menu.id}
                              type="button"
                              onClick={() => addMenuItemToOrder(menu)}
                              className={`relative rounded-2xl border px-3 py-3 text-left active:opacity-85 ${getCreateMenuButtonClass(
                                menu,
                                index
                              )}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {menu.item_name}
                                  </p>
                                  <p className="text-xs text-slate-500">Rs. {menu.price}</p>
                                </div>

                                {selectedItem && (
                                  <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                    x{selectedItem.quantity}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-extrabold text-slate-900">
                        Selected Items
                      </h3>

                      {items.length > 4 && (
                        <button
                          type="button"
                          onClick={openCartSheet}
                          className="text-xs font-bold text-blue-600 active:opacity-85"
                        >
                          +{items.length - 4} more
                        </button>
                      )}
                    </div>

                    {items.length === 0 ? (
                      <div className="min-h-[84px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center px-4">
                        <p className="text-sm text-slate-500 text-center">
                          Tap item to add order
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedPreviewItems.map((item, index) => (
                          <div
                            key={`${item.item_name}-${index}`}
                            className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {item.item_name}
                                </p>
                                <p className="text-xs text-slate-500">x{item.quantity}</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="shrink-0 text-[11px] font-bold text-red-600 active:opacity-85"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-[24px] shadow-sm border border-black/10 p-4 space-y-2">
                    <label className="text-sm font-bold text-slate-900">Remarks</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Special instructions (no onion, less spicy...)"
                      rows={3}
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-[16px] resize-none"
                    />
                  </div>
                </div>

                <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-white/95 backdrop-blur px-3 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
                  <div className="max-w-md mx-auto grid grid-cols-4 items-center gap-2">
                    <div className="rounded-2xl bg-slate-100 px-2 py-3 text-center">
                      <p className="text-[11px] font-semibold text-slate-500">Items</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {items.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-red-200 bg-red-50 px-2 py-3 text-center">
                      <p className="text-[11px] font-semibold text-red-500">Total</p>
                      <p className="text-sm font-extrabold text-red-600">
                        Rs. {totalAmount}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openCartSheet}
                      disabled={items.length === 0}
                      className="rounded-2xl bg-slate-200 px-2 py-3 text-sm font-bold text-slate-800 active:opacity-85 disabled:opacity-50"
                    >
                      View Cart
                    </button>

                    <button
                      type="submit"
                      disabled={loading || items.length === 0}
                      className="rounded-2xl bg-green-600 px-2 py-3 text-sm font-extrabold text-white active:opacity-90 disabled:opacity-50"
                    >
                      {loading ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </form>

              {cartSheetOpen && (
                <div className="absolute inset-0 z-[70] bg-black/35 flex items-end">
                  <button
                    type="button"
                    aria-label="Close cart"
                    onClick={closeCartSheet}
                    className="absolute inset-0"
                  />

                  <div
                    className="relative w-full max-w-md mx-auto rounded-t-[28px] bg-white shadow-2xl"
                    style={{
                      transform: `translateY(${cartDragOffset}px)`,
                      transition:
                        cartDragStartY === null ? "transform 180ms ease" : "none",
                    }}
                    onTouchStart={handleCartTouchStart}
                    onTouchMove={handleCartTouchMove}
                    onTouchEnd={handleCartTouchEnd}
                  >
                    <div className="flex justify-center pt-3 pb-2">
                      <div className="h-1.5 w-12 rounded-full bg-slate-300" />
                    </div>

                    <div className="flex items-center justify-between px-4 pb-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Cart</h3>
                        <p className="text-sm text-slate-500">
                          Swipe down or close to dismiss
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={closeCartSheet}
                        className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold active:opacity-85"
                      >
                        Close
                      </button>
                    </div>

                    <div className="max-h-[68vh] overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))] space-y-3">
                      {items.map((item, index) => (
                        <div
                          key={`${item.item_name}-${index}`}
                          className="border border-gray-200 rounded-2xl p-3 bg-gray-50 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {item.item_name}
                              </p>
                              <p className="text-xs text-slate-500">Rs. {item.price} each</p>
                            </div>

                            <div className="text-sm font-bold text-slate-900">
                              Rs. {item.price * item.quantity}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => decreaseQuantity(index)}
                              className="w-10 h-10 rounded-xl bg-green-600 text-white text-lg font-bold active:opacity-85"
                            >
                              −
                            </button>

                            <div className="flex-1 text-center border rounded-xl py-2.5 text-sm font-bold bg-white">
                              {item.item_name} x {item.quantity}
                            </div>

                            <button
                              type="button"
                              onClick={() => increaseQuantity(index)}
                              className="w-10 h-10 rounded-xl bg-green-600 text-white text-lg font-bold active:opacity-85"
                            >
                              +
                            </button>

                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="px-3 h-10 rounded-xl bg-red-500 text-white text-xs font-bold active:opacity-85"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 flex items-center justify-between">
                        <span className="text-sm font-bold text-green-800">Total</span>
                        <span className="text-lg font-extrabold text-green-800">
                          Rs. {totalAmount}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={submitOrder}
                        disabled={loading || items.length === 0}
                        className="w-full rounded-2xl bg-green-600 px-4 py-3 text-base font-extrabold text-white active:opacity-90 disabled:opacity-50"
                      >
                        {loading ? "Sending..." : "Send to Kitchen"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTablePopup && (
          <div className="fixed inset-0 z-50 bg-black/40">
            <div className="max-w-md mx-auto h-full bg-white flex flex-col">
              <div className="sticky top-0 bg-white border-b px-4 py-4 z-10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Table {selectedTablePopup.table_number}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {selectedTablePopup.unpaid_orders_count} unpaid order(s)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTablePopup(null);
                      cancelEditOrder();
                    }}
                    className="bg-gray-200 px-3 py-2 rounded-xl text-sm font-semibold active:scale-[0.98] active:opacity-85"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!editingOrderId && (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm font-extrabold text-slate-900">Items</p>

                      {selectedTablePopup.items.map((item) => {
                        const currentStatus = item.statuses.includes("ready")
                          ? "ready"
                          : item.statuses.includes("preparing")
                          ? "preparing"
                          : "pending";

                        return (
                          <div
                            key={`${selectedTablePopup.table_number}-${item.item_name}`}
                            className="border rounded-2xl px-3 py-3 bg-gray-50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate text-slate-900">
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
                                <p className="text-sm font-bold text-slate-900">
                                  Rs. {item.total}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedTablePopup.remarks.length > 0 && (
                      <div className="border rounded-2xl p-3 bg-yellow-50">
                        <p className="text-sm font-extrabold text-slate-900 mb-2">Remarks</p>
                        <div className="space-y-1">
                          {selectedTablePopup.remarks.map((remark, index) => (
                            <p
                              key={`${selectedTablePopup.table_number}-remark-${index}`}
                              className="text-sm text-slate-800 whitespace-pre-wrap"
                            >
                              • {remark}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between text-lg font-extrabold text-red-700">
                        <span>Total</span>
                        <span>Rs. {selectedTablePopup.total}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-extrabold text-slate-900">
                        Payment Method
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setTablePaymentMethods((prev) => ({
                              ...prev,
                              [selectedTablePopup.table_number]: "cash",
                            }))
                          }
                          className={getGroupedPaymentButtonClass(
                            selectedTablePopup.table_number,
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
                              [selectedTablePopup.table_number]: "qr",
                            }))
                          }
                          className={getGroupedPaymentButtonClass(
                            selectedTablePopup.table_number,
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
                              [selectedTablePopup.table_number]: "card",
                            }))
                          }
                          className={getGroupedPaymentButtonClass(
                            selectedTablePopup.table_number,
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
                          selectedTablePopup.table_number,
                          tablePaymentMethods[selectedTablePopup.table_number] || "cash"
                        )
                      }
                      disabled={markingPaidTable === selectedTablePopup.table_number}
                      className="w-full bg-blue-600 text-white py-3 rounded-2xl font-extrabold active:scale-[0.98] active:opacity-90 disabled:opacity-70"
                    >
                      {markingPaidTable === selectedTablePopup.table_number
                        ? "Marking..."
                        : "Mark as Paid"}
                    </button>

                    {selectedTablePopup.sourceOrders.length === 1 &&
                      selectedTablePopup.sourceOrders[0].status === "pending" &&
                      selectedTablePopup.sourceOrders[0].is_paid !== true && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              startEditOrder(selectedTablePopup.sourceOrders[0])
                            }
                            className="bg-amber-400 text-white py-3 rounded-2xl font-extrabold active:scale-[0.98] active:opacity-85"
                          >
                            Edit Order
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleCancelOrder(selectedTablePopup.sourceOrders[0].id)
                            }
                            disabled={
                              cancelingOrderId === selectedTablePopup.sourceOrders[0].id
                            }
                            className="bg-red-600 text-white py-3 rounded-2xl font-extrabold active:scale-[0.98] active:opacity-85 disabled:opacity-70"
                          >
                            {cancelingOrderId === selectedTablePopup.sourceOrders[0].id
                              ? "Canceling..."
                              : "Cancel Order"}
                          </button>
                        </div>
                      )}
                  </>
                )}

                {editingOrderId && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-extrabold text-slate-900 mb-2">
                        Table Number
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editOrderTableNumber}
                        onChange={(e) =>
                          setEditOrderTableNumber(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="Enter table number"
                        className="w-full border rounded-2xl px-4 py-3 bg-white"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-extrabold text-slate-900 block">
                        Add More Items
                      </label>

                      <input
                        type="text"
                        value={editSearchTerm}
                        onChange={(e) => setEditSearchTerm(e.target.value)}
                        placeholder="Search item..."
                        className="w-full border rounded-2xl px-4 py-3 text-base bg-white"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        {editFilteredMenuItems.map((menu) => (
                          <button
                            key={menu.id}
                            type="button"
                            onClick={() => addMenuItemToEditOrder(menu)}
                            className="bg-gray-100 py-2.5 rounded-2xl text-sm font-semibold border active:scale-[0.98] active:opacity-85"
                          >
                            {menu.item_name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-extrabold text-slate-900 block">
                        Selected Items
                      </label>

                      {editItems.map((item, index) => (
                        <div
                          key={`${item.item_name}-${index}`}
                          className="border rounded-2xl p-3 bg-gray-50 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-900">{item.item_name}</p>
                              <p className="text-sm text-gray-500">Rs. {item.price} each</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeEditItem(index)}
                              className="bg-red-500 text-white px-3 py-2 rounded-xl text-sm font-semibold active:scale-[0.98] active:opacity-85"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => decreaseEditQuantity(index)}
                              className="bg-gray-300 px-4 py-2 rounded-xl text-lg font-bold active:scale-[0.95] active:opacity-85"
                            >
                              -
                            </button>

                            <div className="flex-1 text-center border rounded-xl py-2 text-lg font-bold bg-white">
                              {item.quantity}
                            </div>

                            <button
                              type="button"
                              onClick={() => increaseEditQuantity(index)}
                              className="bg-gray-300 px-4 py-2 rounded-xl text-lg font-bold active:scale-[0.95] active:opacity-85"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right font-bold text-sm text-slate-900">
                            Subtotal: Rs. {item.price * item.quantity}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-extrabold text-slate-900 mb-2">
                        Remarks
                      </label>
                      <textarea
                        value={editRemarks}
                        onChange={(e) => setEditRemarks(e.target.value)}
                        placeholder="Customer remarks"
                        rows={3}
                        className="w-full border rounded-2xl px-4 py-3 text-sm resize-none"
                      />
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between text-lg font-extrabold text-slate-900">
                        <span>Updated Total</span>
                        <span>Rs. {editOrderTotal}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={saveEditedOrder}
                        disabled={savingEditOrder}
                        className="bg-blue-600 text-white py-3 rounded-2xl font-extrabold active:scale-[0.98] active:opacity-90 disabled:opacity-70"
                      >
                        {savingEditOrder ? "Saving..." : "Save Changes"}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditOrder}
                        className="bg-gray-400 text-white py-3 rounded-2xl font-extrabold active:scale-[0.98] active:opacity-85"
                      >
                        Cancel Edit
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTablePopup(null);
                        cancelEditOrder();
                      }}
                      className="w-full bg-black text-white py-3 rounded-2xl font-extrabold active:scale-[0.98] active:opacity-85"
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {confirmModal.open && (
          <div className="fixed inset-0 z-[130] bg-black/55 px-4 flex items-center justify-center">
            <div className="w-full max-w-sm rounded-[28px] border border-white/20 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div
                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] ${
                  confirmModal.variant === "success"
                    ? "bg-green-100 text-green-700"
                    : confirmModal.variant === "warning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Confirm Action
              </div>

              <h3 className="mt-4 text-[24px] font-extrabold text-slate-900">
                {confirmModal.title}
              </h3>

              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                {confirmModal.message}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  className="rounded-full bg-pink-100 px-4 py-3 text-sm font-extrabold text-purple-900 active:scale-[0.98] active:opacity-90"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await confirmModal.onConfirm?.();
                  }}
                  className={`rounded-full px-4 py-3 text-sm font-extrabold text-white active:scale-[0.98] active:opacity-90 ${
                    confirmModal.variant === "success"
                      ? "bg-gradient-to-r from-purple-700 to-fuchsia-600"
                      : confirmModal.variant === "warning"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500"
                      : "bg-slate-900"
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function WaiterPage() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("waiterSplashShown");

    // 👉 यदि पहिले देखाइसकेको छ भने skip
    if (alreadyShown) {
      setShowSplash(false);
      return;
    }

    // 👉 पहिलो पटक मात्र splash देखाउने
    const timer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem("waiterSplashShown", "true");
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <AppSplash subtitle="Opening Waiter Panel..." />;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WaiterPageContent />
    </Suspense>
  );
}