"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QRCodeCanvas } from "qrcode.react";

const CREATE_ADMIN_ACCESS_KEY = "create_admin_access";

export default function CreateRestaurant() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState<"full" | "mini">("full");
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const [adminIdInput, setAdminIdInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);

  const ownerQrRef = useRef<HTMLDivElement | null>(null);
  const waiterQrRef = useRef<HTMLDivElement | null>(null);
  const kitchenQrRef = useRef<HTMLDivElement | null>(null);
  const miniQrRef = useRef<HTMLDivElement | null>(null);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const adminIdFromEnv =
  process.env.NEXT_PUBLIC_CREATE_ADMIN_ID;

const adminPasswordFromEnv =
  process.env.NEXT_PUBLIC_CREATE_ADMIN_PASSWORD;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedAccess = localStorage.getItem(CREATE_ADMIN_ACCESS_KEY);
    if (savedAccess === "true") {
      setAdminUnlocked(true);
    }
  }, []);

  function unlockCreatePage(e: React.FormEvent) {
    e.preventDefault();

    if (!adminIdInput.trim()) {
      alert("Enter admin ID");
      return;
    }

    if (!adminPasswordInput.trim()) {
      alert("Enter admin password");
      return;
    }

    setAdminChecking(true);

    const cleanId = adminIdInput.trim();
    const cleanPassword = adminPasswordInput.trim();

    if (
      cleanId === adminIdFromEnv &&
      cleanPassword === adminPasswordFromEnv
    ) {
      setAdminUnlocked(true);
      setAdminIdInput("");
      setAdminPasswordInput("");
      localStorage.setItem(CREATE_ADMIN_ACCESS_KEY, "true");
      setAdminChecking(false);
      return;
    }

    setAdminChecking(false);
    alert("Wrong admin ID or password");
  }

  function logoutCreateAdmin() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CREATE_ADMIN_ACCESS_KEY);
    }

    setAdminUnlocked(false);
    setAdminIdInput("");
    setAdminPasswordInput("");
    setCreatedId(null);
    setName("");
    setType("full");
  }

  async function handleCreate() {
    if (!name.trim()) {
      alert("Enter restaurant name");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("restaurants")
      .insert([
        {
          name: name.trim(),
          owner_password: "setup_pending",
          waiter_password: type === "full" ? "setup_pending" : null,
          kitchen_password: type === "full" ? "setup_pending" : null,
          app_type: type,
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error || !data) {
      alert(`Error: ${error?.message || "Failed to create restaurant"}`);
      return;
    }

    setCreatedId(data.id);
    localStorage.setItem("lastRestaurantId", String(data.id));
    localStorage.setItem("lastPanel", type === "mini" ? "mini" : "owner");
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      alert("Link copied");
    } catch {
      alert("Failed to copy link");
    }
  }

  function downloadQr(
    wrapperRef: React.RefObject<HTMLDivElement | null>,
    fileName: string
  ) {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) {
      alert("QR not found");
      return;
    }

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }

  const ownerLink = createdId ? `${baseUrl}/owner?id=${createdId}` : "";
  const waiterLink = createdId ? `${baseUrl}/waiter?id=${createdId}` : "";
  const kitchenLink = createdId ? `${baseUrl}/kitchen?id=${createdId}` : "";
  const miniLink = createdId ? `${baseUrl}/mini?id=${createdId}` : "";

  if (showSplash) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_35%,_#020617_100%)] flex items-center justify-center px-4">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Restrofy Logo"
            className="w-24 h-24 mx-auto rounded-[28px] object-cover shadow-[0_18px_45px_rgba(239,68,68,0.35)] border border-white/10"
          />

          <h1 className="mt-5 text-4xl font-extrabold tracking-wide text-white">
            Restrofy
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            Smart Restaurant Management
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-white/80 animate-pulse [animation-delay:200ms]"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-white/60 animate-pulse [animation-delay:400ms]"></span>
          </div>
        </div>
      </main>
    );
  }

  if (!adminUnlocked) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_35%,_#020617_100%)] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <img
              src="/logo.png"
              alt="Restrofy Logo"
              className="w-20 h-20 mx-auto rounded-[28px] object-cover shadow-[0_18px_45px_rgba(239,68,68,0.35)] border border-white/10"
            />

            <h1 className="mt-5 text-4xl font-extrabold tracking-wide text-white">
              Restrofy
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              Admin access required
            </p>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/95 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.35)] p-6 sm:p-8">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 border border-red-100">
                Admin Login
              </div>

              <h2 className="mt-4 text-2xl font-bold text-slate-900">
                Unlock Create Page
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Only admin can create restaurant workspaces
              </p>
            </div>

            <form onSubmit={unlockCreatePage} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Admin ID
                </label>

                <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-100">
                  <span className="mr-3 text-lg">🪪</span>
                  <input
                    type="text"
                    placeholder="Enter admin ID"
                    value={adminIdInput}
                    onChange={(e) => setAdminIdInput(e.target.value)}
                    className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Admin Password
                </label>

                <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-100">
                  <span className="mr-3 text-lg">🔐</span>
                  <input
                    type="password"
                    placeholder="Enter admin password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={adminChecking}
                className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-4 py-3.5 text-white font-semibold shadow-[0_14px_30px_rgba(239,68,68,0.35)] hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {adminChecking ? "Checking..." : "Login to Continue"}
              </button>
            </form>

            <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs leading-5 text-slate-500 text-center">
                This page is protected so only you can create new restaurant
                accounts.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_35%,_#020617_100%)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center relative">
          <img
            src="/logo.png"
            alt="Restrofy Logo"
            className="w-20 h-20 mx-auto rounded-[28px] object-cover shadow-[0_18px_45px_rgba(239,68,68,0.35)] border border-white/10"
          />

          <h1 className="mt-5 text-4xl font-extrabold tracking-wide text-white">
            Restrofy
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            Create your restaurant workspace and start managing smarter
          </p>

          <button
            type="button"
            onClick={logoutCreateAdmin}
            className="mt-4 inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white border border-white/10"
          >
            Logout Admin
          </button>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/95 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.35)] p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 border border-red-100">
              Restaurant Setup
            </div>

            <h2 className="mt-4 text-2xl font-bold text-slate-900">
              Create Restaurant Account
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Set up your restaurant and continue to your management panels
            </p>
          </div>

          {!createdId ? (
            <>
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Restaurant Name
                  </label>

                  <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-red-400 focus-within:ring-4 focus-within:ring-red-100">
                    <span className="mr-3 text-lg">🏪</span>
                    <input
                      type="text"
                      placeholder="Enter restaurant name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    App Type
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setType("full")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        type === "full"
                          ? "border-blue-500 bg-blue-500 text-white shadow-[0_10px_25px_rgba(59,130,246,0.28)]"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Full Panel
                    </button>

                    <button
                      type="button"
                      onClick={() => setType("mini")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        type === "mini"
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_10px_25px_rgba(16,185,129,0.28)]"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Mini App
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs leading-5 text-slate-500">
                      {type === "full"
                        ? "Full Panel is for bigger restaurants with separate Owner, Waiter and Kitchen panels."
                        : "Mini App is for smaller restaurants where everything can be managed from one device."}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-4 py-3.5 text-white font-semibold shadow-[0_14px_30px_rgba(239,68,68,0.35)] hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading
                    ? "Creating Restaurant..."
                    : type === "mini"
                    ? "Create Mini Restaurant"
                    : "Create Full Restaurant"}
                </button>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs leading-5 text-slate-500 text-center">
                  Your restaurant will be created first.{" "}
                  {type === "full"
                    ? "Owner, waiter and kitchen passwords can be set up later from your owner side."
                    : "Mini app access can be set up later from your owner side."}
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-sm font-semibold text-emerald-700">
                  Restaurant created successfully
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Restaurant ID: <span className="font-bold">{createdId}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-bold text-slate-900 text-center">
                  QR Access
                </h3>
                <p className="mt-1 text-xs text-center text-slate-500">
                  Scan, copy, or download these QR codes
                </p>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  {type === "full" && (
                    <>
                      <div className="rounded-2xl bg-white p-3 text-center border border-slate-200">
                        <div ref={ownerQrRef} className="flex justify-center">
                          <QRCodeCanvas value={ownerLink} size={120} />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-800">
                          Owner
                        </p>
                        <div className="mt-3 space-y-2">
                          <button
                            type="button"
                            onClick={() => copyLink(ownerLink)}
                            className="w-full rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white"
                          >
                            Copy Link
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadQr(ownerQrRef, `owner-qr-${createdId}.png`)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700"
                          >
                            Download QR
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-3 text-center border border-slate-200">
                        <div ref={waiterQrRef} className="flex justify-center">
                          <QRCodeCanvas value={waiterLink} size={120} />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-800">
                          Waiter
                        </p>
                        <div className="mt-3 space-y-2">
                          <button
                            type="button"
                            onClick={() => copyLink(waiterLink)}
                            className="w-full rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white"
                          >
                            Copy Link
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadQr(waiterQrRef, `waiter-qr-${createdId}.png`)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700"
                          >
                            Download QR
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-3 text-center border border-slate-200 col-span-2">
                        <div ref={kitchenQrRef} className="flex justify-center">
                          <QRCodeCanvas value={kitchenLink} size={120} />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-800">
                          Kitchen
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => copyLink(kitchenLink)}
                            className="w-full rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white"
                          >
                            Copy Link
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadQr(kitchenQrRef, `kitchen-qr-${createdId}.png`)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700"
                          >
                            Download QR
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {type === "mini" && (
                    <div className="rounded-2xl bg-white p-3 text-center border border-slate-200 col-span-2">
                      <div ref={miniQrRef} className="flex justify-center">
                        <QRCodeCanvas value={miniLink} size={120} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-800">
                        Mini App
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => copyLink(miniLink)}
                          className="w-full rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white"
                        >
                          Copy Link
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadQr(miniQrRef, `mini-qr-${createdId}.png`)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700"
                        >
                          Download QR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {type === "full" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push(`/owner?id=${createdId}`)}
                      className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(59,130,246,0.28)]"
                    >
                      Open Owner Panel
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push(`/waiter?id=${createdId}`)}
                      className="w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(239,68,68,0.28)]"
                    >
                      Open Waiter Panel
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push(`/kitchen?id=${createdId}`)}
                      className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(249,115,22,0.28)]"
                    >
                      Open Kitchen Panel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/mini?id=${createdId}`)}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(16,185,129,0.28)]"
                  >
                    Open Mini App
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCreatedId(null);
                    setName("");
                    setType("full");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Create Another Restaurant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}