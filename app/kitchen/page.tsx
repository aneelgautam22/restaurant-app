"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  status: string;
  created_at: string;
  remarks?: string | null;
  order_items?: OrderItem[];
};

function KitchenPageContent() {
  const searchParams = useSearchParams();
  const restaurantId = Number(searchParams.get("id"));

  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
useEffect(() => {
  if (!restaurantId) return;

  localStorage.setItem("lastRestaurantId", String(restaurantId));
  localStorage.setItem("lastPanel", "kitchen");
}, [restaurantId]);
  const [showSplash, setShowSplash] = useState(true);

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousPendingCountRef = useRef(0);
  const hasFetchedOnceRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

    const savedSound = localStorage.getItem(
      `kitchen_sound_enabled_${restaurantId}`
    );
    if (savedSound === "true") {
      setSoundEnabled(true);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchRestaurant();
  }, [restaurantId]);

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
      .select("kitchen_password")
      .eq("id", restaurantId)
      .single();

    if (error || !data) {
      alert("Error fetching password");
      return;
    }

    if (password === data.kitchen_password) {
      setUnlocked(true);
      localStorage.setItem(`kitchen_logged_in_${restaurantId}`, "true");
    } else {
      alert("Wrong password");
    }
  }

  function handleLogout() {
    if (restaurantId) {
      localStorage.removeItem(`kitchen_logged_in_${restaurantId}`);
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
      .in("status", ["pending", "preparing"])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (!error && data) {
      const normalized = (data as Order[]).map((order) => ({
        ...order,
        order_items: (order.order_items || []).filter(
          (item) => item.status !== "ready"
        ),
      }));

      const visibleOrders = normalized.filter(
        (order) => (order.order_items || []).length > 0
      );

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
    }
  }

  async function updateOrderStatusFromItems(orderId: number) {
    if (!restaurantId) return;

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("status")
      .eq("order_id", orderId);

    if (itemsError || !items) {
      alert("Failed to refresh item statuses");
      return;
    }

    const statuses = items.map((item) => item.status);

    let orderStatus: "pending" | "preparing" | "ready" = "pending";

    if (statuses.length > 0 && statuses.every((status) => status === "ready")) {
      orderStatus = "ready";
    } else if (
      statuses.some(
        (status) => status === "preparing" || status === "ready"
      )
    ) {
      orderStatus = "preparing";
    } else {
      orderStatus = "pending";
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({ status: orderStatus })
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId);

    if (orderError) {
      alert("Failed to update overall order status");
    }
  }

  async function updateItemStatus(
    orderId: number,
    itemId: number,
    status: "pending" | "preparing" | "ready"
  ) {
    const { error } = await supabase
      .from("order_items")
      .update({ status })
      .eq("id", itemId)
      .eq("order_id", orderId);

    if (error) {
      alert("Failed to update item status");
      return;
    }

    await updateOrderStatusFromItems(orderId);
    fetchOrders();
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

      setSoundEnabled(true);
      localStorage.setItem(`kitchen_sound_enabled_${restaurantId}`, "true");
      setMenuOpen(false);
      alert("Kitchen sound enabled");
    } catch {
      alert("Could not enable sound. Please tap again.");
    }
  }

  function disableSound() {
    if (!restaurantId) return;
    setSoundEnabled(false);
    localStorage.setItem(`kitchen_sound_enabled_${restaurantId}`, "false");
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!unlocked || !restaurantId) return;

    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 2000);

    return () => clearInterval(interval);
  }, [unlocked, soundEnabled, restaurantId]);

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
                  <p className="text-xs sm:text-sm text-white/80">
                    Kitchen Panel
                  </p>
                </div>
              </div>

              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold text-white active:scale-[0.97] select-none touch-manipulation"
                  aria-label="Open menu"
                >
                  ⋮
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
                    <button
                      onClick={soundEnabled ? disableSound : enableSound}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 active:scale-[0.99] select-none touch-manipulation"
                    >
                      <span className="text-base">
                        {soundEnabled ? "🔕" : "🔔"}
                      </span>
                      <span>
                        {soundEnabled ? "Disable Sound" : "Enable Sound"}
                      </span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 active:scale-[0.99] select-none touch-manipulation"
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
              <p className="text-sm sm:text-base md:text-lg text-slate-500">
                No active kitchen items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {orders.map((order) => {
                const isOldestPending = order.id === oldestPendingOrderId;

                return (
                  <div
                    key={order.id}
                    className={`rounded-[24px] border p-3 shadow-sm sm:p-4 md:p-4 lg:p-5 ${
                      isOldestPending
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

                          <p className="mt-1 text-xs sm:text-sm text-slate-500">
                            Order #{order.id}
                          </p>

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
                          order.order_items.map((item) => (
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
                                  onClick={() =>
                                    updateItemStatus(order.id, item.id, "pending")
                                  }
                                  className="min-h-[40px] rounded-xl bg-slate-600 px-2 py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-white active:scale-[0.98] select-none touch-manipulation"
                                >
                                  Pending
                                </button>

                                <button
                                  onClick={() =>
                                    updateItemStatus(order.id, item.id, "preparing")
                                  }
                                  className="min-h-[40px] rounded-xl bg-yellow-500 px-2 py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-white active:scale-[0.98] select-none touch-manipulation"
                                >
                                  Preparing
                                </button>

                                <button
                                  onClick={() =>
                                    updateItemStatus(order.id, item.id, "ready")
                                  }
                                  className="min-h-[40px] rounded-xl bg-green-600 px-2 py-2 text-[11px] sm:text-xs md:text-sm font-semibold text-white active:scale-[0.98] select-none touch-manipulation"
                                >
                                  Ready
                                </button>
                              </div>
                            </div>
                          ))
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