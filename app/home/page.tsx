"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppSplash from "@/components/AppSplash";

type PanelItem = {
  title: string;
  subtitle: string;
  icon: string;
  active: boolean;
  iconBg: string;
};

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const restaurantId = searchParams.get("id");

  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchRestaurant();
  }, [restaurantId]);

  async function fetchRestaurant() {
    if (!restaurantId) {
      setRestaurantName("Restaurant");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", Number(restaurantId))
      .single();

    if (error || !data) {
      setRestaurantName("Restaurant");
      setLoading(false);
      return;
    }

    const restaurantData = data as Record<string, any>;

    setRestaurantName(
      restaurantData.name ||
        restaurantData.restaurant_name ||
        restaurantData.restaurant ||
        restaurantData.title ||
        "Restaurant"
    );

    setLoading(false);
  }

  function handlePanelClick(title: string) {
    if (title === "Create New Restaurant") {
      router.push("/create");
      return;
    }

    if (!restaurantId) {
      alert("Please create or select restaurant first");
      return;
    }

    if (title === "Waiter Panel") {
      router.push(`/waiter?id=${restaurantId}`);
      return;
    }

    if (title === "Kitchen Panel") {
      router.push(`/kitchen?id=${restaurantId}`);
      return;
    }

    if (title === "Owner Panel") {
      router.push(`/owner?id=${restaurantId}`);
    }
  }

  const panels: PanelItem[] = [
    {
      title: "Create New Restaurant",
      subtitle: "Start a fresh restaurant workspace",
      icon: "+",
      active: true,
      iconBg: "bg-white/15",
    },
    {
      title: "Waiter Panel",
      subtitle: "Take orders and track status",
      icon: "🧑‍🍳",
      active: false,
      iconBg: "bg-amber-100",
    },
    {
      title: "Kitchen Panel",
      subtitle: "Manage preparation and ready items",
      icon: "🍳",
      active: false,
      iconBg: "bg-violet-100",
    },
    {
      title: "Owner Panel",
      subtitle: "View reports, billing, and control",
      icon: "👑",
      active: false,
      iconBg: "bg-rose-100",
    },
  ];

  if (showSplash) {
    return <AppSplash subtitle="Opening Workspace..." />;
  }

  return (
    <main className="h-[100dvh] overflow-hidden w-full bg-[radial-gradient(circle_at_top,_#19335d_0%,_#08142f_45%,_#030814_100%)] text-white flex items-start justify-center px-3 pt-3 pb-2">
      <div className="w-full max-w-md">
        <div className="text-center mb-3">
          <div className="mx-auto mb-3 h-20 w-20 rounded-[22px] overflow-hidden shadow-[0_18px_45px_rgba(239,68,68,0.35)] ring-1 ring-white/15">
            <img
              src="/logo.png"
              alt="logo"
              className="h-full w-full object-cover"
            />
          </div>

          <p className="mt-2 text-sm font-bold tracking-[0.25em] uppercase">
            <span className="text-white/90">RESTRO</span>
            <span className="text-red-500">FY</span>
          </p>

          <h1 className="mt-2 text-[28px] leading-[1.05] font-bold tracking-tight">
            {loading ? (
              "Loading..."
            ) : (
              <>
                {restaurantName}{" "}
                <span className="text-red-400">Workspace</span>
              </>
            )}
          </h1>

          <p className="mt-2 text-[12px] text-slate-300 max-w-sm mx-auto leading-5 px-4">
            {restaurantId
              ? "Your restaurant is ready. Open waiter, kitchen, or owner panel instantly."
              : "Create your restaurant first, then jump into waiter, kitchen, or owner panels instantly."}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/10 backdrop-blur-2xl shadow-[0_14px_40px_rgba(0,0,0,0.32)] p-2.5">
          <div className="rounded-[20px] bg-white/82 text-slate-900 p-2.5 shadow-inner border border-white/70">
            <div className="mb-2.5 rounded-[18px] bg-slate-100/90 border border-slate-200 p-3">
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-slate-500">
                Quick Access
              </p>
              <p className="mt-1 text-[15px] font-semibold text-slate-800">
                Open the panel you need
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">
                Start a new restaurant or continue from your existing workspace.
              </p>
            </div>

            <div className="space-y-2">
              {panels.map((panel) => (
                <button
                  key={panel.title}
                  type="button"
                  onClick={() => handlePanelClick(panel.title)}
                  className={[
                    "group w-full rounded-[18px] border px-3 py-3 text-left transition-all duration-200 active:scale-[0.98]",
                    panel.active
                      ? "border-emerald-400/30 bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-[0_10px_22px_rgba(16,185,129,0.28)]"
                      : "border-slate-200 bg-white text-slate-900 shadow-sm",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold",
                        panel.active
                          ? "bg-white/15 text-white"
                          : `${panel.iconBg} text-slate-800`,
                      ].join(" ")}
                    >
                      {panel.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-bold leading-tight">
                        {panel.title}
                      </div>
                      <div
                        className={[
                          "mt-0.5 text-[12px] leading-5",
                          panel.active ? "text-white/85" : "text-slate-500",
                        ].join(" ")}
                      >
                        {panel.subtitle}
                      </div>
                    </div>

                    <div
                      className={[
                        "flex h-9 w-9 items-center justify-center rounded-full text-base",
                        panel.active
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      →
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-2.5 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[12px] text-slate-500">
              {restaurantId ? (
                <>
                  Active Restaurant ID:{" "}
                  <span className="font-bold text-slate-700">
                    {restaurantId}
                  </span>
                </>
              ) : (
                "No active restaurant selected yet"
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<AppSplash subtitle="Opening Workspace..." />}>
      <HomePageContent />
    </Suspense>
  );
}