"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppSplash from "@/components/AppSplash";
import PanelLoginCard from "@/components/PanelLoginCard";

type OrderItem = {
  id: number;
  item_name: string;
  quantity: number;
  status: "pending" | "preparing" | "ready";
};

type Order = {
  id: number;
  table_number: string;
  status: "pending" | "preparing" | "ready" | string;
  created_at: string;
  remarks?: string | null;
  order_items?: OrderItem[];
};

type ItemStatus = "pending" | "preparing" | "ready";

type PushSubscribeResult =
  | "subscribed"
  | "already_subscribed"
  | "denied"
  | "unsupported"
  | "failed";

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

function KitchenPageContent() {
  const searchParams = useSearchParams();
  const restaurantId = Number(searchParams.get("id"));
  const tableFromUrl = searchParams.get("table");

  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightedTable, setHighlightedTable] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<Record<number, ItemStatus | null>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousPendingCountRef = useRef(0);
  const hasFetchedOnceRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasAutoHandledTableRef = useRef(false);
  const tableRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingOrdersRef = useRef(false);
  const pendingOrdersRefreshRef = useRef(false);
  const refreshOrdersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const showToast = useCallback((message: string) => {
    setToast(message);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (refreshOrdersTimerRef.current) {
        clearTimeout(refreshOrdersTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;

    localStorage.setItem("lastRestaurantId", String(restaurantId));
    localStorage.setItem("lastPanel", "kitchen");
  }, [restaurantId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 450);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!restaurantId) return;

    const savedLogin = localStorage.getItem(`kitchen_logged_in_${restaurantId}`);
    if (savedLogin === "true") {
      setUnlocked(true);
    }

    const savedSound = localStorage.getItem(`kitchen_sound_enabled_${restaurantId}`);
    if (savedSound === "true") {
      setSoundEnabled(true);
    }
  }, [restaurantId]);

  const fetchRestaurant = useCallback(async () => {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (!error && data && mountedRef.current) {
      const restaurantData = data as Record<string, any>;
      setRestaurantName(
        restaurantData.name ||
          restaurantData.restaurant_name ||
          restaurantData.restaurant ||
          restaurantData.title ||
          "Restaurant"
      );
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchRestaurant();
  }, [restaurantId, fetchRestaurant]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [menuOpen]);

  async function handleUnlock() {
    if (!restaurantId) {
      showToast("Invalid restaurant link");
      return;
    }

    const { data, error } = await supabase
      .from("restaurants")
      .select("kitchen_password")
      .eq("id", restaurantId)
      .single();

    if (error || !data) {
      showToast("Error fetching password");
      return;
    }

    if (password === data.kitchen_password) {
      setUnlocked(true);
      localStorage.setItem(`kitchen_logged_in_${restaurantId}`, "true");
      showToast("Kitchen panel unlocked");
    } else {
      showToast("Wrong password");
    }
  }

  function handleLogout() {
    if (restaurantId) {
      localStorage.removeItem(`kitchen_logged_in_${restaurantId}`);
    }
    setUnlocked(false);
    setPassword("");
    setMenuOpen(false);
    setUpdatingItems({});
    showToast("Logged out");
  }

  const applyVisibleOrders = useCallback(
    (incomingOrders: Order[]) => {
      const normalized = incomingOrders.map((order) => ({
        ...order,
        order_items: (order.order_items || []).filter((item) => item.status !== "ready"),
      }));

      const visibleOrders = normalized.filter((order) => (order.order_items || []).length > 0);
      const pendingOrders = visibleOrders.filter((order) =>
        (order.order_items || []).some((item) => item.status === "pending")
      );

      if (
        soundEnabled &&
        hasFetchedOnceRef.current &&
        pendingOrders.length > previousPendingCountRef.current
      ) {
        audioRef.current?.play().catch(() => {});
      }

      previousPendingCountRef.current = pendingOrders.length;
      hasFetchedOnceRef.current = true;
      setOrders(visibleOrders);
    },
    [soundEnabled]
  );

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;

    if (fetchingOrdersRef.current) {
      pendingOrdersRefreshRef.current = true;
      return;
    }

    fetchingOrdersRef.current = true;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing"])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (!error && data && mountedRef.current) {
        applyVisibleOrders(data as Order[]);
      }
    } finally {
      fetchingOrdersRef.current = false;

      if (pendingOrdersRefreshRef.current) {
        pendingOrdersRefreshRef.current = false;
        window.setTimeout(() => {
          if (mountedRef.current) {
            fetchOrders();
          }
        }, 50);
      }
    }
  }, [applyVisibleOrders, restaurantId]);

  const scheduleOrdersRefresh = useCallback(
    (delay = 120) => {
      if (refreshOrdersTimerRef.current) {
        clearTimeout(refreshOrdersTimerRef.current);
      }

      refreshOrdersTimerRef.current = setTimeout(() => {
        fetchOrders();
      }, delay);
    },
    [fetchOrders]
  );

  useEffect(() => {
    if (!unlocked || !restaurantId) return;

    fetchOrders();

    const ordersChannel = supabase
      .channel(`kitchen-orders-${restaurantId}`)
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

    const orderItemsChannel = supabase
      .channel(`kitchen-order-items-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        () => {
          scheduleOrdersRefresh(100);
        }
      )
      .subscribe();

    return () => {
      if (refreshOrdersTimerRef.current) {
        clearTimeout(refreshOrdersTimerRef.current);
      }
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(orderItemsChannel);
    };
  }, [unlocked, restaurantId, fetchOrders, scheduleOrdersRefresh]);

  function getNextOrderStatus(order: Order | undefined, itemId: number, nextStatus: ItemStatus): ItemStatus {
    const currentItems = order?.order_items || [];
    const nextStatuses = currentItems.map((item) => (item.id === itemId ? nextStatus : item.status));

    if (nextStatuses.length > 0 && nextStatuses.every((status) => status === "ready")) {
      return "ready";
    }

    if (nextStatuses.some((status) => status === "preparing" || status === "ready")) {
      return "preparing";
    }

    return "pending";
  }

  async function updateItemStatus(orderId: number, itemId: number, status: ItemStatus) {
    const currentLock = updatingItems[itemId];
    if (currentLock) return;

    const targetOrder = orders.find((order) => order.id === orderId);
    const targetItem = targetOrder?.order_items?.find((item) => item.id === itemId);

    if (!targetOrder || !targetItem) {
      showToast("Order item not found");
      scheduleOrdersRefresh(0);
      return;
    }

    if (targetItem.status === status) {
      return;
    }

    const tableNo = String(targetOrder.table_number || "").trim();
    const nextOrderStatus = getNextOrderStatus(targetOrder, itemId, status);

    setUpdatingItems((prev) => ({ ...prev, [itemId]: status }));

    setOrders((prev) =>
      prev
        .map((order) => {
          if (order.id !== orderId) return order;

          const updatedItems = (order.order_items || [])
            .map((item) => (item.id === itemId ? { ...item, status } : item))
            .filter((item) => item.status !== "ready");

          return {
            ...order,
            status: nextOrderStatus,
            order_items: updatedItems,
          };
        })
        .filter((order) => (order.order_items || []).length > 0)
    );

    try {
      const { error: itemError } = await supabase
        .from("order_items")
        .update({ status })
        .eq("id", itemId)
        .eq("order_id", orderId);

      if (itemError) {
        throw itemError;
      }

      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: nextOrderStatus })
        .eq("id", orderId)
        .eq("restaurant_id", restaurantId);

      if (orderError) {
        throw orderError;
      }

      if (status === "ready" && restaurantId && tableNo) {
        fetch("/api/push/order-ready", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            table: tableNo,
          }),
        }).catch((pushError) => {
          console.error("Failed to send order ready push:", pushError);
        });
      }

      showToast(
        status === "ready"
          ? "Item marked ready"
          : status === "preparing"
          ? "Item marked preparing"
          : "Item marked pending"
      );

      scheduleOrdersRefresh(60);
    } catch (error) {
      console.error("Failed to update item status:", error);
      showToast("Failed to update item status");
      scheduleOrdersRefresh(0);
    } finally {
      setUpdatingItems((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }

  async function subscribeKitchenPush(): Promise<PushSubscribeResult> {
    try {
      if (typeof window === "undefined") {
        return "unsupported";
      }

      if (!restaurantId) {
        showToast("Invalid restaurant link");
        return "failed";
      }

      if (!("serviceWorker" in navigator)) {
        showToast("Service worker not supported");
        return "unsupported";
      }

      if (!("PushManager" in window)) {
        showToast("Push notification not supported");
        return "unsupported";
      }

      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        return "denied";
      }

      let registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
      }

      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        showToast("Missing VAPID public key");
        return "failed";
      }

      let subscription = await registration.pushManager.getSubscription();
      const alreadySubscribed = !!subscription;

      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
          console.log("Kitchen push subscription created:", subscription);
        } catch (err) {
          console.error("Kitchen push subscribe failed:", err);
          return "failed";
        }
      }

      if (!subscription) {
        return "failed";
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        body: JSON.stringify({
          restaurant_id: restaurantId,
          subscription,
          panel: "kitchen",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Kitchen subscribe API failed:", data);
        return "failed";
      }

      return alreadySubscribed ? "already_subscribed" : "subscribed";
    } catch (error) {
      console.error("Kitchen push subscribe error:", error);
      return "failed";
    }
  }

  async function enableSound() {
    if (!restaurantId) {
      showToast("Invalid restaurant link");
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

      setSoundEnabled(true);
      localStorage.setItem(`kitchen_sound_enabled_${restaurantId}`, "true");
      setMenuOpen(false);

      const pushResult = await subscribeKitchenPush();

      if (pushResult === "subscribed") {
        showToast("Kitchen sound + notifications enabled");
        return;
      }

      if (pushResult === "already_subscribed") {
        showToast("Kitchen sound enabled");
        return;
      }

      if (pushResult === "denied") {
        showToast("Kitchen sound enabled. Allow notifications from browser settings.");
        return;
      }

      if (pushResult === "unsupported") {
        showToast("Kitchen sound enabled. Push notification not supported here.");
        return;
      }

      showToast("Kitchen sound enabled, but notification setup failed.");
    } catch {
      showToast("Could not enable sound. Please tap again.");
    }
  }

  function disableSound() {
    if (!restaurantId) return;
    setSoundEnabled(false);
    localStorage.setItem(`kitchen_sound_enabled_${restaurantId}`, "false");
    setMenuOpen(false);
    showToast("Sound disabled");
  }

  const oldestPendingOrderId = useMemo(() => {
    const pendingOnly = orders.filter((order) =>
      (order.order_items || []).some((item) => item.status === "pending")
    );

    if (pendingOnly.length === 0) return null;

    const sorted = [...pendingOnly].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return aTime - bTime;
    });

    return sorted[0]?.id ?? null;
  }, [orders]);

  useEffect(() => {
    if (!unlocked) return;
    if (!tableFromUrl) return;
    if (hasAutoHandledTableRef.current) return;
    if (orders.length === 0) return;

    const normalizedTableFromUrl = String(tableFromUrl).trim();
    const matchedOrder = orders.find(
      (order) => String(order.table_number || "").trim() === normalizedTableFromUrl
    );

    if (!matchedOrder) return;

    hasAutoHandledTableRef.current = true;
    setHighlightedTable(normalizedTableFromUrl);

    const tableElement = tableRefs.current[normalizedTableFromUrl];
    if (tableElement) {
      tableElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    const clearTimer = window.setTimeout(() => {
      setHighlightedTable("");
    }, 5000);

    return () => window.clearTimeout(clearTimer);
  }, [orders, tableFromUrl, unlocked]);

  if (showSplash) {
    return <AppSplash subtitle="Kitchen Loading..." />;
  }

  if (!restaurantId) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-5 sm:p-6 text-center text-sm sm:text-base text-red-600 font-semibold shadow-sm">
          Invalid restaurant link. Please use the correct restaurant URL.
        </div>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <>
        <PanelLoginCard
          restaurantName={restaurantName}
          panelTitle="Kitchen Panel"
          panelDescription="Access live kitchen orders and update preparation status."
          passwordLabel="Kitchen Password"
          passwordPlaceholder="Enter kitchen password"
          passwordValue={password}
          onPasswordChange={setPassword}
          onSubmit={handleUnlock}
          buttonText="Enter Kitchen Panel"
          theme="kitchen"
        />

        {toast && (
          <div className="fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4">
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(15,23,42,0.28)]">
              {toast}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <audio ref={audioRef} src="/bell.mp3" preload="auto" />

      <main className="min-h-screen bg-slate-100 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 2xl:px-10">
        <div className="mx-auto w-full max-w-[1800px] space-y-4 sm:space-y-5 md:space-y-6">
          <div className="rounded-[28px] bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-3 text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)] sm:px-5 sm:py-4 md:px-6 md:py-5">
            <div className="flex items-start justify-between gap-3 sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black shadow-md">
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="h-full w-full object-contain scale-110"
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-base sm:text-lg md:text-xl font-bold">
                    {restaurantName || "Restaurant"}
                  </h1>
                  <p className="text-xs sm:text-sm text-white/80">Kitchen Panel</p>
                </div>
              </div>

              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold text-white active:scale-[0.97] select-none touch-manipulation"
                  aria-label="Open menu"
                  type="button"
                >
                  ⋮
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
                    <button
                      onClick={soundEnabled ? disableSound : enableSound}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 active:scale-[0.99] select-none touch-manipulation"
                      type="button"
                    >
                      <span className="text-base">{soundEnabled ? "🔕" : "🔔"}</span>
                      <span>{soundEnabled ? "Disable Sound" : "Enable Sound"}</span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 active:scale-[0.99] select-none touch-manipulation"
                      type="button"
                    >
                      <span className="text-base">🚪</span>
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <p className="text-sm sm:text-base md:text-lg text-slate-500">No active kitchen items.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {orders.map((order) => {
                const isOldestPending = order.id === oldestPendingOrderId;

                return (
                  <div
                    key={order.id}
                    ref={(el) => {
                      tableRefs.current[String(order.table_number).trim()] = el;
                    }}
                    className={`rounded-[24px] border p-3 shadow-sm sm:p-4 md:p-4 lg:p-5 transition-all duration-300 ${
                      highlightedTable && String(order.table_number).trim() === highlightedTable
                        ? "border-blue-500 bg-blue-50 ring-4 ring-blue-200"
                        : isOldestPending
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {isOldestPending && (
                            <div className="mb-2">
                              <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-white">
                                🔥 Oldest Pending
                              </span>
                            </div>
                          )}

                          <h2 className="truncate text-xl sm:text-2xl font-bold text-slate-900">
                            Table {order.table_number}
                          </h2>

                          {highlightedTable &&
                            String(order.table_number).trim() === highlightedTable && (
                              <div className="mt-2">
                                <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-white">
                                  🔔 Opened from notification
                                </span>
                              </div>
                            )}

                          <p className="mt-1 text-xs sm:text-sm text-slate-500">Order #{order.id}</p>

                          <p className="mt-1 text-[11px] sm:text-xs text-slate-500 break-words">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-semibold capitalize ${
                            order.status === "preparing"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      {order.remarks && (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
                          <p className="mb-1 text-[11px] sm:text-xs font-semibold text-orange-700">
                            Customer Remarks
                          </p>
                          <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                            {order.remarks}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2.5 sm:space-y-3">
                        {order.order_items?.length ? (
                          order.order_items.map((item) => {
                            const isUpdating = !!updatingItems[item.id];

                            return (
                              <div
                                key={item.id}
                                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm sm:text-base font-semibold text-slate-900">
                                      {item.item_name}
                                    </p>
                                    <p className="mt-1 text-xs sm:text-sm text-slate-500">
                                      Qty: {item.quantity}
                                    </p>
                                  </div>

                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-semibold capitalize ${
                                      item.status === "ready"
                                        ? "bg-green-100 text-green-700"
                                        : item.status === "preparing"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-slate-200 text-slate-700"
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    onClick={() => updateItemStatus(order.id, item.id, "pending")}
                                    disabled={isUpdating}
                                    className="min-h-[40px] rounded-xl bg-slate-600 px-2 py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-white active:scale-[0.98] select-none touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
                                    type="button"
                                  >
                                    {isUpdating && updatingItems[item.id] === "pending" ? "Saving..." : "Pending"}
                                  </button>

                                  <button
                                    onClick={() => updateItemStatus(order.id, item.id, "preparing")}
                                    disabled={isUpdating}
                                    className="min-h-[40px] rounded-xl bg-yellow-500 px-2 py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-white active:scale-[0.98] select-none touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
                                    type="button"
                                  >
                                    {isUpdating && updatingItems[item.id] === "preparing" ? "Saving..." : "Preparing"}
                                  </button>

                                  <button
                                    onClick={() => updateItemStatus(order.id, item.id, "ready")}
                                    disabled={isUpdating}
                                    className="min-h-[40px] rounded-xl bg-green-600 px-2 py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-white active:scale-[0.98] select-none touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
                                    type="button"
                                  >
                                    {isUpdating && updatingItems[item.id] === "ready" ? "Saving..." : "Ready"}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500">No items</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4">
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(15,23,42,0.28)]">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}

export default function KitchenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">
          Loading...
        </div>
      }
    >
      <KitchenPageContent />
    </Suspense>
  );
}
