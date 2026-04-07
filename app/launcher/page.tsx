"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LauncherPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedRestaurantId = localStorage.getItem("activeRestaurantId");
    const savedPanel = localStorage.getItem("activePanel");

    if (
      savedRestaurantId &&
      /^\d+$/.test(savedRestaurantId) &&
      (savedPanel === "waiter" ||
        savedPanel === "kitchen" ||
        savedPanel === "owner")
    ) {
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
  }, [router]);

  function openPanel(panel: "waiter" | "kitchen" | "owner") {
    const cleanId = restaurantId.trim();

    if (!cleanId) {
      alert("Please enter restaurant ID");
      return;
    }

    if (!/^\d+$/.test(cleanId)) {
      alert("Please enter valid restaurant ID");
      return;
    }

    localStorage.setItem("activeRestaurantId", cleanId);
    localStorage.setItem("activePanel", panel);

if (panel === "waiter") {
  router.replace(`/waiter?id=${cleanId}`);
  return;
}
if (panel === "kitchen") {
  router.replace(`/kitchen?id=${cleanId}`);
  return;
}

router.replace(`/owner?id=${cleanId}`);
  }

  function clearSavedWorkspace() {
    localStorage.removeItem("activeRestaurantId");
    localStorage.removeItem("activePanel");
    setRestaurantId("");
    setReady(true);
  }

  if (!ready) {
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

            <p className="mt-3 text-sm text-gray-400">Opening workspace...</p>
          </div>
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

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
            <label className="block text-sm font-semibold text-white mb-2">
              Restaurant ID
            </label>

            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter restaurant ID"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-gray-500"
            />

            <p className="mt-2 text-xs text-gray-400">
              Example: 1, 2, 3, 4...
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => openPanel("waiter")}
              className="block w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Waiter Panel
            </button>

            <button
              type="button"
              onClick={() => openPanel("kitchen")}
              className="block w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Kitchen Panel
            </button>

            <button
              type="button"
              onClick={() => openPanel("owner")}
              className="block w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Owner Panel
            </button>
          </div>

          <button
            type="button"
            onClick={clearSavedWorkspace}
            className="mt-4 text-xs text-gray-400 underline underline-offset-4"
          >
            Reset saved workspace
          </button>
        </div>
      </div>
    </main>
  );
}