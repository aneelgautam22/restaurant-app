"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PanelType = "waiter" | "kitchen" | "owner" | "mini";
type AppType = "full" | "mini";

type RestaurantInfo = {
  id: number;
  name: string;
  app_type: AppType;
};

export default function LauncherPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState("");
  const [ready, setReady] = useState(false);
  const [loadingText, setLoadingText] = useState("Opening workspace...");
  const [checking, setChecking] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);

  useEffect(() => {
    async function restoreWorkspace() {
      const savedRestaurantId = localStorage.getItem("activeRestaurantId");
      const savedPanel = localStorage.getItem("activePanel") as PanelType | null;

      if (
        savedRestaurantId &&
        /^\d+$/.test(savedRestaurantId) &&
        savedPanel &&
        ["waiter", "kitchen", "owner", "mini"].includes(savedPanel)
      ) {
        setLoadingText("Opening saved workspace...");

        const restaurant = await getRestaurantInfo(savedRestaurantId);

        if (!restaurant) {
          clearSavedWorkspaceOnly();
          setReady(true);
          return;
        }

        if (restaurant.app_type === "mini") {
          localStorage.setItem("activePanel", "mini");
          router.replace(`/mini?id=${savedRestaurantId}`);
          return;
        }

        if (savedPanel === "waiter") {
          router.replace(`/waiter?id=${savedRestaurantId}`);
          return;
        }

        if (savedPanel === "kitchen") {
          router.replace(`/kitchen?id=${savedRestaurantId}`);
          return;
        }

        router.replace(`/owner?id=${savedRestaurantId}`);
        return;
      }

      setReady(true);
    }

    restoreWorkspace();
  }, [router]);

  async function getRestaurantInfo(id: string): Promise<RestaurantInfo | null> {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, app_type")
        .eq("id", Number(id))
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        app_type: data.app_type === "mini" ? "mini" : "full",
      };
    } catch {
      return null;
    }
  }

  async function checkRestaurant() {
    const cleanId = restaurantId.trim();

    if (!cleanId) {
      alert("Please enter restaurant ID");
      return;
    }

    if (!/^\d+$/.test(cleanId)) {
      alert("Please enter valid restaurant ID");
      return;
    }

    setChecking(true);
    setLoadingText("Checking restaurant...");

    const restaurant = await getRestaurantInfo(cleanId);

    setChecking(false);

    if (!restaurant) {
      alert("Restaurant not found");
      setRestaurantInfo(null);
      return;
    }

    setRestaurantInfo(restaurant);
  }

  function openMiniApp() {
    if (!restaurantInfo) return;

    localStorage.setItem("activeRestaurantId", String(restaurantInfo.id));
    localStorage.setItem("activePanel", "mini");
    router.replace(`/mini?id=${restaurantInfo.id}`);
  }

  function openFullPanel(panel: "waiter" | "kitchen" | "owner") {
    if (!restaurantInfo) return;

    localStorage.setItem("activeRestaurantId", String(restaurantInfo.id));
    localStorage.setItem("activePanel", panel);

    if (panel === "waiter") {
      router.replace(`/waiter?id=${restaurantInfo.id}`);
      return;
    }

    if (panel === "kitchen") {
      router.replace(`/kitchen?id=${restaurantInfo.id}`);
      return;
    }

    router.replace(`/owner?id=${restaurantInfo.id}`);
  }

  function changeRestaurant() {
    setRestaurantInfo(null);
  }

  function clearSavedWorkspaceOnly() {
    localStorage.removeItem("activeRestaurantId");
    localStorage.removeItem("activePanel");
  }

  function clearSavedWorkspace() {
    clearSavedWorkspaceOnly();
    setRestaurantId("");
    setRestaurantInfo(null);
    setReady(true);
    setChecking(false);
  }

  if (!ready || checking) {
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

            <p className="mt-3 text-sm text-gray-400">{loadingText}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-black shadow-[0_12px_40px_0_rgba(239,68,68,0.35)] ring-1 ring-white/10">
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

          {!restaurantInfo ? (
            <>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <label className="mb-2 block text-sm font-semibold text-white">
                  Restaurant ID
                </label>

                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={restaurantId}
                  onChange={(e) =>
                    setRestaurantId(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter restaurant ID"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-gray-500"
                />

                <p className="mt-2 text-xs text-gray-400">
                  Example: 1, 2, 3, 4...
                </p>
              </div>

              <button
                type="button"
                onClick={checkRestaurant}
                className="mt-6 block w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
              >
                Continue
              </button>

              <button
                type="button"
                onClick={clearSavedWorkspace}
                className="mt-4 text-xs text-gray-400 underline underline-offset-4"
              >
                Reset saved workspace
              </button>
            </>
          ) : (
            <>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Restaurant Found
                </p>

                <h2 className="mt-2 text-xl font-bold text-white">
                  {restaurantInfo.name}
                </h2>

                <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <span className="text-sm text-gray-300">Restaurant ID</span>
                  <span className="text-sm font-semibold text-white">
                    {restaurantInfo.id}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <span className="text-sm text-gray-300">App Type</span>
                  <span className="text-sm font-semibold text-white uppercase">
                    {restaurantInfo.app_type}
                  </span>
                </div>
              </div>

              {restaurantInfo.app_type === "mini" ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                    <p className="text-sm font-semibold text-white">Mini App</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Single-device restaurant mode detected.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openMiniApp}
                    className="block w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Open Mini App
                  </button>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                    <p className="text-sm font-semibold text-white">
                      Choose Panel
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Full restaurant mode detected.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openFullPanel("waiter")}
                    className="block w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Open Waiter Panel
                  </button>

                  <button
                    type="button"
                    onClick={() => openFullPanel("kitchen")}
                    className="block w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Open Kitchen Panel
                  </button>

                  <button
                    type="button"
                    onClick={() => openFullPanel("owner")}
                    className="block w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Open Owner Panel
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={changeRestaurant}
                className="mt-4 text-xs text-gray-400 underline underline-offset-4"
              >
                Change restaurant ID
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}