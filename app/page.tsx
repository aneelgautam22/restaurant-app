"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Restaurant = {
  id: number;
  name: string;
  app_type: "full" | "mini" | null;
};

export default function HomePage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLastRestaurant = async () => {
      try {
        const lastRestaurantId = localStorage.getItem("lastRestaurantId");
        const lastPanel = localStorage.getItem("lastPanel");

        if (!lastRestaurantId) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name, app_type")
          .eq("id", Number(lastRestaurantId))
          .single();

        if (error || !data) {
          setLoading(false);
          return;
        }

        setRestaurant(data);

        if (data.app_type === "mini") {
          router.replace(`/mini?id=${data.id}`);
          return;
        }

        if (lastPanel === "kitchen") {
          router.replace(`/kitchen?id=${data.id}`);
          return;
        }

        if (lastPanel === "owner") {
          router.replace(`/owner?id=${data.id}`);
          return;
        }

        router.replace(`/waiter?id=${data.id}`);
      } catch (error) {
        console.error("Failed to load restaurant:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLastRestaurant();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-black shadow-[0_12px_40px_rgba(239,68,68,0.35)] ring-1 ring-white/10">
            <img
              src="/logo.png"
              alt="Restrofy Logo"
              className="h-16 w-16 object-contain"
            />
          </div>
          <h1 className="mt-5 text-4xl font-extrabold tracking-wide">
            Restrofy
          </h1>
          <p className="mt-3 text-sm text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-black shadow-[0_12px_40px_rgba(239,68,68,0.35)] ring-1 ring-white/10">
            <img
              src="/logo.png"
              alt="Restrofy Logo"
              className="h-16 w-16 object-contain"
            />
          </div>

          <h1 className="mt-5 text-4xl font-extrabold tracking-wide">
            Restrofy
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Smart Restaurant Management
          </p>

          <div className="mt-6 space-y-3">
            <Link
              href="/create"
              className="block rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Create Restaurant
            </Link>

            <Link
              href="/mini?id=1"
              className="block rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Mini Demo
            </Link>

            <Link
              href="/waiter?id=1"
              className="block rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Full Demo Waiter
            </Link>

            <Link
              href="/kitchen?id=1"
              className="block rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Full Demo Kitchen
            </Link>

            <Link
              href="/owner?id=1"
              className="block rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Full Demo Owner
            </Link>
          </div>

          {restaurant && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Last Restaurant
              </p>
              <p className="mt-2 text-base font-semibold text-white">
                {restaurant.name}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Type: {restaurant.app_type || "full"}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}