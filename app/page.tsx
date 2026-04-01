"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRestaurant();
  }, []);

  async function fetchRestaurant() {
    const id =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id")
        : null;

    if (!id) {
      setRestaurantId(null);
      setRestaurantName("Restaurant");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (error || !data) {
      setRestaurantId(null);
      setRestaurantName("Restaurant");
      setLoading(false);
      return;
    }

    const restaurantData = data as Record<string, any>;

    setRestaurantId(String(restaurantData.id));
    setRestaurantName(
      restaurantData.name ||
        restaurantData.restaurant_name ||
        restaurantData.restaurant ||
        restaurantData.title ||
        "Restaurant"
    );

    setLoading(false);
  }

  function goTo(path: string) {
    if (!restaurantId) {
      alert("Invalid restaurant link. Please use correct URL.");
      return;
    }

    router.push(`${path}?id=${restaurantId}`);
  }

  function goToCreate() {
    router.push("/create");
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-6 shadow-lg text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
            {restaurantName.charAt(0).toUpperCase()}
          </div>

          <h1 className="text-xl font-bold">{restaurantName}</h1>
          <p className="text-sm opacity-90 mt-1">
            Restaurant Management System
          </p>
        </div>

        {!loading && !restaurantId && (
          <div className="bg-white shadow rounded-2xl p-4 text-center text-sm text-red-600 font-medium">
            Invalid restaurant link. Please use the correct URL.
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={goToCreate}
            className="w-full bg-green-600 text-white shadow rounded-2xl p-4 flex items-center justify-between hover:bg-green-700 transition"
          >
            <span className="font-semibold text-lg">➕ Create New Restaurant</span>
            <span>→</span>
          </button>

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

        {!loading && restaurantId && (
          <div className="text-center text-xs text-gray-500">
            Restaurant ID: {restaurantId}
          </div>
        )}
      </div>
    </main>
  );
}