"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("Restaurant");

  useEffect(() => {
    fetchRestaurant();
  }, []);

  async function fetchRestaurant() {
    const id =
      typeof window !== "undefined"
        ? Number(new URLSearchParams(window.location.search).get("id") || 1)
        : 1;

    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", id)
      .single();

    if (data) {
      setRestaurantName(
        data.name ||
          data.restaurant_name ||
          data.restaurant ||
          data.title ||
          "Restaurant"
      );
    }
  }

  function goTo(path: string) {
    const id =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id") || "1"
        : "1";

    router.push(`${path}?id=${id}`);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-6 shadow-lg text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
            {restaurantName.charAt(0).toUpperCase()}
          </div>

          <h1 className="text-xl font-bold">{restaurantName}</h1>
          <p className="text-sm opacity-90 mt-1">
            Restaurant Management System
          </p>
        </div>

        {/* BUTTONS */}
        <div className="space-y-4">

          <button
            onClick={() => goTo("/waiter")}
            className="w-full bg-white shadow rounded-2xl p-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <span className="font-semibold text-lg">👨‍🍳 Waiter Panel</span>
            <span>→</span>
          </button>

          <button
            onClick={() => goTo("/kitchen")}
            className="w-full bg-white shadow rounded-2xl p-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <span className="font-semibold text-lg">🍳 Kitchen Panel</span>
            <span>→</span>
          </button>

          <button
            onClick={() => goTo("/owner")}
            className="w-full bg-white shadow rounded-2xl p-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <span className="font-semibold text-lg">👑 Owner Panel</span>
            <span>→</span>
          </button>

        </div>

      </div>
    </main>
  );
}