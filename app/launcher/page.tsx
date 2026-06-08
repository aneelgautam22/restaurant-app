"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PanelChoice = "owner" | "staff" | null;

type RestaurantInfo = {
  id: number;
  name: string;
  setup_completed?: boolean | null;
};

type ServiceItem = {
  label: string;
  icon: "report" | "kot" | "stock" | "order" | "payment";
};

function ServiceIcon({ type }: { type: ServiceItem["icon"] }) {
  const common = "h-5 w-5 stroke-slate-800";

  if (type === "report") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} strokeWidth="1.8">
        <path d="M4 19V5" stroke="currentColor" strokeLinecap="round" />
        <path d="M4 19H20" stroke="currentColor" strokeLinecap="round" />
        <path d="M7 15L10 12L13 14L18 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 19V16" stroke="currentColor" strokeLinecap="round" />
        <path d="M12 19V15" stroke="currentColor" strokeLinecap="round" />
        <path d="M17 19V11" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "kot") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} strokeWidth="1.8">
        <path d="M7 3H17V21L15 20L13 21L11 20L9 21L7 20V3Z" stroke="currentColor" strokeLinejoin="round" />
        <path d="M10 8H14" stroke="currentColor" strokeLinecap="round" />
        <path d="M10 12H15" stroke="currentColor" strokeLinecap="round" />
        <path d="M10 16H13" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "stock") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} strokeWidth="1.8">
        <path d="M4 8L12 4L20 8L12 12L4 8Z" stroke="currentColor" strokeLinejoin="round" />
        <path d="M4 8V16L12 20L20 16V8" stroke="currentColor" strokeLinejoin="round" />
        <path d="M12 12V20" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "order") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} strokeWidth="1.8">
        <path d="M7 4H17L19 20H5L7 4Z" stroke="currentColor" strokeLinejoin="round" />
        <path d="M9 8C9 9.7 10.3 11 12 11C13.7 11 15 9.7 15 8" stroke="currentColor" strokeLinecap="round" />
        <path d="M9 15H15" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={common} strokeWidth="1.8">
      <path d="M4 7H20V17H4V7Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M4 10H20" stroke="currentColor" strokeLinecap="round" />
      <path d="M8 15H11" stroke="currentColor" strokeLinecap="round" />
      <path d="M15 15H17" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function LauncherLoading() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <div className="mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center px-7">
        <img
          src="/logo.png"
          alt="ServeX Logo"
          className="h-16 w-16 rounded-2xl object-cover shadow-[0_12px_30px_rgba(220,38,38,0.25)]"
        />
        <p className="mt-4 text-sm font-bold text-slate-500">
          Loading ServeX...
        </p>
      </div>
    </main>
  );
}

function LauncherContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const idFromUrl = searchParams.get("id") || "";

  const [mounted, setMounted] = useState(false);
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<PanelChoice>(null);
  const [password, setPassword] = useState("");
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [booting, setBooting] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  function getRestaurantCacheKey(id: string) {
    return `restaurantInfo:${id}`;
  }

  function readCachedRestaurant(id: string): RestaurantInfo | null {
    if (typeof window === "undefined") return null;

    try {
      const cached = localStorage.getItem(getRestaurantCacheKey(id));
      if (!cached) return null;

      const parsed = JSON.parse(cached) as RestaurantInfo;

      if (!parsed?.id || !parsed?.name) {
        localStorage.removeItem(getRestaurantCacheKey(id));
        return null;
      }

      return parsed;
    } catch {
      localStorage.removeItem(getRestaurantCacheKey(id));
      return null;
    }
  }

  function saveCachedRestaurant(restaurant: RestaurantInfo) {
    if (typeof window === "undefined") return;

    localStorage.setItem(
      getRestaurantCacheKey(String(restaurant.id)),
      JSON.stringify(restaurant)
    );
  }

  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem("restrofy_device_id");

    if (!deviceId) {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        deviceId = crypto.randomUUID();
      } else {
        deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      }

      localStorage.setItem("restrofy_device_id", deviceId);
    }

    return deviceId;
  }

  async function getRestaurantInfo(id: string): Promise<RestaurantInfo | null> {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, setup_completed")
      .eq("id", Number(id))
      .single();

    if (error || !data) return null;

    return data as RestaurantInfo;
  }

  async function checkRestaurantById(id: string) {
    const cached = readCachedRestaurant(id);

    if (cached) {
      setRestaurantInfo(cached);
      setChecking(false);
    } else {
      setChecking(true);
    }

    const restaurant = await getRestaurantInfo(id);

    setChecking(false);

    if (!restaurant) {
      localStorage.removeItem(getRestaurantCacheKey(id));
      setRestaurantInfo(null);
      alert("Restaurant not found");
      return;
    }

    saveCachedRestaurant(restaurant);
    setRestaurantInfo(restaurant);
  }

  async function checkRestaurant() {
    const cleanId = restaurantId.trim();

    if (!cleanId || !/^\d+$/.test(cleanId)) {
      alert("Please enter valid restaurant ID");
      return;
    }

    await checkRestaurantById(cleanId);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!idFromUrl || !/^\d+$/.test(idFromUrl)) {
      setRestaurantId("");
      setBooting(false);
      return;
    }

    setRestaurantId(idFromUrl);

    const ownerToken = localStorage.getItem(`trustedDeviceToken:${idFromUrl}:owner`);
    const staffToken = localStorage.getItem(`trustedDeviceToken:${idFromUrl}:staff`);
    const activePanel = localStorage.getItem("activePanel");

    if (activePanel === "owner" && ownerToken) {
      router.replace(`/mini?id=${idFromUrl}&device=${encodeURIComponent(ownerToken)}`);
      return;
    }

    if (activePanel === "staff" && staffToken) {
      router.replace(`/waiter?id=${idFromUrl}&device=${encodeURIComponent(staffToken)}`);
      return;
    }

    const cached = readCachedRestaurant(idFromUrl);

    if (cached) {
      setRestaurantInfo(cached);
      setChecking(false);
    }

    setBooting(false);
    checkRestaurantById(idFromUrl);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, idFromUrl, router]);

  async function loginToPanel() {
    if (!restaurantInfo || !selectedPanel) return;

    const cleanPassword = password.trim();
    const cleanDeviceName = deviceNameInput.trim();

    if (!cleanPassword) {
      setLoginError("Password required");
      return;
    }

    if (!cleanDeviceName) {
      setLoginError("Device name required");
      return;
    }

    if (!restaurantInfo.setup_completed) {
      setLoginError("Setup is not completed for this restaurant.");
      return;
    }

    setLoggingIn(true);
    setLoginError("");

    const { data, error } = await supabase.rpc("verify_restaurant_login", {
      p_restaurant_id: restaurantInfo.id,
      p_panel: selectedPanel,
      p_password: cleanPassword,
    });

    if (error) {
      setLoggingIn(false);
      setLoginError(error.message || "Login failed");
      return;
    }

    if (!data?.success) {
      setLoggingIn(false);
      setLoginError(data?.message || "Wrong password");
      return;
    }

    const deviceId = getOrCreateDeviceId();

    const { data: trustedDeviceData, error: trustedDeviceError } =
      await supabase.rpc("create_trusted_device", {
        p_restaurant_id: restaurantInfo.id,
        p_panel: selectedPanel,
        p_device_id: deviceId,
        p_device_name: cleanDeviceName,
      });

    setLoggingIn(false);

    if (trustedDeviceError) {
      setLoginError(trustedDeviceError.message || "Device login failed");
      return;
    }

    if (!trustedDeviceData?.success && !trustedDeviceData?.data?.success) {
      setLoginError(trustedDeviceData?.message || "Device login failed");
      return;
    }

    const deviceToken =
      trustedDeviceData?.device_token ||
      trustedDeviceData?.data?.device_token ||
      "";

    if (!deviceToken) {
      setLoginError("Device token missing");
      return;
    }

    saveCachedRestaurant(restaurantInfo);

    localStorage.setItem("activeRestaurantId", String(restaurantInfo.id));
    localStorage.setItem("activePanel", selectedPanel);
    localStorage.setItem(
      `trustedDeviceToken:${restaurantInfo.id}:${selectedPanel}`,
      deviceToken
    );

    if (selectedPanel === "owner") {
      router.replace(
        `/mini?id=${restaurantInfo.id}&device=${encodeURIComponent(deviceToken)}`
      );
      return;
    }

    router.replace(
      `/waiter?id=${restaurantInfo.id}&device=${encodeURIComponent(deviceToken)}`
    );
  }

  function choosePanel(panel: PanelChoice) {
    setSelectedPanel(panel);
    setPassword("");
    setDeviceNameInput("");
    setLoginError("");
  }

  const restaurantWords = restaurantInfo?.name?.split(" ") || [];

  const services: ServiceItem[] = [
    { icon: "report", label: "Reports" },
    { icon: "kot", label: "KOT" },
    { icon: "stock", label: "Stock" },
    { icon: "order", label: "Orders" },
    { icon: "payment", label: "Payment" },
  ];

  if (!mounted || booting) {
    return <LauncherLoading />;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <div className="mx-auto flex h-screen w-full max-w-md flex-col px-7 pb-5 pt-5 md:pt-3">
        <section className="shrink-0 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.35)]">
            <img
              src="/logo.png"
              alt="ServeX Logo"
              className="mx-auto h-14 w-14 rounded-2xl object-cover shadow-[0_12px_30px_rgba(220,38,38,0.25)]"
            />
          </div>

          <h1 className="mt-2 text-5xl font-black tracking-tight text-slate-950 md:text-4xl">
            Serve
            <span className="ml-[2px] inline-block text-[3.65rem] leading-none text-red-600 md:text-[3rem]">
              X
            </span>
          </h1>

         <p className="mt-3 text-lg font-semibold text-slate-500 md:mt-2 md:text-base">
  Modern Restaurant{" "}
  <span className="font-bold text-red-600">
    POS
  </span>
</p>

          <div className="mt-4 flex justify-center md:mt-1">
            <img
              src="/launcher-preview.png"
              alt="ServeX Preview"
              className="w-full max-w-[320px] object-contain md:max-w-[250px]"
            />
          </div>

          <div className="mx-auto mt-2 grid max-w-[280px] grid-cols-5 gap-2 md:mt-1 md:max-w-[250px]">
            {services.map((service) => (
              <div
                key={service.label}
                className="flex min-h-[50px] flex-col items-center justify-center rounded-xl bg-white px-1 py-1.5 shadow-[0_8px_16px_rgba(15,23,42,0.10)] ring-1 ring-slate-100 md:min-h-[44px] md:py-1"
              >
                <ServiceIcon type={service.icon} />
                <p className="mt-1 text-[9px] font-extrabold leading-none text-slate-800 md:text-[8px]">
                  {service.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 flex-1 md:mt-2">
          {checking && !restaurantInfo ? (
            <p className="text-center text-sm font-semibold text-slate-500">
              Checking restaurant...
            </p>
          ) : !restaurantInfo ? (
            <div>
              <label className="mb-2 block text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">
                Restaurant ID
              </label>

              <input
                type="tel"
                inputMode="numeric"
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter restaurant ID"
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-base font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-red-500"
              />

              <button
                type="button"
                onClick={checkRestaurant}
                className="mt-3 block w-full rounded-2xl bg-red-600 px-5 py-3 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(220,38,38,0.20)]"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-3xl font-black tracking-tight leading-tight md:text-2xl">
                <span className="text-slate-950">{restaurantWords[0]}</span>{" "}
                <span className="text-red-600">
                  {restaurantWords.slice(1).join(" ")}
                </span>
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Choose your panel to continue
              </p>

              {!selectedPanel ? (
                <div className="mt-4 space-y-3 md:mt-3 md:space-y-2">
                  <button
                    type="button"
                    onClick={() => choosePanel("owner")}
                    className="block w-full rounded-2xl bg-slate-950 px-5 py-3 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] md:py-2.5"
                  >
                    Owner Panel
                  </button>

                  <button
                    type="button"
                    onClick={() => choosePanel("staff")}
                    className="block w-full rounded-2xl bg-red-600 px-5 py-3 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(220,38,38,0.20)] md:py-2.5"
                  >
                    Staff Panel
                  </button>
                </div>
              ) : (
                <div className="mt-5 text-left md:mt-3">
                  <p className="text-center text-base font-extrabold text-slate-950">
                    {selectedPanel === "owner" ? "Owner Login" : "Staff Login"}
                  </p>

                  <input
                    type="text"
                    value={deviceNameInput}
                    onChange={(e) => {
                      setDeviceNameInput(e.target.value);
                      setLoginError("");
                    }}
                    placeholder="Device name e.g. Owner Laptop"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-red-500 md:py-2.5"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLoginError("");
                    }}
                    placeholder="Enter password"
                    className="mt-2.5 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-red-500 md:py-2.5"
                  />

                  {loginError && (
                    <p className="mt-2 text-sm font-bold text-red-600">
                      {loginError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={loginToPanel}
                    disabled={loggingIn}
                    className="mt-3 block w-full rounded-2xl bg-red-600 px-5 py-3 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(220,38,38,0.20)] disabled:cursor-not-allowed disabled:opacity-60 md:py-2.5"
                  >
                    {loggingIn ? "Logging in..." : "Login"}
                  </button>

                  <button
                    type="button"
                    onClick={() => choosePanel(null)}
                    className="mt-3 block w-full text-center text-sm font-bold text-slate-500 underline underline-offset-4"
                  >
                    Back
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function LauncherPage() {
  return (
    <Suspense fallback={<LauncherLoading />}>
      <LauncherContent />
    </Suspense>
  );
}