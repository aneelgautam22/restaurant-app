"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppSplash from "@/components/AppSplash";
import PanelLoginCard from "@/components/PanelLoginCard";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import React from "react";

type MenuItem = {
  id: number;
  item_name: string;
  price: number;
  created_at?: string;
};

type OrderItem = {
  id: number;
  item_name: string;
  quantity: number;
  unit_price?: number | null;
  status?: string | null;
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
  order_items?: OrderItem[];
};

type SalesItem = {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
};

type OwnerView =
  | "dashboard"
  | "salesOverview"
  | "report"
  | "billing"
  | "paymentHistory";

type PopupView = "menuItems" | "passwords" | "qrAccess" | "profitPercent" | null;
type SalesPeriod = "day" | "week" | "month";

type DailyTrendPoint = {
  date: string;
  shortLabel: string;
  sales: number;
};

type HoveredTrendPoint = {
  label: string;
  sales: number;
  x: number;
  y: number;
} | null;

type HourlyTrendPoint = {
  hour: number;
  label: string;
  shortLabel: string;
  sales: number;
};

type HoveredHourlyPoint = {
  hour: number;
  label: string;
  sales: number;
  x: number;
  y: number;
} | null;

type KitchenStatusKey = "pending" | "preparing" | "ready";

type GroupedTableOrder = {
  table_number: string;
  order_ids: number[];
  remarks: string[];
  items: {
    item_name: string;
    quantity: number;
    total: number;
    status: KitchenStatusKey;
  }[];
  total: number;
  unpaid_orders_count: number;
  table_status: KitchenStatusKey;
};

type PaidBillTableOrder = {
  table_number: string;
  order_ids: number[];
  remarks: string[];
  items: {
    item_name: string;
    quantity: number;
    total: number;
  }[];
  total: number;
  paid_at?: string | null;
  payment_method?: string | null;
  sourceOrders: OrderRow[];
};

function OwnerPageContent() {
  const searchParams = useSearchParams();
  const restaurantIdParam = searchParams.get("id");
  const restaurantId = restaurantIdParam ? Number(restaurantIdParam) : null;
  const baseUrl =
  typeof window !== "undefined" ? window.location.origin : "";
  const waiterQrUrl = restaurantId ? `${baseUrl}/waiter?id=${restaurantId}` : "";
  const kitchenQrUrl = restaurantId ? `${baseUrl}/kitchen?id=${restaurantId}` : "";

  const [ownerView, setOwnerView] = useState<OwnerView>("dashboard");
  const [popupView, setPopupView] = useState<PopupView>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const [ownerPasswordInput, setOwnerPasswordInput] = useState("");
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [ownerPasswordFromDB, setOwnerPasswordFromDB] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
useEffect(() => {
  if (!restaurantId) return;

  localStorage.setItem("lastRestaurantId", String(restaurantId));
  localStorage.setItem("lastPanel", "owner");
}, [restaurantId]);
  const [restaurantExists, setRestaurantExists] = useState(true);
  const [isSetupDone, setIsSetupDone] = useState(false);
  const [checkingRestaurant, setCheckingRestaurant] = useState(true);

  const [setupRestaurantName, setSetupRestaurantName] = useState("");
  const [setupOwnerPassword, setSetupOwnerPassword] = useState("");
  const [setupWaiterPassword, setSetupWaiterPassword] = useState("");
  const [setupKitchenPassword, setSetupKitchenPassword] = useState("");
  const [settingUpRestaurant, setSettingUpRestaurant] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [editingItemPrice, setEditingItemPrice] = useState("");

  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newWaiterPassword, setNewWaiterPassword] = useState("");
  const [newKitchenPassword, setNewKitchenPassword] = useState("");
  const [savingPasswords, setSavingPasswords] = useState(false);
  const [passwordsLoaded, setPasswordsLoaded] = useState(false);
  const [profitPercent, setProfitPercent] = useState("40");
  const [profitPercentInput, setProfitPercentInput] = useState("40");
  const [savingProfitPercent, setSavingProfitPercent] = useState(false);

  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<HoveredTrendPoint>(null);
  const [hoveredHourlyPoint, setHoveredHourlyPoint] = useState<HoveredHourlyPoint>(null);

  const [tableSearch, setTableSearch] = useState("");
  const [markingPaidTable, setMarkingPaidTable] = useState<string | null>(null);
  const [tablePaymentMethods, setTablePaymentMethods] = useState<
    Record<string, "cash" | "qr" | "card">
  >({});

  const [paymentConfirmModal, setPaymentConfirmModal] = useState<{
    tableNo: string;
    paymentMethod: "cash" | "qr" | "card";
    total: number;
  } | null>(null);

  const [appToast, setAppToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "error" | "info";
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    tone?: "danger" | "default";
    onConfirm: null | (() => void | Promise<void>);
  } | null>(null);
  const [selectedPaidOrder, setSelectedPaidOrder] = useState<OrderRow | null>(null);

  const [dashboardMobileTab, setDashboardMobileTab] = useState<"unpaid" | "activity">(
    "unpaid"
  );
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("day");
  const [kitchenStatusExpanded, setKitchenStatusExpanded] = useState(false);
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState<"all" | KitchenStatusKey>("all");
  const [openedKitchenTables, setOpenedKitchenTables] = useState<Record<string, boolean>>({});

  const menuRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const ordersFetchInFlightRef = useRef(false);
  const menuFetchInFlightRef = useRef(false);
  const restaurantFetchInFlightRef = useRef(false);
const ordersRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const menuRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const restaurantRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getTodayLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [selectedReportDate, setSelectedReportDate] = useState(getTodayLocalDate());
  const [reportFromDate, setReportFromDate] = useState(getTodayLocalDate());
  const [reportToDate, setReportToDate] = useState(getTodayLocalDate());
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
  const timer = setTimeout(() => {
    setShowSplash(false);
  }, 700);

  return () => clearTimeout(timer);
}, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!restaurantId) return;

    const savedOwnerLogin = localStorage.getItem(`owner_logged_in_${restaurantId}`);
    if (savedOwnerLogin === "true") {
      setOwnerUnlocked(true);
    }
  }, [restaurantId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
      }
    }

    if (showHeaderMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHeaderMenu]);

  function showToast(message: string, tone: "success" | "error" | "info" = "success", title?: string) {
    setAppToast({
      title:
        title ||
        (tone === "error" ? "Something went wrong" : tone === "info" ? "Notice" : "Done"),
      message,
      tone,
    });

    window.setTimeout(() => {
      setAppToast((current) => (current?.message === message ? null : current));
    }, 2200);
  }

  function openConfirmDialog(options: {
    title: string;
    message: string;
    confirmText?: string;
    tone?: "danger" | "default";
    onConfirm: null | (() => void | Promise<void>);
  }) {
    setConfirmDialog(options);
  }

  function closeConfirmDialog() {
    setConfirmDialog(null);
  }

  function scrollMainContentToTop() {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function changeView(view: OwnerView) {
  if (ownerView === view && popupView === null) {
    scrollMainContentToTop();
    return;
  }

  setIsSwitching(true);
  setShowHeaderMenu(false);

  // 🔥 instant switch
  setOwnerView(view);
  setPopupView(null);
  scrollMainContentToTop();

  // 🔥 smooth without delay
  requestAnimationFrame(() => {
    setIsSwitching(false);
  });
}

  async function fetchRestaurant(showLoader = false) {
    if (!restaurantId) {
      setRestaurantExists(false);
      setCheckingRestaurant(false);
      return;
    }

    if (restaurantFetchInFlightRef.current) return;
    restaurantFetchInFlightRef.current = true;

    if (showLoader) {
      setCheckingRestaurant(true);
    }

    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (error || !data) {
        setRestaurantExists(false);
        setCheckingRestaurant(false);
        return;
      }

      const restaurantData = data as Record<string, any>;

      setRestaurantExists(true);

      const fetchedRestaurantName =
        restaurantData.name ||
        restaurantData.restaurant_name ||
        restaurantData.restaurant ||
        restaurantData.title ||
        "";

      const fetchedOwnerPassword = restaurantData.owner_password || "";
      const fetchedWaiterPassword = restaurantData.waiter_password || "";
      const fetchedKitchenPassword = restaurantData.kitchen_password || "";
      const fetchedProfitPercent =
        restaurantData.profit_percent !== null && restaurantData.profit_percent !== undefined
          ? String(restaurantData.profit_percent)
          : "40";

      const setupComplete =
        restaurantData.is_setup_done === true ||
        (!!fetchedRestaurantName &&
          fetchedOwnerPassword !== "setup_pending" &&
          fetchedWaiterPassword !== "setup_pending" &&
          fetchedKitchenPassword !== "setup_pending");

      setIsSetupDone(setupComplete);
      setRestaurantName(fetchedRestaurantName || "Restaurant");
      setOwnerPasswordFromDB(fetchedOwnerPassword);
      setProfitPercent(fetchedProfitPercent);
      setProfitPercentInput(fetchedProfitPercent);

      if (!passwordsLoaded) {
        setNewOwnerPassword(fetchedOwnerPassword);
        setNewWaiterPassword(fetchedWaiterPassword);
        setNewKitchenPassword(fetchedKitchenPassword);
        setPasswordsLoaded(true);
      }

      if (!setupComplete) {
        setSetupRestaurantName(fetchedRestaurantName || "");
        setSetupOwnerPassword(
          fetchedOwnerPassword === "setup_pending" ? "" : fetchedOwnerPassword
        );
        setSetupWaiterPassword(
          fetchedWaiterPassword === "setup_pending" ? "" : fetchedWaiterPassword
        );
        setSetupKitchenPassword(
          fetchedKitchenPassword === "setup_pending" ? "" : fetchedKitchenPassword
        );
        setOwnerUnlocked(false);

        if (typeof window !== "undefined") {
          localStorage.removeItem(`owner_logged_in_${restaurantId}`);
        }
      }
    } finally {
      restaurantFetchInFlightRef.current = false;
      setCheckingRestaurant(false);
    }
  }

  async function fetchOrders() {
    if (!restaurantId || !isSetupDone) return;
    if (ordersFetchInFlightRef.current) return;

    ordersFetchInFlightRef.current = true;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data as OrderRow[]);
      }
    } finally {
      ordersFetchInFlightRef.current = false;
    }
  }

  async function fetchMenu() {
    if (!restaurantId || !isSetupDone) return;
    if (menuFetchInFlightRef.current) return;

    menuFetchInFlightRef.current = true;

    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("item_name", { ascending: true });

      if (!error && data) {
        setMenuItems(data as MenuItem[]);
      }
    } finally {
      menuFetchInFlightRef.current = false;
    }
  }

  function scheduleOrdersRefresh(delay = 120) {
    if (typeof window === "undefined") {
      void fetchOrders();
      return;
    }

    if (ordersRefreshTimerRef.current) {
      clearTimeout(ordersRefreshTimerRef.current);
    }

    ordersRefreshTimerRef.current = setTimeout(() => {
      ordersRefreshTimerRef.current = null;
      void fetchOrders();
    }, delay);
  }

  function scheduleMenuRefresh(delay = 120) {
    if (typeof window === "undefined") {
      void fetchMenu();
      return;
    }

    if (menuRefreshTimerRef.current) {
      clearTimeout(menuRefreshTimerRef.current);
    }

    menuRefreshTimerRef.current = setTimeout(() => {
      menuRefreshTimerRef.current = null;
      void fetchMenu();
    }, delay);
  }

  function scheduleRestaurantRefresh(delay = 150) {
    if (typeof window === "undefined") {
      void fetchRestaurant();
      return;
    }

    if (restaurantRefreshTimerRef.current) {
      clearTimeout(restaurantRefreshTimerRef.current);
    }

    restaurantRefreshTimerRef.current = setTimeout(() => {
      restaurantRefreshTimerRef.current = null;
      void fetchRestaurant();
    }, delay);
  }

  useEffect(() => {
    void fetchRestaurant(true);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !isSetupDone) return;

    void fetchOrders();
    void fetchMenu();

    const ordersChannel = supabase
      .channel(`owner-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          scheduleOrdersRefresh(80);
        }
      )
      .subscribe();

    const menuItemsChannel = supabase
      .channel(`owner-menu-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          scheduleMenuRefresh(80);
        }
      )
      .subscribe();

    const orderItemsChannel = supabase
      .channel(`owner-order-items-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          scheduleOrdersRefresh(120);
        }
      )
      .subscribe();

    const restaurantsChannel = supabase
      .channel(`owner-restaurant-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${restaurantId}`,
        },
        () => {
          scheduleRestaurantRefresh(120);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuItemsChannel);
      supabase.removeChannel(orderItemsChannel);
      supabase.removeChannel(restaurantsChannel);

      if (ordersRefreshTimerRef.current) {
        window.clearTimeout(ordersRefreshTimerRef.current);
        ordersRefreshTimerRef.current = null;
      }

      if (menuRefreshTimerRef.current) {
        window.clearTimeout(menuRefreshTimerRef.current);
        menuRefreshTimerRef.current = null;
      }

      if (restaurantRefreshTimerRef.current) {
        window.clearTimeout(restaurantRefreshTimerRef.current);
        restaurantRefreshTimerRef.current = null;
      }
    };
  }, [restaurantId, isSetupDone]);

  async function handleInitialSetup(e: React.FormEvent) {
    e.preventDefault();

    if (!restaurantId) {
      showToast("Invalid restaurant link", "error", "Invalid Link");
      return;
    }

    if (!setupRestaurantName.trim()) {
      showToast("Please enter restaurant name", "error", "Missing Field");
      return;
    }

    if (!setupOwnerPassword.trim()) {
      showToast("Please enter owner password", "error", "Missing Field");
      return;
    }

    if (!setupWaiterPassword.trim()) {
      showToast("Please enter waiter password", "error", "Missing Field");
      return;
    }

    if (!setupKitchenPassword.trim()) {
      showToast("Please enter kitchen password", "error", "Missing Field");
      return;
    }

    setSettingUpRestaurant(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        name: setupRestaurantName.trim(),
        owner_password: setupOwnerPassword.trim(),
        waiter_password: setupWaiterPassword.trim(),
        kitchen_password: setupKitchenPassword.trim(),
        is_setup_done: true,
      })
      .eq("id", restaurantId);

    setSettingUpRestaurant(false);

    if (error) {
      showToast("Failed to complete restaurant setup", "error", "Setup Failed");
      return;
    }

    setRestaurantName(setupRestaurantName.trim());
    setOwnerPasswordFromDB(setupOwnerPassword.trim());
    setNewOwnerPassword(setupOwnerPassword.trim());
    setNewWaiterPassword(setupWaiterPassword.trim());
    setNewKitchenPassword(setupKitchenPassword.trim());
    setIsSetupDone(true);
    showToast("Restaurant setup completed", "success", "Setup Complete");
    fetchRestaurant();
  }

  function unlockOwner() {
    if (!ownerPasswordFromDB || ownerPasswordFromDB === "setup_pending") {
      showToast("Owner password not found. Please complete setup first.", "error", "Setup Required");
      return;
    }

    if (ownerPasswordInput === ownerPasswordFromDB) {
      setOwnerUnlocked(true);
      setOwnerPasswordInput("");
      setOwnerView("dashboard");

      if (restaurantId) {
        localStorage.setItem(`owner_logged_in_${restaurantId}`, "true");
      }

      showToast("Owner panel unlocked", "success", "Login Successful");
    } else {
      showToast("Wrong password", "error", "Login Failed");
    }
  }

  function logoutOwner() {
    if (restaurantId) {
      localStorage.removeItem(`owner_logged_in_${restaurantId}`);
    }

    setOwnerUnlocked(false);
    setOwnerView("dashboard");
    setPopupView(null);
    setShowHeaderMenu(false);
    setEditingMenuId(null);
    setEditingItemName("");
    setEditingItemPrice("");
    setOwnerPasswordInput("");
    setHoveredTrendPoint(null);
    setHoveredHourlyPoint(null);
    setTableSearch("");
    setIsSwitching(false);
  }

  async function handleAddMenuItem(e: React.FormEvent) {
    e.preventDefault();

    if (!restaurantId) {
      showToast("Invalid restaurant link", "error", "Invalid Link");
      return;
    }

    if (!newItemName.trim()) {
      showToast("Please enter item name", "error", "Missing Field");
      return;
    }

    if (!newItemPrice.trim() || Number(newItemPrice) <= 0) {
      showToast("Please enter valid price", "error", "Invalid Price");
      return;
    }

    const { error } = await supabase.from("menu_items").insert([
      {
        restaurant_id: restaurantId,
        item_name: newItemName.trim(),
        price: Number(newItemPrice),
      },
    ]);

    if (error) {
      showToast("Failed to add menu item", "error", "Menu Error");
      return;
    }

    setNewItemName("");
    setNewItemPrice("");
    fetchMenu();
    showToast("Menu item added", "success", "Menu Updated");
  }

  function startEditMenuItem(menu: MenuItem) {
    setEditingMenuId(menu.id);
    setEditingItemName(menu.item_name);
    setEditingItemPrice(String(menu.price));
  }

  function cancelEditMenuItem() {
    setEditingMenuId(null);
    setEditingItemName("");
    setEditingItemPrice("");
  }

  async function saveEditMenuItem(id: number) {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error", "Invalid Link");
      return;
    }

    if (!editingItemName.trim()) {
      showToast("Please enter item name", "error", "Missing Field");
      return;
    }

    if (!editingItemPrice.trim() || Number(editingItemPrice) <= 0) {
      showToast("Please enter valid price", "error", "Invalid Price");
      return;
    }

    const { error } = await supabase
      .from("menu_items")
      .update({
        item_name: editingItemName.trim(),
        price: Number(editingItemPrice),
      })
      .eq("id", id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      showToast("Failed to update menu item", "error", "Menu Error");
      return;
    }

    cancelEditMenuItem();
    fetchMenu();
    showToast("Menu item updated", "success", "Menu Updated");
  }

  async function deleteMenuItem(id: number) {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error", "Invalid Link");
      return;
    }

    openConfirmDialog({
      title: "Delete Menu Item",
      message: "Delete this menu item?",
      confirmText: "Delete",
      tone: "danger",
      onConfirm: async () => {
        closeConfirmDialog();

        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", id)
          .eq("restaurant_id", restaurantId);

        if (error) {
          showToast("Failed to delete menu item", "error", "Menu Error");
          return;
        }

        fetchMenu();
        showToast("Menu item deleted", "success", "Menu Updated");
      },
    });
  }

  function getLocalDateString(dateValue: string) {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getDateWithOffset(offsetDays: number) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatHourLabel(hour: number) {
    const normalized = ((hour % 24) + 24) % 24;
    const suffix = normalized >= 12 ? "PM" : "AM";
    const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
    return `${displayHour} ${suffix}`;
  }

  function formatHourShort(hour: number) {
    const normalized = ((hour % 24) + 24) % 24;
    const suffix = normalized >= 12 ? "PM" : "AM";
    const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
    return `${displayHour}${suffix}`;
  }

  function getNiceCeiling(value: number) {
    if (value <= 0) return 1000;
    if (value <= 100) return 100;
    if (value <= 500) return Math.ceil(value / 100) * 100;
    if (value <= 2000) return Math.ceil(value / 250) * 250;
    if (value <= 10000) return Math.ceil(value / 500) * 500;
    return Math.ceil(value / 1000) * 1000;
  }

  function startOfDay(dateValue = new Date()) {
    const d = new Date(dateValue);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(dateValue: Date, days: number) {
    const d = new Date(dateValue);
    d.setDate(d.getDate() + days);
    return d;
  }

  const todayLocalDate = getTodayLocalDate();
  const yesterdayLocalDate = getDateWithOffset(-1);

  const todayOrders = useMemo(() => {
    return orders.filter((order) => getLocalDateString(order.created_at) === todayLocalDate);
  }, [orders, todayLocalDate]);

  const yesterdayOrders = useMemo(() => {
    return orders.filter(
      (order) => getLocalDateString(order.created_at) === yesterdayLocalDate
    );
  }, [orders, yesterdayLocalDate]);

  const totalOrdersToday = todayOrders.length;

  const totalItemsSoldToday = useMemo(() => {
    return todayOrders.reduce((sum, order) => {
      const qty =
        order.order_items?.reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0
        ) || 0;
      return sum + qty;
    }, 0);
  }, [todayOrders]);

  const totalRevenueToday = useMemo(() => {
    return todayOrders.reduce((sum, order) => {
      const revenue =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + revenue;
    }, 0);
  }, [todayOrders]);

const todayPaidOrders = useMemo(() => {
  return orders.filter(
    (order) =>
      order.is_paid === true &&
      order.paid_at &&
      getLocalDateString(order.paid_at) === todayLocalDate
  );
}, [orders, todayLocalDate]);

const todayPaymentBreakdown = useMemo(() => {
  const totals = {
    cash: 0,
    qr: 0,
    card: 0,
  };

  todayPaidOrders.forEach((order) => {
    const orderTotal =
      order.order_items?.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0
      ) || 0;

    const method =
      order.payment_method === "qr" || order.payment_method === "card"
        ? order.payment_method
        : "cash";

    totals[method] += orderTotal;
  });

  const total = totals.cash + totals.qr + totals.card;

  return {
    ...totals,
    cashPercent: total > 0 ? ((totals.cash / total) * 100).toFixed(1) : "0.0",
    qrPercent: total > 0 ? ((totals.qr / total) * 100).toFixed(1) : "0.0",
    cardPercent: total > 0 ? ((totals.card / total) * 100).toFixed(1) : "0.0",
  };
}, [todayPaidOrders]);

  const totalRevenueYesterday = useMemo(() => {
    return yesterdayOrders.reduce((sum, order) => {
      const revenue =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + revenue;
    }, 0);
  }, [yesterdayOrders]);

  const salesVsYesterday = useMemo(() => {
    const diff = totalRevenueToday - totalRevenueYesterday;

    if (totalRevenueYesterday <= 0) {
      if (totalRevenueToday > 0) {
        return {
          text: `+Rs. ${diff} vs yesterday`,
          className: "text-emerald-600",
        };
      }

      return {
        text: "Rs. 0 vs yesterday",
        className: "text-slate-500",
      };
    }

    const percentage = Math.abs((diff / totalRevenueYesterday) * 100).toFixed(1);

    if (diff > 0) {
      return {
        text: `+${percentage}% vs yesterday`,
        className: "text-emerald-600",
      };
    }

    if (diff < 0) {
      return {
        text: `-${percentage}% vs yesterday`,
        className: "text-rose-600",
      };
    }

    return {
      text: "0% vs yesterday",
      className: "text-slate-500",
    };
  }, [totalRevenueToday, totalRevenueYesterday]);

  const numericProfitPercent = Number(profitPercent || 0);
  const todayProfit = Math.round(totalRevenueToday * (numericProfitPercent / 100));
  const yesterdayProfit = Math.round(totalRevenueYesterday * (numericProfitPercent / 100));

  const profitVsYesterday = useMemo(() => {
    const diff = todayProfit - yesterdayProfit;

    if (yesterdayProfit <= 0) {
      if (todayProfit > 0) {
        return {
          text: `+Rs. ${diff} vs yesterday`,
          className: "text-emerald-600",
        };
      }

      return {
        text: "Rs. 0 vs yesterday",
        className: "text-slate-500",
      };
    }

    const percentage = Math.abs((diff / yesterdayProfit) * 100).toFixed(1);

    if (diff > 0) {
      return {
        text: `+${percentage}% vs yesterday`,
        className: "text-emerald-600",
      };
    }

    if (diff < 0) {
      return {
        text: `-${percentage}% vs yesterday`,
        className: "text-rose-600",
      };
    }

    return {
      text: "0% vs yesterday",
      className: "text-slate-500",
    };
  }, [todayProfit, yesterdayProfit]);

  const salesByItem: SalesItem[] = useMemo(() => {
    const map: Record<string, SalesItem> = {};

    todayOrders.forEach((order) => {
      order.order_items?.forEach((item) => {
        if (!map[item.item_name]) {
          map[item.item_name] = {
            item_name: item.item_name,
            total_quantity: 0,
            total_revenue: 0,
          };
        }

        map[item.item_name].total_quantity += Number(item.quantity || 0);
        map[item.item_name].total_revenue +=
          Number(item.quantity || 0) * Number(item.unit_price || 0);
      });
    });

    return Object.values(map).sort((a, b) => b.total_quantity - a.total_quantity);
  }, [todayOrders]);

  const bestSellingItem = salesByItem.length > 0 ? salesByItem[0] : null;

  const paidOrders = useMemo(() => {
    return orders
      .filter((order) => order.is_paid === true)
      .sort((a, b) => {
        const aTime = a.paid_at ? new Date(a.paid_at).getTime() : 0;
        const bTime = b.paid_at ? new Date(b.paid_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [orders]);

  const reportPaidOrders = useMemo(() => {
    return paidOrders.filter(
      (order) =>
        order.paid_at && getLocalDateString(order.paid_at) === selectedReportDate
    );
  }, [paidOrders, selectedReportDate]);

  const rangePaidOrders = useMemo(() => {
    if (!reportFromDate || !reportToDate) return [];

    return paidOrders.filter((order) => {
      if (!order.paid_at) return false;
      const orderDate = getLocalDateString(order.paid_at);
      return orderDate >= reportFromDate && orderDate <= reportToDate;
    });
  }, [paidOrders, reportFromDate, reportToDate]);

  function buildReportData(sourceOrders: OrderRow[]) {
    const itemMap: Record<string, SalesItem> = {};
    const paymentTotals = {
      cash: 0,
      qr: 0,
      card: 0,
    };

    let totalSales = 0;
    let totalItemsSold = 0;

    sourceOrders.forEach((order) => {
      const orderTotal =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;

      totalSales += orderTotal;

      const method =
        order.payment_method === "qr" || order.payment_method === "card"
          ? order.payment_method
          : "cash";

      paymentTotals[method] += orderTotal;

      order.order_items?.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const revenue = quantity * Number(item.unit_price || 0);

        totalItemsSold += quantity;

        if (!itemMap[item.item_name]) {
          itemMap[item.item_name] = {
            item_name: item.item_name,
            total_quantity: 0,
            total_revenue: 0,
          };
        }

        itemMap[item.item_name].total_quantity += quantity;
        itemMap[item.item_name].total_revenue += revenue;
      });
    });

    const itemWiseReport = Object.values(itemMap).sort((a, b) => {
      if (b.total_quantity !== a.total_quantity) {
        return b.total_quantity - a.total_quantity;
      }
      return b.total_revenue - a.total_revenue;
    });

    return {
      totalSales,
      paidOrdersCount: sourceOrders.length,
      totalItemsSold,
      averageOrderValue:
        sourceOrders.length > 0 ? Math.round(totalSales / sourceOrders.length) : 0,
      itemWiseReport,
      topItem: itemWiseReport[0] || null,
      lowestItem:
        itemWiseReport.length > 0
          ? itemWiseReport[itemWiseReport.length - 1]
          : null,
      paymentTotals,
    };
  }

  const reportData = useMemo(() => {
    return buildReportData(reportPaidOrders);
  }, [reportPaidOrders]);

  const rangeReportData = useMemo(() => {
    return buildReportData(rangePaidOrders);
  }, [rangePaidOrders]);

  const hourlySalesTrend = useMemo(() => {
    const salesByHour: Record<number, number> = {};

    todayOrders.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      const total =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;

      salesByHour[hour] = (salesByHour[hour] || 0) + total;
    });

    const orderHours = todayOrders.map((order) => new Date(order.created_at).getHours());

    let startHour = 10;
    let endHour = 22;

    if (orderHours.length > 0) {
      startHour = Math.max(0, Math.min(...orderHours) - 1);
      endHour = Math.min(23, Math.max(...orderHours) + 1);
    }

    if (endHour - startHour < 5) {
      startHour = Math.max(0, startHour - 2);
      endHour = Math.min(23, endHour + 2);
    }

    const points: HourlyTrendPoint[] = [];

    for (let hour = startHour; hour <= endHour; hour++) {
      points.push({
        hour,
        label: formatHourLabel(hour),
        shortLabel: formatHourShort(hour),
        sales: salesByHour[hour] || 0,
      });
    }

    return points;
  }, [todayOrders]);

  const groupedTableOrders = useMemo(() => {
    const normalizeKitchenStatus = (value?: string | null): KitchenStatusKey => {
      if (value === "ready") return "ready";
      if (value === "preparing") return "preparing";
      return "pending";
    };

    const tableStatusPriority: Record<KitchenStatusKey, number> = {
      preparing: 3,
      pending: 2,
      ready: 1,
    };

    const unpaidOnly = orders.filter((order) => order.is_paid !== true);
    const map: Record<string, GroupedTableOrder> = {};

    unpaidOnly.forEach((order) => {
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
          table_status: normalizeKitchenStatus(order.status),
        };
      }

      map[tableNo].order_ids.push(order.id);
      map[tableNo].unpaid_orders_count += 1;

      if (order.remarks && order.remarks.trim()) {
        map[tableNo].remarks.push(order.remarks.trim());
      }

      const orderLevelStatus = normalizeKitchenStatus(order.status);
      if (tableStatusPriority[orderLevelStatus] > tableStatusPriority[map[tableNo].table_status]) {
        map[tableNo].table_status = orderLevelStatus;
      }

      order.order_items?.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal = quantity * unitPrice;
        const itemStatus = normalizeKitchenStatus(item.status || order.status);

        const existingItem = map[tableNo].items.find(
          (entry) => entry.item_name === item.item_name && entry.status === itemStatus
        );

        if (existingItem) {
          existingItem.quantity += quantity;
          existingItem.total += lineTotal;
        } else {
          map[tableNo].items.push({
            item_name: item.item_name,
            quantity,
            total: lineTotal,
            status: itemStatus,
          });
        }

        if (tableStatusPriority[itemStatus] > tableStatusPriority[map[tableNo].table_status]) {
          map[tableNo].table_status = itemStatus;
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
        items: table.items.sort((a, b) => a.item_name.localeCompare(b.item_name)),
      }));
  }, [orders]);

  const kitchenStatusSummary = useMemo(() => {
    return groupedTableOrders.reduce(
      (acc, table) => {
        acc[table.table_status] += 1;
        return acc;
      },
      { pending: 0, preparing: 0, ready: 0 } as Record<KitchenStatusKey, number>
    );
  }, [groupedTableOrders]);

  const filteredKitchenTables = useMemo(() => {
    if (kitchenStatusFilter === "all") return groupedTableOrders;
    return groupedTableOrders.filter((table) => table.table_status === kitchenStatusFilter);
  }, [groupedTableOrders, kitchenStatusFilter]);

  const filteredTableOrders = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();

    if (!search) return groupedTableOrders;

    return groupedTableOrders.filter((table) =>
      table.table_number.toLowerCase().includes(search)
    );
  }, [groupedTableOrders, tableSearch]);

  async function markGroupedTableAsPaid(
    tableNo: string,
    paymentMethod: "cash" | "qr" | "card"
  ) {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error", "Invalid Link");
      return;
    }

    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      showToast("Invalid table number", "error", "Invalid Table");
      return;
    }

    const unpaidOrdersForTable = orders.filter(
      (order) =>
        String(order.table_number).trim() === normalizedTableNo &&
        order.is_paid !== true
    );

    if (unpaidOrdersForTable.length === 0) {
      showToast("No unpaid orders found for this table", "error", "No Orders Found");
      return;
    }

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
      showToast("Failed to mark orders as paid", "error", "Payment Failed");
      return;
    }

    scheduleOrdersRefresh(60);
    showToast(`Table ${normalizedTableNo} marked as paid`, "success", "Payment Updated");
  }

  async function saveProfitPercent() {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error", "Invalid Link");
      return;
    }

    const numericValue = Number(profitPercentInput);

    if (!profitPercentInput.trim() || Number.isNaN(numericValue) || numericValue < 0) {
      showToast("Please enter valid profit %", "error", "Invalid Value");
      return;
    }

    setSavingProfitPercent(true);

    const { error } = await supabase
      .from("restaurants")
      .update({ profit_percent: numericValue })
      .eq("id", restaurantId);

    setSavingProfitPercent(false);

    if (error) {
      showToast("Failed to update profit %", "error", "Update Failed");
      return;
    }

    const normalizedValue = String(numericValue);
    setProfitPercent(normalizedValue);
    setProfitPercentInput(normalizedValue);
    showToast("Profit % updated successfully", "success", "Update Complete");
  }

  async function savePasswords() {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error", "Invalid Link");
      return;
    }

    if (!newOwnerPassword.trim() || !newWaiterPassword.trim() || !newKitchenPassword.trim()) {
      showToast("Please fill all passwords", "error", "Missing Field");
      return;
    }

    setSavingPasswords(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        owner_password: newOwnerPassword.trim(),
        waiter_password: newWaiterPassword.trim(),
        kitchen_password: newKitchenPassword.trim(),
      })
      .eq("id", restaurantId);

    setSavingPasswords(false);

    if (error) {
      showToast("Failed to update passwords", "error", "Update Failed");
      return;
    }

    setOwnerPasswordFromDB(newOwnerPassword.trim());
    showToast("Passwords updated successfully", "success", "Update Complete");
  }

  function formatPaymentMethod(method?: string | null) {
    if (!method) return "-";
    if (method === "qr") return "QR";
    if (method === "card") return "Card";
    return "Cash";
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

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildPaidBillTable(order: OrderRow): PaidBillTableOrder {
    const items =
      (order.order_items || []).map((item) => ({
        item_name: item.item_name,
        quantity: Number(item.quantity || 0),
        total: Number(item.quantity || 0) * Number(item.unit_price || 0),
      })) || [];

    const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);

    return {
      table_number: String(order.table_number || ""),
      order_ids: [order.id],
      remarks: order.remarks && order.remarks.trim() ? [order.remarks.trim()] : [],
      items,
      total,
      paid_at: order.paid_at || null,
      payment_method: order.payment_method || null,
      sourceOrders: [order],
    };
  }

  const selectedPaidBill = useMemo(() => {
    if (!selectedPaidOrder) return null;
    return buildPaidBillTable(selectedPaidOrder);
  }, [selectedPaidOrder]);

  const RECEIPT_WIDTH_MM = 80;
  const RECEIPT_MARGIN_MM = 4.5;
  const RECEIPT_CONTENT_WIDTH_MM = RECEIPT_WIDTH_MM - RECEIPT_MARGIN_MM * 2;

  function formatReceiptMoney(value: number) {
    const normalized = Number(value || 0);
    return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
  }

  function createReceiptTempDoc() {
    return new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [RECEIPT_WIDTH_MM, 260],
    });
  }

  function createReceiptDoc(height: number) {
    return new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [RECEIPT_WIDTH_MM, Math.max(height, 95)],
      compress: true,
    });
  }

  function estimateWrappedReceiptHeight(
    value: string,
    maxWidth: number,
    fontSize: number,
    lineHeight: number
  ) {
    const tempDoc = createReceiptTempDoc();
    tempDoc.setFont("helvetica", "normal");
    tempDoc.setFontSize(fontSize);
    const lines = tempDoc.splitTextToSize(value || "", maxWidth) as string[];
    return Math.max(lines.length, 1) * lineHeight;
  }

  function getBillDocumentHtml(table: PaidBillTableOrder) {
    const restaurantTitle = escapeHtml((restaurantName || "Restaurant").trim() || "Restaurant");
    const primaryOrderId = table.order_ids[0] || "-";
    const createdAt = escapeHtml(formatBillDate(table.paid_at || table.sourceOrders[0]?.created_at || null));
    const totalQty = table.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const rows = table.items
      .map((item) => {
        const amount = formatReceiptMoney(Number(item.total || 0));
        const itemName = escapeHtml(item.item_name);
        const qty = escapeHtml(String(item.quantity || 0));

        return `
          <div class="grid item-row customer-row">
            <div class="item-name">${itemName}</div>
            <div class="qty">${qty}</div>
            <div class="amt">${amount}</div>
          </div>
        `;
      })
      .join("");

    const remarksHtml =
      table.remarks.length > 0
        ? `
          <div class="divider"></div>
          <div class="remarks-title">REMARKS</div>
          ${table.remarks
            .map((remark) => `<div class="remarks-line">${escapeHtml(remark)}</div>`)
            .join("")}
        `
        : "";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${restaurantTitle} - CUSTOMER BILL</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 80mm;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
    }
    .receipt-shell {
      width: 80mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .receipt {
      width: 71mm;
      margin: 0 auto;
      padding: 5mm 2.5mm 5mm;
      background: #ffffff;
    }
    .center { text-align: center; }
    .title {
      font-size: 15px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.25;
      word-break: break-word;
      margin: 0;
    }
    .bill-title {
      margin-top: 2mm;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .bill-id {
      margin-top: 1.2mm;
      font-size: 9px;
    }
    .divider {
      border-top: 1px dashed #666;
      margin: 3.4mm 0;
      width: 100%;
      height: 0;
    }
    .meta-line {
      font-size: 9px;
      line-height: 1.45;
      font-weight: 600;
      margin: 0;
    }
    .grid {
      display: grid;
      align-items: start;
      column-gap: 2mm;
    }
    .header-row {
      grid-template-columns: minmax(0, 1fr) 10mm 15mm;
      font-size: 9px;
      font-weight: 800;
      line-height: 1.3;
      text-transform: uppercase;
    }
    .header-row .qty,
    .header-row .amt,
    .item-row .qty,
    .item-row .amt,
    .summary-line span:last-child {
      text-align: right;
    }
    .item-row {
      grid-template-columns: minmax(0, 1fr) 10mm 15mm;
      font-size: 10px;
      line-height: 1.45;
      margin-top: 2.2mm;
    }
    .item-name {
      min-width: 0;
      word-break: break-word;
    }
    .summary-line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.35;
      margin: 0;
    }
    .summary-line + .summary-line {
      margin-top: 1.2mm;
    }
    .summary-line.grand {
      font-size: 10.8px;
    }
    .remarks-title {
      font-size: 8.8px;
      font-weight: 800;
      margin: 0 0 1.4mm;
    }
    .remarks-line {
      font-size: 9px;
      line-height: 1.4;
      margin: 0;
      word-break: break-word;
    }
    .remarks-line + .remarks-line {
      margin-top: 1mm;
    }
    .footer-strong {
      font-size: 10px;
      font-weight: 800;
      line-height: 1.3;
    }
    .footer-sub {
      margin-top: 1mm;
      font-size: 8.8px;
      line-height: 1.3;
    }
    @media print {
      html, body, .receipt-shell {
        width: 80mm;
        margin: 0;
        padding: 0;
      }
      .receipt {
        width: 71mm;
        margin: 0 auto;
        padding: 5mm 2.5mm 5mm;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-shell">
    <div class="receipt">
      <div class="center">
        <div class="title">${restaurantTitle}</div>
        <div class="bill-title">CUSTOMER BILL</div>
        <div class="bill-id">Order #${escapeHtml(String(primaryOrderId))}</div>
      </div>

      <div class="divider"></div>

      <div class="meta-line"><span>Table   : ${escapeHtml(table.table_number)}</span></div>
      <div class="meta-line"><span>Orders  : ${escapeHtml(table.order_ids.join(", "))}</span></div>
      <div class="meta-line"><span>Time    : ${createdAt}</span></div>

      <div class="divider"></div>

      <div class="grid header-row">
        <span>ITEM</span>
        <span class="qty">QTY</span>
        <span class="amt">AMT</span>
      </div>

      <div class="divider"></div>

      ${rows}

      <div class="divider"></div>
      <div class="summary-line"><span>TOTAL QTY</span><span>${escapeHtml(String(totalQty))}</span></div>
      <div class="summary-line grand"><span>TOTAL</span><span>Rs. ${escapeHtml(formatReceiptMoney(table.total))}</span></div>

      ${remarksHtml}

      <div class="divider"></div>
      <div class="center footer-strong">--- THANK YOU ---</div>
      <div class="center footer-sub">Please Visit Again</div>
    </div>
  </div>
</body>
</html>`;
  }

  function openPrintWindow(table: PaidBillTableOrder) {
    const html = getBillDocumentHtml(table);
    const billWindow = window.open("", "_blank", "width=420,height=900");

    if (!billWindow) return null;

    billWindow.document.open();
    billWindow.document.write(html);
    billWindow.document.close();

    return billWindow;
  }

  function printBill(table: PaidBillTableOrder) {
    const billWindow = openPrintWindow(table);
    if (!billWindow) return;

    const tryPrint = () => {
      try {
        const bodyReady =
          !!billWindow.document?.body &&
          billWindow.document.body.innerHTML.trim().length > 0;

        if (!bodyReady) {
          window.setTimeout(tryPrint, 250);
          return;
        }

        window.setTimeout(() => {
          try {
            billWindow.focus();
            billWindow.print();
          } catch (error) {
            console.error("Print failed:", error);
          }
        }, 700);
      } catch (error) {
        console.error("Print preparation failed:", error);
      }
    };

    if (billWindow.document.readyState === "complete") {
      tryPrint();
    } else {
      billWindow.onload = () => {
        tryPrint();
      };
    }
  }

  function downloadBill(table: PaidBillTableOrder) {
    const restaurantTitle = (restaurantName || "Restaurant").trim() || "Restaurant";
    const createdAt = table.paid_at || table.sourceOrders[0]?.created_at || new Date().toISOString();
    const totalQty = table.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = Number(table.total || 0);

    let estimatedHeight = 8;
    estimatedHeight += estimateWrappedReceiptHeight(restaurantTitle, RECEIPT_CONTENT_WIDTH_MM, 13, 5.2);
    estimatedHeight += 5;
    estimatedHeight += 7;
    estimatedHeight += 4;
    estimatedHeight += 3.5;
    estimatedHeight += 16;
    estimatedHeight += 3.5;
    estimatedHeight += 5.5;

    for (const item of table.items) {
      estimatedHeight += estimateWrappedReceiptHeight(
        item.item_name,
        RECEIPT_CONTENT_WIDTH_MM - 25,
        10,
        4.6
      );
      estimatedHeight += 1.8;
    }

    estimatedHeight += 3.5;
    estimatedHeight += 7;

    if (table.remarks.length > 0) {
      estimatedHeight += 3.5;
      estimatedHeight += 4.4;
      for (const remark of table.remarks) {
        estimatedHeight += estimateWrappedReceiptHeight(remark, RECEIPT_CONTENT_WIDTH_MM, 9, 4.2);
      }
      estimatedHeight += 1.2;
    }

    estimatedHeight += 3.5;
    estimatedHeight += 10;

    const doc = createReceiptDoc(estimatedHeight);
    const pageWidth = doc.internal.pageSize.getWidth();
    const qtyX = pageWidth - RECEIPT_MARGIN_MM - 15;
    const amtX = pageWidth - RECEIPT_MARGIN_MM;
    let y = 8;

    const centerText = (
      value: string,
      fontSize = 10,
      style: "normal" | "bold" = "normal",
      gap = 4.2
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(value, RECEIPT_CONTENT_WIDTH_MM) as string[];
      lines.forEach((line) => {
        doc.text(line, pageWidth / 2, y, { align: "center" });
        y += gap;
      });
    };

    const leftText = (
      value: string,
      fontSize = 9,
      style: "normal" | "bold" = "normal",
      gap = 4.1
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(value, RECEIPT_CONTENT_WIDTH_MM) as string[];
      lines.forEach((line) => {
        doc.text(line, RECEIPT_MARGIN_MM, y);
        y += gap;
      });
    };

    const dashedDivider = (spaceAfter = 3.5) => {
      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(RECEIPT_MARGIN_MM, y, pageWidth - RECEIPT_MARGIN_MM, y);
      doc.setLineDashPattern([], 0);
      y += spaceAfter;
    };

    centerText(restaurantTitle.toUpperCase(), 13, "bold", 5.2);
    y += 0.8;
    centerText("CUSTOMER BILL", 11.5, "bold", 4.8);
    centerText(`Order #${table.order_ids[0] || "-"}`, 9, "normal", 4.1);
    dashedDivider();

    leftText(`Table   : ${table.table_number}`, 9.3, "bold", 4.4);
    leftText(`Orders  : ${table.order_ids.join(", ")}`, 9.1, "bold", 4.3);
    leftText(`Time    : ${new Date(createdAt).toLocaleString()}`, 8.3, "normal", 4.1);
    dashedDivider();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text("ITEM", RECEIPT_MARGIN_MM, y);
    doc.text("QTY", qtyX, y, { align: "right" });
    doc.text("AMT", amtX, y, { align: "right" });
    y += 2;
    dashedDivider();

    for (const item of table.items) {
      const itemLines = doc.splitTextToSize(item.item_name, RECEIPT_CONTENT_WIDTH_MM - 25) as string[];
      const amount = Number(item.total || 0);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      itemLines.forEach((line, index) => {
        doc.text(line, RECEIPT_MARGIN_MM, y);
        if (index === 0) {
          doc.text(String(item.quantity || 0), qtyX, y, { align: "right" });
          doc.text(formatReceiptMoney(amount), amtX, y, { align: "right" });
        }
        y += 4.6;
      });
      y += 1.8;
    }

    dashedDivider();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("TOTAL QTY", RECEIPT_MARGIN_MM, y);
    doc.text(String(totalQty), amtX, y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text("TOTAL", RECEIPT_MARGIN_MM, y);
    doc.text(`Rs. ${formatReceiptMoney(totalAmount)}`, amtX, y, { align: "right" });
    y += 4.4;

    if (table.remarks.length > 0) {
      dashedDivider();
      leftText("REMARKS", 8.8, "bold", 4.2);
      for (const remark of table.remarks) {
        leftText(remark, 9, "normal", 4.2);
      }
    }

    dashedDivider();
    centerText("--- THANK YOU ---", 9.8, "bold", 4.4);
    centerText("Please Visit Again", 8.8, "normal", 4.1);

    const safeRestaurantName = restaurantTitle
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    doc.save(`${safeRestaurantName || "restaurant"}-customer-table-${table.table_number}.pdf`);
  }

  function renderBillCard(table: PaidBillTableOrder) {
    return (
      <div className="mx-auto w-[330px] border border-slate-300 bg-white px-4 py-5 text-black shadow-sm">
        <div className="text-center">
          <p className="text-[18px] font-extrabold uppercase tracking-wide leading-6">
            {restaurantName || "Restaurant"}
          </p>
          <p className="mt-1 text-[15px] font-extrabold">CUSTOMER BILL</p>
          <p className="mt-1 text-[13px]">Order #{table.order_ids[0] || "-"}</p>
        </div>

        <div className="my-3 border-t border-dashed border-slate-500" />

        <div className="space-y-1 text-[14px] leading-5">
          <p className="font-bold">Table   : {table.table_number}</p>
          <p className="font-bold">Orders  : {table.order_ids.join(", ")}</p>
          <p>Time    : {formatBillDate(table.paid_at || table.sourceOrders[0]?.created_at || null)}</p>
        </div>

        <div className="my-3 border-t border-dashed border-slate-500" />

        <div className="grid grid-cols-[1fr_50px_70px] items-center gap-2 text-[14px] font-extrabold">
          <span>ITEM</span>
          <span className="text-right">QTY</span>
          <span className="text-right">AMT</span>
        </div>

        <div className="my-3 border-t border-dashed border-slate-500" />

        <div className="space-y-3">
          {table.items.map((item) => (
            <div
              key={`${table.table_number}-${item.item_name}-${item.quantity}`}
              className="grid grid-cols-[1fr_50px_70px] items-start gap-2 text-[15px]"
            >
              <div className="min-w-0">
                <p className="break-words">{item.item_name}</p>
              </div>
              <span className="text-right">{item.quantity}</span>
              <span className="text-right">{formatReceiptMoney(item.total)}</span>
            </div>
          ))}
        </div>

        <div className="my-3 border-t border-dashed border-slate-500" />

        <div className="space-y-2 text-[15px] font-bold">
          <div className="flex items-center justify-between gap-3">
            <span>TOTAL QTY</span>
            <span>
              {table.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[16px]">
            <span>TOTAL</span>
            <span>Rs. {formatReceiptMoney(table.total)}</span>
          </div>
        </div>

        {table.remarks.length > 0 && (
          <>
            <div className="my-3 border-t border-dashed border-slate-500" />
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-slate-600">
                Remarks
              </p>
              <div className="mt-2 space-y-1.5">
                {table.remarks.map((remark, index) => (
                  <p key={`${remark}-${index}`} className="text-[13px] leading-5 text-slate-700 break-words">
                    {remark}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="my-3 border-t border-dashed border-slate-500" />

        <div className="text-center">
          <p className="text-[14px] font-extrabold">--- THANK YOU ---</p>
          <p className="mt-1 text-[12px] text-slate-600">Please Visit Again</p>
        </div>
      </div>
    );
  }

  function formatReportDateLabel(dateValue: string) {
    if (!dateValue) return "-";
    return new Date(`${dateValue}T00:00:00`).toLocaleDateString();
  }

  function formatRangeLabel(fromDate: string, toDate: string) {
    if (!fromDate || !toDate) return "-";
    return `${formatReportDateLabel(fromDate)} to ${formatReportDateLabel(toDate)}`;
  }

  function formatShortDateWithDay(dateValue: Date) {
    const dayName = dateValue.toLocaleDateString(undefined, { weekday: "short" });
    const dateLabel = dateValue.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return {
      dayName,
      dateLabel,
      fullLabel: `${dayName}, ${dateLabel}`,
    };
  }

  const unpaidTablesCount = groupedTableOrders.length;
  const unpaidAmount = groupedTableOrders.reduce((sum, table) => sum + table.total, 0);
  const avgOrderValueToday =
    totalOrdersToday > 0 ? Math.round(totalRevenueToday / totalOrdersToday) : 0;

  const peakHourLabel = useMemo(() => {
    if (todayOrders.length === 0) return "-";

    const hourMap: Record<number, number> = {};

    todayOrders.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });

    const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
    if (!peakHour) return "-";

    const hourNum = Number(peakHour[0]);
    const from = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const toHour = (hourNum + 1) % 24;
    const to = toHour % 12 === 0 ? 12 : toHour % 12;
    const fromSuffix = hourNum >= 12 ? "PM" : "AM";
    const toSuffix = toHour >= 12 ? "PM" : "AM";

    return `${from} ${fromSuffix} - ${to} ${toSuffix}`;
  }, [todayOrders]);

  const recentActivity = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  const selectedSalesOrders = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    if (salesPeriod === "day") {
      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        return getLocalDateString(order.paid_at) === getLocalDateString(todayStart.toISOString());
      });
    }

    if (salesPeriod === "week") {
      const weekStart = addDays(todayStart, -6);
      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        const paidDate = startOfDay(new Date(order.paid_at));
        return paidDate >= weekStart && paidDate <= todayStart;
      });
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return paidOrders.filter((order) => {
      if (!order.paid_at) return false;
      const paidDate = startOfDay(new Date(order.paid_at));
      return paidDate >= monthStart && paidDate <= todayStart;
    });
  }, [paidOrders, salesPeriod]);

  const previousSalesOrders = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    if (salesPeriod === "day") {
      const prevDay = addDays(todayStart, -1);
      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        return getLocalDateString(order.paid_at) === getLocalDateString(prevDay.toISOString());
      });
    }

    if (salesPeriod === "week") {
      const currentWeekStart = addDays(todayStart, -6);
      const previousWeekStart = addDays(currentWeekStart, -7);
      const previousWeekEnd = addDays(currentWeekStart, -1);

      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        const paidDate = startOfDay(new Date(order.paid_at));
        return paidDate >= previousWeekStart && paidDate <= previousWeekEnd;
      });
    }

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return paidOrders.filter((order) => {
      if (!order.paid_at) return false;
      const paidDate = startOfDay(new Date(order.paid_at));
      return paidDate >= prevMonthStart && paidDate <= prevMonthEnd;
    });
  }, [paidOrders, salesPeriod]);

  const selectedSalesSummary = useMemo(() => {
    const totalSales = selectedSalesOrders.reduce((sum, order) => {
      const total =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + total;
    }, 0);

    const previousSales = previousSalesOrders.reduce((sum, order) => {
      const total =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + total;
    }, 0);

    const totalOrders = selectedSalesOrders.length;
    const profitAmount = Math.round(totalSales * (numericProfitPercent / 100));
    const previousProfitAmount = Math.round(previousSales * (numericProfitPercent / 100));

    const itemMap: Record<string, SalesItem> = {};

    selectedSalesOrders.forEach((order) => {
      order.order_items?.forEach((item) => {
        if (!itemMap[item.item_name]) {
          itemMap[item.item_name] = {
            item_name: item.item_name,
            total_quantity: 0,
            total_revenue: 0,
          };
        }

        itemMap[item.item_name].total_quantity += Number(item.quantity || 0);
        itemMap[item.item_name].total_revenue +=
          Number(item.quantity || 0) * Number(item.unit_price || 0);
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => {
        if (b.total_quantity !== a.total_quantity) {
          return b.total_quantity - a.total_quantity;
        }
        return b.total_revenue - a.total_revenue;
      })
      .slice(0, 5);

    let comparisonText = "0% vs previous period";
    let comparisonClass = "text-slate-500";

    if (previousSales <= 0) {
      if (totalSales > 0) {
        comparisonText = `+Rs. ${totalSales} vs previous period`;
        comparisonClass = "text-emerald-600";
      }
    } else {
      const diff = totalSales - previousSales;
      const percentage = Math.abs((diff / previousSales) * 100).toFixed(1);

      if (diff > 0) {
        comparisonText = `+${percentage}% vs previous period`;
        comparisonClass = "text-emerald-600";
      } else if (diff < 0) {
        comparisonText = `-${percentage}% vs previous period`;
        comparisonClass = "text-rose-600";
      }
    }

    let profitComparisonText = "Rs. 0 vs previous period";
    let profitComparisonClass = "text-slate-500";

    if (previousProfitAmount <= 0) {
      if (profitAmount > 0) {
        profitComparisonText = `+Rs. ${profitAmount} vs previous period`;
        profitComparisonClass = "text-emerald-600";
      }
    } else {
      const profitDiff = profitAmount - previousProfitAmount;
      const profitPercentage = Math.abs((profitDiff / previousProfitAmount) * 100).toFixed(1);

      if (profitDiff > 0) {
        profitComparisonText = `+${profitPercentage}% vs previous period`;
        profitComparisonClass = "text-emerald-600";
      } else if (profitDiff < 0) {
        profitComparisonText = `-${profitPercentage}% vs previous period`;
        profitComparisonClass = "text-rose-600";
      } else {
        profitComparisonText = "0% vs previous period";
      }
    }

    const profitLabel =
      salesPeriod === "day"
        ? "Today Profit"
        : salesPeriod === "week"
        ? "Weekly Profit"
        : "Monthly Profit";

    return {
      totalSales,
      totalOrders,
      profitAmount,
      profitLabel,
      topItems,
      bestSeller: topItems[0]?.item_name || "-",
      comparisonText,
      comparisonClass,
      profitComparisonText,
      profitComparisonClass,
    };
  }, [selectedSalesOrders, previousSalesOrders, numericProfitPercent, salesPeriod]);

  const selectedSalesTrend = useMemo(() => {
    const now = new Date();

    if (salesPeriod === "day") {
      const salesByHour: Record<number, number> = {};
      selectedSalesOrders.forEach((order) => {
        const hour = new Date(order.paid_at || order.created_at).getHours();
        const total =
          order.order_items?.reduce(
            (sum, item) =>
              sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;
        salesByHour[hour] = (salesByHour[hour] || 0) + total;
      });

      const points = [];
      for (let hour = 0; hour <= 23; hour++) {
        points.push({
          label: formatHourShort(hour),
          fullLabel: formatHourLabel(hour),
          sales: salesByHour[hour] || 0,
        });
      }
      return points;
    }

    if (salesPeriod === "week") {
      const salesByDate: Record<string, number> = {};
      selectedSalesOrders.forEach((order) => {
        if (!order.paid_at) return;
        const key = getLocalDateString(order.paid_at);
        const total =
          order.order_items?.reduce(
            (sum, item) =>
              sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;
        salesByDate[key] = (salesByDate[key] || 0) + total;
      });

      const points = [];
      for (let i = 6; i >= 0; i--) {
        const d = addDays(startOfDay(now), -i);
        const key = getLocalDateString(d.toISOString());
        points.push({
          label: d.toLocaleDateString(undefined, { weekday: "short" }),
          fullLabel: d.toLocaleDateString(),
          sales: salesByDate[key] || 0,
        });
      }
      return points;
    }

    const salesByDate: Record<string, number> = {};
    selectedSalesOrders.forEach((order) => {
      if (!order.paid_at) return;
      const key = getLocalDateString(order.paid_at);
      const total =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      salesByDate[key] = (salesByDate[key] || 0) + total;
    });

    const totalDays = now.getDate();
    const points = [];
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      const key = getLocalDateString(d.toISOString());
      points.push({
        label: `${day}`,
        fullLabel: d.toLocaleDateString(),
        sales: salesByDate[key] || 0,
      });
    }

    return points;
  }, [selectedSalesOrders, salesPeriod]);

  const salesDetailBoxes = useMemo(() => {
    const now = new Date();

    if (salesPeriod === "day") {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeLabel = now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      const todaySalesTillNow = paidOrders.reduce((sum, order) => {
        if (!order.paid_at) return sum;
        const paidDate = new Date(order.paid_at);
        if (getLocalDateString(order.paid_at) !== todayLocalDate) return sum;
        if (paidDate.getTime() > now.getTime()) return sum;

        const orderTotal =
          order.order_items?.reduce(
            (itemSum, item) =>
              itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;

        return sum + orderTotal;
      }, 0);

      const todayInfo = formatShortDateWithDay(now);

      return [
        {
          key: `day-${todayLocalDate}`,
          label: todayInfo.fullLabel,
          sublabel: `Sales till ${currentTimeLabel}`,
          sales: todaySalesTillNow,
          cardClass: "border-slate-200 bg-white",
          badgeClass: "bg-slate-100 text-slate-700",
          badgeText: `${formatHourShort(currentHour)}${currentMinute > 0 ? `:${String(currentMinute).padStart(2, "0")}` : ""}`,
        },
      ];
    }

    const totalDays = salesPeriod === "week" ? 7 : now.getDate();
    const points: {
  key: string;
  label: string;
  sublabel: string;
  sales: number;
}[] = [];

    for (let offset = totalDays - 1; offset >= 0; offset--) {
      const dateObj = addDays(startOfDay(now), -offset);
      const dateKey = getLocalDateString(dateObj.toISOString());
      const info = formatShortDateWithDay(dateObj);

      const sales = paidOrders.reduce((sum, order) => {
        if (!order.paid_at) return sum;
        if (getLocalDateString(order.paid_at) !== dateKey) return sum;

        const orderTotal =
          order.order_items?.reduce(
            (itemSum, item) =>
              itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;

        return sum + orderTotal;
      }, 0);

      points.push({
        key: `${salesPeriod}-${dateKey}`,
        label: info.fullLabel,
        sublabel: salesPeriod === "week" ? "Daily total" : "Month daily total",
        sales,
      });
    }

    return points.map((point, index) => {
      if (index === 0) {
        return {
          ...point,
          cardClass: "border-slate-200 bg-white",
          badgeClass: "bg-slate-100 text-slate-700",
          badgeText: "Start",
        };
      }

      const previousSales = points[index - 1].sales;

      if (point.sales > previousSales) {
        return {
          ...point,
          cardClass: "border-emerald-200 bg-emerald-50",
          badgeClass: "bg-emerald-100 text-emerald-700",
          badgeText: "Up",
        };
      }

      if (point.sales < previousSales) {
        return {
          ...point,
          cardClass: "border-rose-200 bg-rose-50",
          badgeClass: "bg-rose-100 text-rose-700",
          badgeText: "Down",
        };
      }

      return {
        ...point,
        cardClass: "border-slate-300 bg-slate-100",
        badgeClass: "bg-slate-200 text-slate-700",
        badgeText: "Same",
      };
    });
  }, [paidOrders, salesPeriod, todayLocalDate]);

  const selectedTrendMaxSales = useMemo(() => {
    if (selectedSalesTrend.length === 0) return 0;
    return getNiceCeiling(Math.max(...selectedSalesTrend.map((item) => item.sales), 0));
  }, [selectedSalesTrend]);

  function iconBubble(icon: string, bg: string) {
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-base ${bg}`}
      >
        {icon}
      </span>
    );
  }

function bottomNavButtonClass(view: OwnerView) {
  const active = ownerView === view;
  return `flex flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2.5 text-[12px] font-semibold ${
    active
      ? "bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.28)]"
      : "bg-white/40 text-slate-500"
  }`;
}

  function paymentButtonClass(tableNo: string, method: "cash" | "qr" | "card") {
    const selected = tablePaymentMethods[tableNo] || "cash";

    return `py-2.5 rounded-2xl text-sm font-semibold border ${
      selected === method
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-slate-700 border-slate-200"
    }`;
  }

  function salesPeriodButtonClass(period: SalesPeriod) {
    const active = salesPeriod === period;
    return `rounded-2xl px-3 py-2 text-sm font-semibold ${
      active ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
    }`;
  }

  function statCard(
    title: string,
    value: string | number,
    icon: string,
    cardClass = "bg-white border border-slate-200"
  ) {
    return (
      <div className={`rounded-[22px] p-3.5 shadow-sm ${cardClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">{title}</p>
            <p className="mt-1 break-words text-base font-bold text-slate-900">{value}</p>
          </div>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm">
            {icon}
          </span>
        </div>
      </div>
    );
  }

  function sectionTitle(title: string, subtitle: string, icon: string) {
    return (
      <div className="flex items-start gap-3">
        <div className="shrink-0">{iconBubble(icon, "bg-blue-50")}</div>
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
    );
  }

  function renderHourlyAreaChart() {
    const hourlyChartMaxSales =
      hourlySalesTrend.length === 0
        ? 0
        : getNiceCeiling(Math.max(...hourlySalesTrend.map((item) => item.sales), 0));

    const hourlyChartPoints = hourlySalesTrend.map((point, index) => {
      const max = hourlyChartMaxSales || 1;
      const x =
        hourlySalesTrend.length === 1
          ? 10
          : 10 + (index / Math.max(hourlySalesTrend.length - 1, 1)) * 86;
      const y = 90 - (point.sales / max) * 72;

      return {
        ...point,
        x,
        y,
      };
    });

    const hourlyLinePath = hourlyChartPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const hourlyAreaPath =
      hourlyChartPoints.length > 0
        ? [
            `M ${hourlyChartPoints[0].x} 90`,
            ...hourlyChartPoints.map((point) => `L ${point.x} ${point.y}`),
            `L ${hourlyChartPoints[hourlyChartPoints.length - 1].x} 90`,
            "Z",
          ].join(" ")
        : "";

    return (
      <div className="relative h-[170px] w-full rounded-[22px] border border-slate-200 bg-slate-50 p-2.5">
        {hoveredHourlyPoint && (
          <div
            className="absolute z-10 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{
              left: `${Math.min(Math.max(hoveredHourlyPoint.x, 12), 88)}%`,
              top: `${Math.min(Math.max(hoveredHourlyPoint.y - 6, 10), 76)}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p>{hoveredHourlyPoint.label}</p>
            <p>Rs. {hoveredHourlyPoint.sales}</p>
          </div>
        )}

        {hourlySalesTrend.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No hourly sales data for today.
          </div>
        ) : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="hourlyAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map((ratio) => {
              const y = 90 - ratio * 72;
              const value = Math.round((hourlyChartMaxSales || 1000) * ratio);
              return (
                <g key={`${ratio}-${value}`}>
                  <line
                    x1="10"
                    y1={y}
                    x2="96"
                    y2={y}
                    stroke="#dbeafe"
                    strokeWidth="0.5"
                    strokeDasharray="1.5 1.5"
                  />
                  <text
                    x="8.3"
                    y={y + 1.2}
                    textAnchor="end"
                    fontSize="3"
                    fill="#64748b"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <line x1="10" y1="18" x2="10" y2="90" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="10" y1="90" x2="96" y2="90" stroke="#94a3b8" strokeWidth="0.7" />

            {hourlyAreaPath && <path d={hourlyAreaPath} fill="url(#hourlyAreaFill)" />}
            {hourlyLinePath && (
              <path
                d={hourlyLinePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {hourlyChartPoints.map((point) => (
              <g key={point.hour}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1.8"
                  fill="#1d4ed8"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() =>
                    setHoveredHourlyPoint({
                      hour: point.hour,
                      label: point.label,
                      sales: point.sales,
                      x: point.x,
                      y: point.y,
                    })
                  }
                  onMouseLeave={() => setHoveredHourlyPoint(null)}
                />
                <text
                  x={point.x}
                  y="95.5"
                  textAnchor="middle"
                  fontSize="2.5"
                  fill="#64748b"
                >
                  {point.shortLabel}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    );
  }

  function renderCompactTrendChart() {
    const chartPoints = selectedSalesTrend.map((point, index) => {
      const max = selectedTrendMaxSales || 1;
      const x =
        selectedSalesTrend.length === 1
          ? 8
          : 8 + (index / Math.max(selectedSalesTrend.length - 1, 1)) * 86;
      const y = 88 - (point.sales / max) * 66;
      return { ...point, x, y };
    });

    const linePath = chartPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const areaPath =
      chartPoints.length > 0
        ? [
            `M ${chartPoints[0].x} 88`,
            ...chartPoints.map((point) => `L ${point.x} ${point.y}`),
            `L ${chartPoints[chartPoints.length - 1].x} 88`,
            "Z",
          ].join(" ")
        : "";

    return (
      <div className="relative h-[170px] w-full rounded-[22px] border border-slate-200 bg-slate-50 p-2.5">
        {hoveredTrendPoint && (
          <div
            className="absolute z-10 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{
              left: `${Math.min(Math.max(hoveredTrendPoint.x, 10), 86)}%`,
              top: `${Math.min(Math.max(hoveredTrendPoint.y - 6, 8), 74)}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p>{hoveredTrendPoint.label}</p>
            <p>Rs. {hoveredTrendPoint.sales}</p>
          </div>
        )}

        {selectedSalesTrend.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No trend data.
          </div>
        ) : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="salesCompactFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map((ratio) => {
              const y = 88 - ratio * 66;
              const value = Math.round((selectedTrendMaxSales || 1000) * ratio);
              return (
                <g key={`${ratio}-${value}`}>
                  <line
                    x1="8"
                    y1={y}
                    x2="96"
                    y2={y}
                    stroke="#dbeafe"
                    strokeWidth="0.5"
                    strokeDasharray="1.5 1.5"
                  />
                  <text
                    x="6.2"
                    y={y + 1.2}
                    textAnchor="end"
                    fontSize="2.8"
                    fill="#64748b"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <line x1="8" y1="20" x2="8" y2="88" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="8" y1="88" x2="96" y2="88" stroke="#94a3b8" strokeWidth="0.7" />

            {areaPath && <path d={areaPath} fill="url(#salesCompactFill)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {chartPoints.map((point, index) => (
  <g key={`${point.fullLabel}-${point.label}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1.8"
                  fill="#1d4ed8"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() =>
                    setHoveredTrendPoint({
                      label: point.fullLabel,
                      sales: point.sales,
                      x: point.x,
                      y: point.y,
                    })
                  }
                  onMouseLeave={() => setHoveredTrendPoint(null)}
                />
              {index % 3 === 0 && (
  <text
    x={point.x}
    y="97"
    textAnchor="middle"
    fontSize="3.6"
    fill="#334155"
  >
    {point.label}
  </text>
)}
              </g>
            ))}
          </svg>
        )}
      </div>
    );
  }



  function getTrendCardClass(comparisonClass: string) {
    if (comparisonClass.includes("text-rose")) {
      return "rounded-[22px] border border-rose-200 bg-rose-50 p-3.5 shadow-sm";
    }

    if (comparisonClass.includes("text-emerald")) {
      return "rounded-[22px] border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm";
    }

    return "rounded-[22px] border border-slate-200 bg-slate-50 p-3.5 shadow-sm";
  }

  function getProfitCardClass(comparisonClass: string) {
    if (comparisonClass.includes("text-rose")) {
      return "rounded-[22px] border border-rose-200 bg-rose-50 p-3.5 shadow-sm";
    }

    if (comparisonClass.includes("text-emerald")) {
      return "rounded-[22px] border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm";
    }

    return "rounded-[22px] border border-slate-200 bg-slate-50 p-3.5 shadow-sm";
  }

  function getKitchenStatusBadgeClass(status: KitchenStatusKey) {
    if (status === "ready") return "bg-emerald-100 text-emerald-700";
    if (status === "preparing") return "bg-amber-100 text-amber-700";
    return "bg-slate-200 text-slate-700";
  }

  function getKitchenStatusDotClass(status: KitchenStatusKey) {
    if (status === "ready") return "bg-emerald-500";
    if (status === "preparing") return "bg-amber-500";
    return "bg-slate-400";
  }

  function getKitchenStatusLabel(status: KitchenStatusKey) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function kitchenFilterButtonClass(filter: "all" | KitchenStatusKey) {
    const active = kitchenStatusFilter === filter;
    return `rounded-full px-3 py-2 text-[11px] font-semibold ${
      active ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
    }`;
  }

  function renderKitchenStatusCards() {
    return (
      <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {iconBubble("🍳", "bg-orange-50")}
            <div>
              <h3 className="font-bold text-slate-900">Kitchen Status</h3>
              <p className="text-xs text-slate-500">Pending, preparing ra ready tables</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setKitchenStatusExpanded((prev) => !prev)}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
          >
            {kitchenStatusExpanded ? "Hide" : "Open"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setKitchenStatusExpanded((prev) => !prev)}
          className="grid w-full grid-cols-3 gap-2 rounded-[20px] border border-slate-200 bg-slate-50 p-3 text-left"
        >
          {(["pending", "preparing", "ready"] as KitchenStatusKey[]).map((status) => (
            <div key={status} className="rounded-2xl bg-white px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${getKitchenStatusDotClass(status)}`} />
                <p className="text-[10px] font-semibold text-slate-500">{getKitchenStatusLabel(status)}</p>
              </div>
              <p className="mt-1 text-base font-bold text-slate-900">{kitchenStatusSummary[status]}</p>
            </div>
          ))}
        </button>

        {kitchenStatusExpanded && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-100 p-1">
              <button type="button" onClick={() => setKitchenStatusFilter("all")} className={kitchenFilterButtonClass("all")}>
                All
              </button>
              <button type="button" onClick={() => setKitchenStatusFilter("pending")} className={kitchenFilterButtonClass("pending")}>
                Pending
              </button>
              <button type="button" onClick={() => setKitchenStatusFilter("preparing")} className={kitchenFilterButtonClass("preparing")}>
                Preparing
              </button>
              <button type="button" onClick={() => setKitchenStatusFilter("ready")} className={kitchenFilterButtonClass("ready")}>
                Ready
              </button>
            </div>

            {filteredKitchenTables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No kitchen orders in this status.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredKitchenTables.map((table) => {
                  const isOpen = openedKitchenTables[table.table_number] === true;
                  const firstItem = table.items[0];

                  return (
                    <div
                      key={`kitchen-${table.table_number}`}
                      className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-900">Table {table.table_number}</p>
                          <p className="mt-1 text-sm text-slate-500">{table.unpaid_orders_count} unpaid</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${getKitchenStatusBadgeClass(table.table_status)}`}>
                          {getKitchenStatusLabel(table.table_status)}
                        </span>
                      </div>

                      <div className="mt-4 rounded-[18px] bg-slate-100 px-4 py-3">
                        {firstItem ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{firstItem.item_name} x {firstItem.quantity}</p>
                              {isOpen && table.items.length > 1 && (
                                <p className="mt-1 text-[10px] text-slate-500">+{table.items.length - 1} more item(s)</p>
                              )}
                            </div>
                            <p className="shrink-0 text-sm font-bold text-slate-900">Rs. {firstItem.total}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No items</p>
                        )}
                      </div>

                      {isOpen && (
                        <div className="mt-3 space-y-2">
                          {table.items.map((item, index) => (
                            <div
                              key={`${table.table_number}-${item.item_name}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-slate-900">{item.item_name} x {item.quantity}</p>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <span className={`h-2 w-2 rounded-full ${getKitchenStatusDotClass(item.status)}`} />
                                    <span className="text-[10px] text-slate-500">{getKitchenStatusLabel(item.status)}</span>
                                  </div>
                                </div>
                                <p className="shrink-0 text-xs font-bold text-slate-900">Rs. {item.total}</p>
                              </div>
                            </div>
                          ))}

                          {table.remarks.length > 0 && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                              <p className="mb-1 text-[10px] font-semibold text-slate-600">Remarks</p>
                              <div className="space-y-1">
                                {table.remarks.map((remark, index) => (
                                  <p key={`${table.table_number}-kitchen-remark-${index}`} className="line-clamp-2 text-[11px] text-slate-700">
                                    • {remark}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-rose-600">Total</p>
                          <p className="text-lg font-bold text-rose-600">Rs. {table.total}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenedKitchenTables((prev) => ({
                            ...prev,
                            [table.table_number]: !prev[table.table_number],
                          }))
                        }
                        className="mt-4 w-full rounded-[18px] bg-slate-100 py-3 text-sm font-semibold text-slate-700"
                      >
                        {isOpen ? "Close" : "Open"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderDashboardView() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle("Dashboard", "Compact mobile-first business snapshot", "📊")}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={getTrendCardClass(profitVsYesterday.className)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">💰 Today Sales</p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-900">
                    Rs. {totalRevenueToday}
                  </p>
                  <p className={`mt-1 text-[11px] font-semibold ${salesVsYesterday.className}`}>
                    {salesVsYesterday.text}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  💰
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-blue-200 bg-blue-50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">💳 Today Sales Split</p>

                  <div className="mt-2 space-y-1.5 pr-1 text-[10px] text-slate-700">
                   <div className="flex items-center tabular-nums">
  <span className="w-9 shrink-0 font-medium text-slate-600">Cash</span>

  <span className="flex-1 text-right font-semibold text-slate-900 whitespace-nowrap pr-2">
    Rs. {todayPaymentBreakdown.cash}
  </span>

  <span className="w-[44px] shrink-0 text-right text-[9px] text-slate-500">
    ({todayPaymentBreakdown.cashPercent}%)
  </span>
</div>

                    <div className="flex items-center tabular-nums">
  <span className="w-9 shrink-0 font-medium text-slate-600">QR</span>

  <span className="flex-1 text-right font-semibold text-slate-900 whitespace-nowrap pr-2">
    Rs. {todayPaymentBreakdown.qr}
  </span>

  <span className="w-[44px] shrink-0 text-right text-[9px] text-slate-500">
    ({todayPaymentBreakdown.qrPercent}%)
  </span>
</div>

                 <div className="flex items-center tabular-nums">
  <span className="w-11 shrink-0 font-medium text-slate-600">Card</span>

  <span className="flex-1 text-right font-semibold text-slate-900 whitespace-nowrap pr-2">
    Rs. {todayPaymentBreakdown.card}
  </span>

  <span className="w-[44px] shrink-0 text-right text-[9px] text-slate-500">
    ({todayPaymentBreakdown.cardPercent}%)
  </span>
</div>
                  </div>
                </div>

                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  💳
                </span>
              </div>
            </div>

            <div className={getTrendCardClass(salesVsYesterday.className)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">📈 Today Profit</p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-900">
                    Rs. {todayProfit}
                  </p>
                  <p className={`mt-1 text-[11px] font-semibold ${profitVsYesterday.className}`}>
                    {profitVsYesterday.text}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  📈
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">⏳ Unpaid Amount</p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-900">
                    Rs. {unpaidAmount}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  ⏳
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-purple-200 bg-purple-50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">🔥 Best Seller</p>
                  <p className="mt-1 break-words text-base font-bold text-slate-900">
                    {bestSellingItem ? bestSellingItem.item_name : "-"}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  🔥
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">🍽️ Items & Orders</p>
                  <div className="mt-2 space-y-1 text-[12px]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span>🍽️</span>
                        <span>Items Sold</span>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {totalItemsSoldToday}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span>🧾</span>
                        <span>Orders</span>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {totalOrdersToday}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base">
                  🍽️
                </span>
              </div>
            </div>
          </div>

          {renderKitchenStatusCards()}

          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {iconBubble("📈", "bg-blue-50")}
                <div>
                  <h3 className="font-bold text-slate-900">Sales Trend</h3>
                  <p className="text-xs text-slate-500">Minimal hourly chart</p>
                </div>
              </div>

              <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {peakHourLabel === "-" ? "No peak yet" : `Peak: ${peakHourLabel}`}
              </div>
            </div>

            {renderHourlyAreaChart()}
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              {iconBubble("📂", "bg-amber-50")}
              <div>
                <h3 className="font-bold text-slate-900">Live Updates</h3>
                <p className="text-xs text-slate-500">Compact mobile tab view</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDashboardMobileTab("unpaid")}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                  dashboardMobileTab === "unpaid"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Unpaid Tables
              </button>

              <button
                type="button"
                onClick={() => setDashboardMobileTab("activity")}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                  dashboardMobileTab === "activity"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Recent Activity
              </button>
            </div>

            {dashboardMobileTab === "unpaid" ? (
              groupedTableOrders.length === 0 ? (
                <p className="text-sm text-slate-500">No unpaid tables.</p>
              ) : (
                <div className="space-y-3">
                  {groupedTableOrders.slice(0, 5).map((table) => (
                    <div
                      key={table.table_number}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          Table {table.table_number}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {table.unpaid_orders_count} unpaid order(s)
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-slate-900">
                        Rs. {table.total}
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((order) => {
                  const total =
                    order.order_items?.reduce(
                      (sum, item) =>
                        sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
                      0
                    ) || 0;

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            Table {order.table_number}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            order.is_paid
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {order.is_paid ? "Paid" : "Unpaid"}
                        </span>
                      </div>

                      <p className="mt-2 text-right text-sm font-bold text-slate-900">
                        Rs. {total}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  function renderSalesOverviewView() {
    const topItems = selectedSalesSummary.topItems;
    const highestQty = topItems.length > 0 ? topItems[0].total_quantity : 0;

    const titleMap: Record<SalesPeriod, string> = {
      day: "Today",
      week: "Last 7 Days",
      month: "This Month",
    };

    const detailSectionTitle =
      salesPeriod === "day"
        ? "Day Summary"
        : salesPeriod === "week"
        ? "Daily Sales Boxes"
        : "Month Daily Boxes";

    const detailSectionSubtitle =
      salesPeriod === "day"
        ? "Current time samma ko sales"
        : salesPeriod === "week"
        ? "Previous day sanga compare garera color dekhauxa"
        : "Each day ko sales compare garera color dekhauxa";

    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Sales Overview",
          "Day, week ra month anusar sales progress",
          "💹"
        )}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSalesPeriod("day")}
              className={salesPeriodButtonClass("day")}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setSalesPeriod("week")}
              className={salesPeriodButtonClass("week")}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setSalesPeriod("month")}
              className={salesPeriodButtonClass("month")}
            >
              Month
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={getTrendCardClass(selectedSalesSummary.comparisonClass)}>
              <p className="text-[11px] font-medium text-slate-500">💰 Total Sales</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                Rs. {selectedSalesSummary.totalSales}
              </p>
              <p className={`mt-1 text-[11px] font-semibold ${selectedSalesSummary.comparisonClass}`}>
                {selectedSalesSummary.comparisonText}
              </p>
            </div>

            {statCard(
              "🧾 Orders",
              selectedSalesSummary.totalOrders,
              "🧾",
              "bg-blue-50 border border-blue-200"
            )}
            <div className={getTrendCardClass(selectedSalesSummary.profitComparisonClass)}>
              <p className="text-[11px] font-medium text-slate-500">📈 {selectedSalesSummary.profitLabel}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                Rs. {selectedSalesSummary.profitAmount}
              </p>
              <p className={`mt-1 text-[11px] font-semibold ${selectedSalesSummary.profitComparisonClass}`}>
                {selectedSalesSummary.profitComparisonText}
              </p>
            </div>
            {statCard(
              "🔥 Best Seller",
              selectedSalesSummary.bestSeller,
              "🔥",
              "bg-purple-50 border border-purple-200"
            )}
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              {iconBubble("📈", "bg-blue-50")}
              <div>
                <h3 className="font-bold text-slate-900">{titleMap[salesPeriod]} Trend</h3>
                <p className="text-xs text-slate-500">
                  {salesPeriod === "day"
                    ? "Hourly performance"
                    : salesPeriod === "week"
                    ? "Last 7 days"
                    : "Month to date"}
                </p>
              </div>
            </div>
            {renderCompactTrendChart()}
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              {iconBubble("🗂️", "bg-amber-50")}
              <div>
                <h3 className="font-bold text-slate-900">{detailSectionTitle}</h3>
                <p className="text-xs text-slate-500">{detailSectionSubtitle}</p>
              </div>
            </div>

            {salesDetailBoxes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No sales summary available.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {salesDetailBoxes.map((box) => (
                  <div
                    key={box.key}
                    className={`rounded-[16px] border px-3 py-2 shadow-sm ${box.cardClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold leading-snug text-slate-900">{box.label}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{box.sublabel}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-[2px] text-[10px] font-semibold ${box.badgeClass}`}
                      >
                        {box.badgeText}
                      </span>
                    </div>

                    <p className="mt-2 text-[13px] font-bold text-slate-900">Rs. {box.sales}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              {iconBubble("🍽️", "bg-green-50")}
              <div>
                <h3 className="font-bold text-slate-900">Top 5 Items {titleMap[salesPeriod]}</h3>
                <p className="text-xs text-slate-500">Summary boxes paxi item performance</p>
              </div>
            </div>

            {topItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No item sales for {salesPeriod === "day" ? "today" : salesPeriod === "week" ? "last 7 days" : "this month"}.
              </div>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, index) => {
                  const widthPercent =
                    highestQty > 0 ? (item.total_quantity / highestQty) * 100 : 0;

                  const isHighest = index === 0;
                  const isLowest = index === topItems.length - 1 && topItems.length > 1;

                const fillClass =
  index === 0
    ? "bg-emerald-500"
    : index === 1
    ? "bg-blue-500"
    : index === 2
    ? "bg-violet-500"
    : index === 3
    ? "bg-amber-500"
    : "bg-rose-500";

                  return (
                    <div
                      key={`${salesPeriod}-${item.item_name}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.item_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Qty: {item.total_quantity} • Rs. {item.total_revenue}
                          </p>
                        </div>

                        <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
  index === 0
    ? "bg-emerald-100 text-emerald-700"
    : index === 1
    ? "bg-blue-100 text-blue-700"
    : index === 2
    ? "bg-violet-100 text-violet-700"
    : index === 3
    ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700"
}`}
                        >
                          {index === 0
  ? "Top"
  : index === 1
  ? "2nd"
  : index === 2
  ? "3rd"
  : index === 3
  ? "4th"
  : "Low"}
                        </span>
                      </div>

                      <div className="h-5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`flex h-5 items-center justify-end rounded-full px-2 text-[10px] font-bold text-white ${fillClass}`}
                          style={{ width: `${Math.max(widthPercent, 12)}%` }}
                        >
                          {item.total_quantity}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }


  function renderReportView() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Report",
          "Date-wise, custom range, item-wise, payment breakdown",
          "📝"
        )}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-5">
          <div className="rounded-[22px] border border-blue-200 bg-blue-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">Date-wise Report</h3>
              <span className="text-xs text-slate-600">
                {formatReportDateLabel(selectedReportDate)}
              </span>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={selectedReportDate}
                onChange={(e) => setSelectedReportDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {statCard("Total Sales", `Rs. ${reportData.totalSales}`, "💰")}
              {statCard("Paid Orders", reportData.paidOrdersCount, "✅")}
              {statCard("Items Sold", reportData.totalItemsSold, "🍽️")}
              {statCard("Avg Order", `Rs. ${reportData.averageOrderValue}`, "📦")}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-bold text-slate-900">Item-wise Report</h4>

              {reportData.itemWiseReport.length === 0 ? (
                <p className="text-sm text-slate-500">No paid orders found for this date.</p>
              ) : (
                <div className="space-y-3">
                  {reportData.itemWiseReport.map((item) => (
                    <div
                      key={item.item_name}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.item_name}</p>
                        <p className="text-sm text-slate-500">Qty: {item.total_quantity}</p>
                      </div>
                      <p className="font-bold text-slate-900">Rs. {item.total_revenue}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-bold text-slate-900">Payment Breakdown</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                  <span>Cash</span>
                  <span className="font-bold">Rs. {reportData.paymentTotals.cash}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                  <span>QR</span>
                  <span className="font-bold">Rs. {reportData.paymentTotals.qr}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                  <span>Card</span>
                  <span className="font-bold">Rs. {reportData.paymentTotals.card}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-orange-200 bg-orange-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">Custom Range Report</h3>
              <span className="text-xs text-slate-600">
                {formatRangeLabel(reportFromDate, reportToDate)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">From Date</label>
                <input
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">To Date</label>
                <input
                  type="date"
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                />
              </div>
            </div>

            {reportFromDate > reportToDate && (
              <p className="text-sm font-medium text-red-600">
                From date cannot be greater than To date.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {statCard(
                "Total Sales",
                `Rs. ${reportFromDate > reportToDate ? 0 : rangeReportData.totalSales}`,
                "💰"
              )}
              {statCard(
                "Paid Orders",
                reportFromDate > reportToDate ? 0 : rangeReportData.paidOrdersCount,
                "✅"
              )}
              {statCard(
                "Items Sold",
                reportFromDate > reportToDate ? 0 : rangeReportData.totalItemsSold,
                "🍽️"
              )}
              {statCard(
                "Avg Order",
                `Rs. ${reportFromDate > reportToDate ? 0 : rangeReportData.averageOrderValue}`,
                "📦"
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderBillingView() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Billing",
          "Unpaid tables, unpaid amount, payment method, mark as paid",
          "💳"
        )}

        <div className="grid grid-cols-2 gap-3">
          {statCard("Unpaid Tables", unpaidTablesCount, "🪑", "bg-amber-50 border border-amber-200")}
          {statCard("Unpaid Amount", `Rs. ${unpaidAmount}`, "⏳", "bg-rose-50 border border-rose-200")}
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Search Table Number
            </label>
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Enter table number"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>

          <div className="space-y-4">
            {filteredTableOrders.length === 0 && (
              <p className="text-sm text-slate-500">No unpaid table orders found.</p>
            )}

            {filteredTableOrders.map((table) => {
              const selectedPaymentMethod =
                tablePaymentMethods[table.table_number] || "cash";

              return (
                <div
                  key={table.table_number}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">
                          Table {table.table_number}
                        </h3>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Unpaid
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Unpaid Orders: {table.unpaid_orders_count}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                      <p className="text-xs text-slate-500">Table Total</p>
                      <p className="font-bold text-slate-900">Rs. {table.total}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {table.items.map((item) => (
                      <div
                        key={item.item_name}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {item.item_name} x {item.quantity}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">Rs. {item.total}</p>
                      </div>
                    ))}
                  </div>

                  {table.remarks.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-600">Remarks</p>
                      <div className="space-y-1">
                        {table.remarks.map((remark, index) => (
                          <p
                            key={`${table.table_number}-remark-${index}`}
                            className="whitespace-pre-wrap text-sm text-slate-800"
                          >
                            • {remark}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
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
                        className={paymentButtonClass(table.table_number, "cash")}
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
                        className={paymentButtonClass(table.table_number, "qr")}
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
                        className={paymentButtonClass(table.table_number, "card")}
                      >
                        Card
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPaymentConfirmModal({
                        tableNo: table.table_number,
                        paymentMethod: selectedPaymentMethod,
                        total: table.total,
                      })
                    }
                    disabled={markingPaidTable === table.table_number}
                    className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
                  >
                    {markingPaidTable === table.table_number ? "Marking..." : "Mark as Paid"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderPaymentHistoryView() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Payment History",
          "Tap any paid order to open the 80mm customer bill popup",
          "🧾"
        )}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          {paidOrders.length === 0 && (
            <p className="text-sm text-slate-500">No paid orders yet.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {paidOrders.map((order) => {
              const orderTotal =
                order.order_items?.reduce(
                  (sum, item) =>
                    sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
                  0
                ) || 0;

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedPaidOrder(order)}
                  className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 space-y-2 text-left transition active:scale-[0.99] active:opacity-90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        Table {order.table_number}
                      </p>
                      <p className="text-[11px] text-slate-500">#{order.id}</p>
                    </div>

                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
                      Paid
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-700">
                    {order.order_items?.length ? (
                      order.order_items.slice(0, 3).map((item) => (
                        <p key={item.id} className="truncate">
                          {item.item_name} x {item.quantity}
                        </p>
                      ))
                    ) : (
                      <p>No items</p>
                    )}

                    {order.order_items && order.order_items.length > 3 && (
                      <p className="text-[11px] text-slate-500">
                        +{order.order_items.length - 3} more
                      </p>
                    )}
                  </div>

                  {order.remarks && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                      <p className="mb-1 text-[10px] font-semibold text-slate-600">Remarks</p>
                      <p className="line-clamp-2 text-[11px] text-slate-800">{order.remarks}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
                    <div className="rounded-xl bg-white p-2">
                      <p className="text-[10px] text-slate-500">Total</p>
                      <p className="text-xs font-bold text-slate-900">Rs. {orderTotal}</p>
                    </div>

                    <div className="rounded-xl bg-white p-2">
                      <p className="text-[10px] text-slate-500">Method</p>
                      <p className="text-xs font-bold text-slate-900">
                        {formatPaymentMethod(order.payment_method)}
                      </p>
                    </div>

                    <div className="col-span-2 rounded-xl bg-white p-2">
                      <p className="text-[10px] text-slate-500">Paid Time</p>
                      <p className="text-[11px] font-semibold text-slate-900">
                        {order.paid_at ? new Date(order.paid_at).toLocaleString() : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-blue-700">
                      Open customer bill
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderMenuItemsPopup() {
    return (
      <div className="space-y-4 pb-4">
        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            {iconBubble("🍽️", "bg-blue-50")}
            <div>
              <h3 className="font-bold text-slate-900">Menu Items</h3>
              <p className="text-xs text-slate-500">Add, edit, delete menu items</p>
            </div>
          </div>

          <form onSubmit={handleAddMenuItem} className="mb-4 space-y-3">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="New item name"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />

            <input
              type="number"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              placeholder="Price"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />

            <button
              type="submit"
              className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
            >
              Add Menu Item
            </button>
          </form>

          <div className="space-y-3">
            {menuItems.length === 0 && (
              <p className="text-sm text-slate-500">No menu items yet.</p>
            )}

            {menuItems.map((menu) => (
              <div
                key={menu.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-3 space-y-3"
              >
                {editingMenuId === menu.id ? (
                  <>
                    <input
                      type="text"
                      value={editingItemName}
                      onChange={(e) => setEditingItemName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />

                    <input
                      type="number"
                      value={editingItemPrice}
                      onChange={(e) => setEditingItemPrice(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEditMenuItem(menu.id)}
                        className="flex-1 rounded-2xl bg-green-600 py-2.5 font-semibold text-white"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditMenuItem}
                        className="flex-1 rounded-2xl bg-slate-400 py-2.5 font-semibold text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{menu.item_name}</p>
                        <p className="text-sm text-slate-500">Rs. {menu.price}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditMenuItem(menu)}
                        className="flex-1 rounded-2xl bg-amber-500 py-2.5 font-semibold text-white"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteMenuItem(menu.id)}
                        className="flex-1 rounded-2xl bg-red-600 py-2.5 font-semibold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }


  async function copyQrLink(link: string, label: string) {
    if (!link) {
      showToast("Link not available", "error", "QR Access");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("Clipboard unavailable");
      }

      showToast(`${label} link copied`, "success", "Link Copied");
    } catch (error) {
      showToast("Failed to copy link", "error", "Copy Failed");
    }
  }

  function downloadQrCode(canvasId: string, fileName: string) {
    if (typeof document === "undefined") {
      showToast("QR download is not available right now", "error", "QR Download");
      return;
    }

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

    if (!canvas) {
      showToast("QR is not ready yet", "error", "QR Download");
      return;
    }

    const pngUrl = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = pngUrl;
    anchor.download = fileName;
    anchor.click();
  }

  function renderQrAccessCard(
    title: string,
    subtitle: string,
    link: string,
    canvasId: string,
    fileName: string
  ) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex rounded-[22px] bg-white p-4 shadow-sm">
            <QRCodeCanvas
              id={canvasId}
              value={link || " "}
              size={190}
              includeMargin={true}
            />
          </div>

          <p className="mt-4 text-lg font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold text-slate-500">Link</p>
          <p className="mt-1 break-all text-xs text-slate-700">{link || "-"}</p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => copyQrLink(link, title)}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.22)]"
          >
            Copy Link
          </button>

          <button
            type="button"
            onClick={() => downloadQrCode(canvasId, fileName)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Download QR
          </button>
        </div>
      </div>
    );
  }

  function renderProfitPercentPopup() {
    return (
      <div className="space-y-4 pb-4">
        <div className="rounded-[26px] border border-emerald-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            {iconBubble("📈", "bg-emerald-50")}
            <div>
              <h3 className="font-bold text-slate-900">Profit %</h3>
              <p className="text-xs text-slate-500">Set overall profit percentage manually</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Profit Percentage
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={profitPercentInput}
                onChange={(e) => setProfitPercentInput(e.target.value)}
                placeholder="Enter profit %"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                %
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={saveProfitPercent}
            disabled={savingProfitPercent}
            className="w-full rounded-2xl bg-emerald-600 py-3 font-semibold text-white shadow-[0_10px_25px_rgba(5,150,105,0.24)]"
          >
            {savingProfitPercent ? "Saving..." : "Save Profit %"}
          </button>
        </div>
      </div>
    );
  }

  function renderPasswordsPopup() {
    return (
      <div className="space-y-4 pb-4">
        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            {iconBubble("🔐", "bg-blue-50")}
            <div>
              <h3 className="font-bold text-slate-900">Passwords</h3>
              <p className="text-xs text-slate-500">Owner, waiter, kitchen password management</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Owner Password
            </label>
            <input
              type="text"
              value={newOwnerPassword}
              onChange={(e) => setNewOwnerPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Waiter Password
            </label>
            <input
              type="text"
              value={newWaiterPassword}
              onChange={(e) => setNewWaiterPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Kitchen Password
            </label>
            <input
              type="text"
              value={newKitchenPassword}
              onChange={(e) => setNewKitchenPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>

          <button
            type="button"
            onClick={savePasswords}
            disabled={savingPasswords}
            className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
          >
            {savingPasswords ? "Saving..." : "Save Passwords"}
          </button>
        </div>
      </div>
    );
  }

  function renderQrAccessPopup() {
    return (
      <div className="flex h-full flex-col pb-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {iconBubble("🔳", "bg-blue-50")}
              <div>
                <h3 className="font-bold text-slate-900">QR Access</h3>
                <p className="text-xs text-slate-500">
                  Waiter ra kitchen QR vertically dekhine, scroll garna milne.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPopupView(null)}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Close
            </button>
          </div>

          <div className="mb-4 rounded-[22px] border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">QR Tools</p>
            <p className="mt-1 text-xs text-slate-500">
              Scroll गरेर QR herna sakinchha, link copy garna milchha ra QR image download pani garna milchha.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {renderQrAccessCard(
              "Waiter QR",
              "Waiter panel kholna yo QR scan garnus.",
              waiterQrUrl,
              "waiter-qr-canvas",
              `waiter-qr-${restaurantId || "restaurant"}.png`
            )}

            {renderQrAccessCard(
              "Kitchen QR",
              "Kitchen panel kholna yo QR scan garnus.",
              kitchenQrUrl,
              "kitchen-qr-canvas",
              `kitchen-qr-${restaurantId || "restaurant"}.png`
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderMainSection() {
    if (popupView === "menuItems") {
      return renderMenuItemsPopup();
    }

    if (popupView === "passwords") {
      return renderPasswordsPopup();
    }

    if (popupView === "profitPercent") {
      return renderProfitPercentPopup();
    }

    if (popupView === "qrAccess") {
      return renderQrAccessPopup();
    }

    if (ownerView === "dashboard") {
      return renderDashboardView();
    }

    if (ownerView === "salesOverview") {
      return renderSalesOverviewView();
    }

    if (ownerView === "report") {
      return renderReportView();
    }

    if (ownerView === "billing") {
      return renderBillingView();
    }

    return renderPaymentHistoryView();
  }

  const shellClass =
  "mx-auto w-full max-w-[430px] min-h-screen bg-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.10)] text-[15px]";

  if (!restaurantId) {
    return (
      <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} flex items-center justify-center p-4`}>
          <div className="rounded-3xl bg-white p-5 text-center text-sm font-medium text-red-600 shadow border border-slate-200">
            Invalid restaurant link. Please use the correct restaurant URL.
          </div>
        </div>
      </main>
    );
  }
if (showSplash) {
  return <AppSplash />;
}
  if (checkingRestaurant) {
    return (
      <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} flex items-center justify-center p-4`}>
          <div className="rounded-3xl bg-white p-5 text-center text-sm font-medium shadow border border-slate-200">
            Loading...
          </div>
        </div>
      </main>
    );
  }

  if (!restaurantExists) {
    return (
      <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} flex items-center justify-center p-4`}>
          <div className="rounded-3xl bg-white p-5 text-center text-sm font-medium text-red-600 shadow border border-slate-200">
            Restaurant link not found. Please use the correct restaurant URL.
          </div>
        </div>
      </main>
    );
  }

  if (!isSetupDone) {
    return (
      <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} p-3`}>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900">Owner Setup</h1>
              <p className="mt-1 text-sm text-slate-500">
                Complete first-time setup for this restaurant
              </p>
            </div>

            <form onSubmit={handleInitialSetup} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  value={setupRestaurantName}
                  onChange={(e) => setSetupRestaurantName(e.target.value)}
                  placeholder="Enter restaurant name"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Owner Password
                </label>
                <input
                  type="text"
                  value={setupOwnerPassword}
                  onChange={(e) => setSetupOwnerPassword(e.target.value)}
                  placeholder="Create owner password"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Waiter Password
                </label>
                <input
                  type="text"
                  value={setupWaiterPassword}
                  onChange={(e) => setSetupWaiterPassword(e.target.value)}
                  placeholder="Create waiter password"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Kitchen Password
                </label>
                <input
                  type="text"
                  value={setupKitchenPassword}
                  onChange={(e) => setSetupKitchenPassword(e.target.value)}
                  placeholder="Create kitchen password"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <button
                type="submit"
                disabled={settingUpRestaurant}
                className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
              >
                {settingUpRestaurant ? "Setting up..." : "Complete Setup"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

if (!ownerUnlocked) {
  return (
    <PanelLoginCard
      restaurantName={restaurantName}
      panelTitle="Owner Panel"
      panelDescription="Secure access to billing, reports and live restaurant activity."
      passwordLabel="Owner Password"
      passwordPlaceholder="Enter owner password"
      passwordValue={ownerPasswordInput}
      onPasswordChange={setOwnerPasswordInput}
      onSubmit={unlockOwner}
      buttonText="Unlock Owner Panel"
      theme="owner"
    />
  );
}

  return (
    <main className="min-h-screen bg-slate-200 flex justify-center px-3">
      <div className={`${shellClass} h-screen overflow-hidden relative`}>
        {appToast && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-[80] w-[calc(100%-24px)] max-w-[360px] -translate-x-1/2">
            <div
              className={`rounded-2xl px-4 py-3 shadow-[0_14px_35px_rgba(15,23,42,0.14)] ${
                appToast.tone === "error"
                  ? "border border-rose-200 bg-rose-50"
                  : appToast.tone === "info"
                  ? "border border-blue-200 bg-blue-50"
                  : "border border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${
                    appToast.tone === "error"
                      ? "bg-rose-100 text-rose-700"
                      : appToast.tone === "info"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {appToast.tone === "error" ? "⚠️" : appToast.tone === "info" ? "ℹ️" : "✅"}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-bold ${
                      appToast.tone === "error"
                        ? "text-rose-700"
                        : appToast.tone === "info"
                        ? "text-blue-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {appToast.title}
                  </p>
                  <p
                    className={`text-xs ${
                      appToast.tone === "error"
                        ? "text-rose-700/90"
                        : appToast.tone === "info"
                        ? "text-blue-700/90"
                        : "text-emerald-700/90"
                    }`}
                  >
                    {appToast.message}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex h-full flex-col px-3">
          <div className="shrink-0 pt-3 pb-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_10px_35px_rgba(15,23,42,0.08)]">
              <div className="rounded-[24px] bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3.5 text-white shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black">
  <img
    src="/logo.png"
    alt="Logo"
    className="h-full w-full object-cover"
  />
</div>

                    <div className="min-w-0">
                      <h1 className="truncate text-base font-bold">
                        {restaurantName || "Restaurant"}
                      </h1>
                      <p className="text-xs text-blue-100">Owner Panel</p>
                    </div>
                  </div>

                  <div className="relative shrink-0" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (popupView) {
                          setPopupView(null);
                          setShowHeaderMenu(false);
                        } else {
                          setShowHeaderMenu((prev) => !prev);
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold text-white"
                    >
                      ⋯
                    </button>

                    {showHeaderMenu && (
                      <div className="absolute right-0 top-12 z-20 w-[250px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                        <div className="grid grid-cols-2 gap-2 pb-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPopupView((prev) => (prev === "menuItems" ? null : "menuItems"));
                              setShowHeaderMenu(false);
                              scrollMainContentToTop();
                            }}
                            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-semibold ${popupView === "menuItems" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                          >
                            <span className="text-base">🍽️</span>
                            Menu Items
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPopupView((prev) => (prev === "profitPercent" ? null : "profitPercent"));
                              setShowHeaderMenu(false);
                              scrollMainContentToTop();
                            }}
                            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-semibold ${popupView === "profitPercent" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                          >
                            <span className="text-base">📈</span>
                            Profit %
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setPopupView("passwords");
                            setShowHeaderMenu(false);
                            scrollMainContentToTop();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">🔐</span>
                          Passwords
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPopupView("qrAccess");
                            setShowHeaderMenu(false);
                            scrollMainContentToTop();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">🔳</span>
                          QR Access
                        </button>

                        <button
                          type="button"
                          onClick={logoutOwner}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          <span className="text-base">🚪</span>
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                    Today Sales: Rs. {totalRevenueToday}
                  </span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                    Unpaid: Rs. {unpaidAmount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div ref={contentScrollRef} className="min-h-0 flex-1 overflow-y-auto pb-24">
            {isSwitching ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading...
              </div>
            ) : (
              renderMainSection()
            )}
          </div>
        </div>

        {confirmDialog && (
          <div className="absolute inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
              <div className="flex items-start gap-3">
                <div
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${
                    confirmDialog.tone === "danger" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {confirmDialog.tone === "danger" ? "🗑️" : "⚠️"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">{confirmDialog.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{confirmDialog.message}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeConfirmDialog}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmDialog.onConfirm;
                    if (!action) {
                      closeConfirmDialog();
                      return;
                    }
                    await action();
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
                    confirmDialog.tone === "danger" ? "bg-rose-600" : "bg-slate-900"
                  }`}
                >
                  {confirmDialog.confirmText || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {paymentConfirmModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4">
            <div className="w-full max-w-[360px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl">
                  💳
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">Confirm Payment</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Table {paymentConfirmModal.tableNo} ko sabai unpaid orders paid mark garne?
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-500">Payment Method</span>
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                      {paymentConfirmModal.paymentMethod === "qr"
                        ? "QR"
                        : paymentConfirmModal.paymentMethod === "card"
                        ? "CARD"
                        : "CASH"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-500">Table Total</span>
                    <span className="text-base font-bold text-slate-900">
                      Rs. {paymentConfirmModal.total}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentConfirmModal(null)}
                  className="rounded-2xl border border-slate-200 bg-slate-100 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const current = paymentConfirmModal;
                    setPaymentConfirmModal(null);
                    if (current) {
                      await markGroupedTableAsPaid(current.tableNo, current.paymentMethod);
                    }
                  }}
                  className="rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedPaidOrder && selectedPaidBill && (
          <div className="fixed inset-0 z-[90] bg-black/55">
            <div className="mx-auto flex h-full max-w-[430px] flex-col bg-gray-100">
              <div
                className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4"
                style={{ paddingTop: "max(env(safe-area-inset-top), 18px)" }}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaidOrder(null)}
                    className="shrink-0 rounded-2xl bg-gray-200 px-3 py-3 text-sm font-semibold active:opacity-85"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => printBill(selectedPaidBill)}
                    className="flex-1 rounded-2xl bg-slate-900 px-3 py-3 text-sm font-bold text-white active:scale-[0.98]"
                  >
                    Print
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadBill(selectedPaidBill)}
                    className="flex-1 rounded-2xl border border-slate-900 bg-white px-3 py-3 text-sm font-bold text-slate-900 active:scale-[0.98]"
                  >
                    PDF
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Customer Bill
                    </p>
                    <h3 className="mt-1 text-[20px] font-extrabold text-slate-900">
                      Paid Receipt
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatPaymentMethod(selectedPaidOrder.payment_method)} • {formatShortPaidTime(selectedPaidOrder.paid_at)}
                    </p>
                  </div>

                  {renderBillCard(selectedPaidBill)}
                </div>
              </div>
            </div>
          </div>
        )}

    {popupView !== "qrAccess" && (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 rounded-[15px] border border-white/60 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
          <div className="grid grid-cols-5 gap-2 px-2.5 pt-0.5 pb-4">
            <button
              type="button"
              onClick={() => changeView("dashboard")}
              className={bottomNavButtonClass("dashboard")}
            >
              <span className="text-lg">📊</span>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => changeView("salesOverview")}
              className={bottomNavButtonClass("salesOverview")}
            >
              <span className="text-base">💹</span>
              <span>Sales</span>
            </button>

            <button
              type="button"
              onClick={() => changeView("report")}
              className={bottomNavButtonClass("report")}
            >
              <span className="text-base">📝</span>
              <span>Report</span>
            </button>

            <button
              type="button"
              onClick={() => changeView("billing")}
              className={bottomNavButtonClass("billing")}
            >
              <span className="text-base">💳</span>
              <span>Billing</span>
            </button>

            <button
              type="button"
              onClick={() => changeView("paymentHistory")}
              className={bottomNavButtonClass("paymentHistory")}
            >
              <span className="text-base">🧾</span>
              <span>History</span>
            </button>
          </div>
        </div>
        )}
      </div>
    </main>
  );
}

export default function OwnerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OwnerPageContent />
    </Suspense>
  );
}
