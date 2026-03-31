"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const RESTAURANT_ID =
  typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("id") || 1)
    : 1;

type OrderItem = {
  id: number;
  item_name: string;
  quantity: number;
};

type Order = {
  id: number;
  table_number: string;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastOrderIdRef = useRef<number | null>(null);

  // 🔐 password check
  async function handleUnlock() {
    const { data } = await supabase
      .from("restaurants")
      .select("kitchen_password")
      .eq("id", RESTAURANT_ID)
      .single();

    if (!data) {
      alert("Error fetching password");
      return;
    }

    if (password === data.kitchen_password) {
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
      .in("status", ["pending", "preparing"])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (!error && data) {
      const newestOrderId = data[0]?.id ?? null;

      if (
        soundEnabled &&
        lastOrderIdRef.current !== null &&
        newestOrderId !== null &&
        newestOrderId > lastOrderIdRef.current
      ) {
        audioRef.current?.play().catch(() => {});
      }

      lastOrderIdRef.current = newestOrderId;
      setOrders(data as Order[]);
    }
  }

  async function updateStatus(id: number, status: "pending" | "preparing" | "ready") {
    await supabase.from("orders").update({ status }).eq("id", id);
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
  }, [soundEnabled, unlocked]);

  // 🔐 LOGIN SCREEN
  if (!unlocked) {
    return (
      <main className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-md mx-auto bg-white p-6 rounded-2xl shadow space-y-4">
          <h1 className="text-2xl font-bold text-center">Kitchen Login</h1>

          <input
            type="password"
            placeholder="Enter kitchen password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-4 py-3"
          />

          <button
            onClick={handleUnlock}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold">Kitchen Screen</h1>

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
              <p className="text-gray-500 text-lg">No active kitchen orders.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl shadow p-5 space-y-4 border">
                  <div className="flex justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">
                        Table {order.table_number}
                      </h2>
                      <p className="text-sm text-gray-500">Order #{order.id}</p>
                    </div>

                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-100">
                      {order.status}
                    </span>
                  </div>

                  <div>
                    {order.order_items?.map((item) => (
                      <p key={item.id}>
                        {item.item_name} x {item.quantity}
                      </p>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => updateStatus(order.id, "pending")} className="bg-gray-600 text-white py-2 rounded">
                      Pending
                    </button>

                    <button onClick={() => updateStatus(order.id, "preparing")} className="bg-yellow-500 text-white py-2 rounded">
                      Preparing
                    </button>

                    <button onClick={() => updateStatus(order.id, "ready")} className="bg-green-600 text-white py-2 rounded">
                      Ready
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}