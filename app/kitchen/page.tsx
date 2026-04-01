"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const RESTAURANT_ID =
  typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("id") || 1)
    : 1;

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

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousPendingCountRef = useRef(0);
  const hasFetchedOnceRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLogin = localStorage.getItem(`kitchen_logged_in_${RESTAURANT_ID}`);
    if (savedLogin === "true") {
      setUnlocked(true);
    }

    const savedSound = localStorage.getItem(
      `kitchen_sound_enabled_${RESTAURANT_ID}`
    );
    if (savedSound === "true") {
      setSoundEnabled(true);
    }
  }, []);

  useEffect(() => {
    fetchRestaurant();
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
    }
  }

  async function handleUnlock() {
    const { data, error } = await supabase
      .from("restaurants")
      .select("kitchen_password")
      .eq("id", RESTAURANT_ID)
      .single();

    if (error || !data) {
      alert("Error fetching password");
      return;
    }

    if (password === data.kitchen_password) {
      setUnlocked(true);
      localStorage.setItem(`kitchen_logged_in_${RESTAURANT_ID}`, "true");
    } else {
      alert("Wrong password");
    }
  }

  function handleLogout() {
    localStorage.removeItem(`kitchen_logged_in_${RESTAURANT_ID}`);
    setUnlocked(false);
    setPassword("");
  }

  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", RESTAURANT_ID)
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
      .eq("restaurant_id", RESTAURANT_ID);

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
    try {
      if (audioRef.current) {
        audioRef.current.volume = 0;
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1;
      }

      setSoundEnabled(true);
      localStorage.setItem(`kitchen_sound_enabled_${RESTAURANT_ID}`, "true");
      alert("Kitchen sound enabled");
    } catch {
      alert("Could not enable sound. Please tap again.");
    }
  }

  useEffect(() => {
    if (!unlocked) return;

    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 2000);

    return () => clearInterval(interval);
  }, [unlocked, soundEnabled]);

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

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-md mx-auto bg-white p-6 rounded-3xl shadow space-y-4 border">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {restaurantName || "Restaurant"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Kitchen Panel Login</p>
          </div>

          <input
            type="password"
            placeholder="Enter kitchen password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-4 py-3"
          />

          <button
            onClick={handleUnlock}
            className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold"
          >
            Enter
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <audio ref={audioRef} src="/bell.mp3" preload="auto" />

      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg font-bold shrink-0">
                {restaurantName ? restaurantName.charAt(0).toUpperCase() : "R"}
              </div>

              <h1 className="text-lg font-bold text-center flex-1 mx-2 truncate">
                {restaurantName || "Restaurant"}
              </h1>

              <button
                onClick={handleLogout}
                className="bg-white text-red-600 px-3 py-1.5 rounded-full text-xs font-semibold shadow shrink-0"
              >
                Logout
              </button>
            </div>

            <div className="flex justify-center">
              <div className="px-4 py-1.5 rounded-full bg-white/20 text-sm font-semibold">
                Kitchen Panel
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={enableSound}
              className={`px-5 py-3 rounded-2xl font-semibold text-white ${
                soundEnabled ? "bg-green-600" : "bg-blue-600"
              }`}
            >
              {soundEnabled ? "🔔 Sound Enabled" : "🔔 Enable Sound"}
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500 text-lg">
                No active kitchen items.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {orders.map((order) => {
                const isOldestPending = order.id === oldestPendingOrderId;

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl shadow p-5 space-y-4 border ${
                      isOldestPending
                        ? "bg-red-50 border-2 border-red-400"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        {isOldestPending && (
                          <div className="mb-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white">
                              🔥 Oldest Pending
                            </span>
                          </div>
                        )}

                        <h2 className="text-2xl font-bold">
                          Table {order.table_number}
                        </h2>
                        <p className="text-sm text-gray-500">Order #{order.id}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold h-fit capitalize ${
                          order.status === "preparing"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    {order.remarks && (
                      <div className="border border-orange-200 rounded-2xl p-3 bg-orange-50">
                        <p className="text-xs font-semibold text-orange-700 mb-1">
                          Customer Remarks
                        </p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {order.remarks}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {order.order_items?.length ? (
                        order.order_items.map((item) => (
                          <div
                            key={item.id}
                            className="border rounded-2xl p-3 bg-gray-50 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold">{item.item_name}</p>
                                <p className="text-sm text-gray-500">
                                  Qty: {item.quantity}
                                </p>
                              </div>

                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                                  item.status === "ready"
                                    ? "bg-green-100 text-green-700"
                                    : item.status === "preparing"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-200 text-gray-700"
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
                                className="bg-gray-600 text-white py-2 rounded-xl text-sm font-medium"
                              >
                                Pending
                              </button>

                              <button
                                onClick={() =>
                                  updateItemStatus(order.id, item.id, "preparing")
                                }
                                className="bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium"
                              >
                                Preparing
                              </button>

                              <button
                                onClick={() =>
                                  updateItemStatus(order.id, item.id, "ready")
                                }
                                className="bg-green-600 text-white py-2 rounded-xl text-sm font-medium"
                              >
                                Ready
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No items</p>
                      )}
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