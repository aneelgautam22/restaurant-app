"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QRCodeCanvas } from "qrcode.react";

const CREATE_ADMIN_ACCESS_KEY = "create_admin_access";

function ServeXBrand() {
  return (
    <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950">
      Serve
      <span className="ml-[2px] inline-block text-[3.65rem] leading-none text-red-600">
        X
      </span>
    </h1>
  );
}

export default function CreateRestaurant() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const [adminIdInput, setAdminIdInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);

  const appQrRef = useRef<HTMLDivElement | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const adminIdFromEnv = process.env.NEXT_PUBLIC_CREATE_ADMIN_ID || "admin";
  const adminPasswordFromEnv =
    process.env.NEXT_PUBLIC_CREATE_ADMIN_PASSWORD || "Piano@12";

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 900);

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

    if (cleanId === adminIdFromEnv && cleanPassword === adminPasswordFromEnv) {
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
          waiter_password: "setup_pending",
          kitchen_password: null,
          app_type: "unified",
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
    localStorage.setItem("lastPanel", "owner");
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

  const appLink = createdId ? `${baseUrl}/mini?id=${createdId}` : "";

  if (showSplash) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="ServeX Logo"
            className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-[0_16px_45px_rgba(220,38,38,0.28)]"
          />

          <ServeXBrand />

          <p className="mt-3 text-sm font-bold text-slate-500">
            Modern Restaurant POS & Management System
          </p>
        </div>
      </main>
    );
  }

  if (!adminUnlocked) {
    return (
      <main className="min-h-screen bg-white text-slate-950">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-7 py-8">
          <section className="text-center">
            <img
              src="/logo.png"
              alt="ServeX Logo"
              className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-[0_16px_45px_rgba(220,38,38,0.28)]"
            />

            <ServeXBrand />

            <p className="mt-3 text-xl font-black leading-snug text-slate-950">
              Admin Access
              <br />
              <span className="text-red-600">Required</span>
            </p>
          </section>

          <section className="mt-8">
            <div className="mb-5 text-center">
              <p className="text-2xl font-black text-slate-950">
                Unlock Create Page
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Only admin can create restaurant workspaces
              </p>
            </div>

            <form onSubmit={unlockCreatePage} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
                  Admin ID
                </label>

                <input
                  type="text"
                  placeholder="Enter admin ID"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
                  Admin Password
                </label>

                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={adminChecking}
                className="block w-full rounded-[22px] bg-red-600 px-5 py-4 text-base font-black text-white shadow-[0_14px_32px_rgba(220,38,38,0.25)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adminChecking ? "Checking..." : "Login to Continue"}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-7 py-8">
        <section className="text-center">
          <img
            src="/logo.png"
            alt="ServeX Logo"
            className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-[0_16px_45px_rgba(220,38,38,0.28)]"
          />

          <ServeXBrand />

          <p className="mt-3 text-xl font-black leading-snug text-slate-950">
            Create Restaurant
            <br />
            <span className="text-red-600">Workspace</span>
          </p>

          <button
            type="button"
            onClick={logoutCreateAdmin}
            className="mt-4 rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-black text-slate-600 shadow-sm"
          >
            Logout Admin
          </button>
        </section>

        <section className="mt-8 flex-1">
          {!createdId ? (
            <>
              <div className="text-center">
                <h2 className="text-3xl font-black tracking-tight text-slate-950">
                  Restaurant Setup
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  One unified app for owner and staff access
                </p>
              </div>

              <div className="mt-7 space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">
                    Restaurant Name
                  </label>

                  <input
                    type="text"
                    placeholder="Enter restaurant name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-red-500"
                  />
                </div>

                <div className="rounded-[22px] border border-slate-100 bg-slate-50 px-5 py-4">
                  <p className="text-center text-sm font-semibold leading-6 text-slate-500">
                    One app will be created. Owner and staff panel selection
                    will happen inside the app.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  className="block w-full rounded-[22px] bg-red-600 px-5 py-4 text-base font-black text-white shadow-[0_14px_32px_rgba(220,38,38,0.25)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creating Restaurant..." : "Create Restaurant"}
                </button>
              </div>

              <p className="mt-5 text-center text-xs font-semibold leading-5 text-slate-400">
                Password setup can be completed from the owner side after
                restaurant creation.
              </p>
            </>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-3xl font-black tracking-tight text-slate-950">
                  Created <span className="text-red-600">Successfully</span>
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Restaurant ID:{" "}
                  <span className="font-black text-slate-950">{createdId}</span>
                </p>
              </div>

              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-5 text-center">
                <h3 className="text-lg font-black text-slate-950">
                  QR Access
                </h3>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  One QR for the unified restaurant app
                </p>

                <div className="mt-5 rounded-[24px] bg-white p-5 shadow-sm">
                  <div ref={appQrRef} className="flex justify-center">
                    <QRCodeCanvas value={appLink} size={150} />
                  </div>

                  <p className="mt-4 text-sm font-black text-slate-950">
                    Restaurant App
                  </p>

                  <p className="mt-2 break-all text-xs font-semibold leading-5 text-slate-500">
                    {appLink}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => copyLink(appLink)}
                      className="rounded-[18px] bg-slate-950 px-4 py-3 text-xs font-black text-white"
                    >
                      Copy Link
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadQr(appQrRef, `restaurant-app-qr-${createdId}.png`)
                      }
                      className="rounded-[18px] bg-red-600 px-4 py-3 text-xs font-black text-white"
                    >
                      Download QR
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push(`/mini?id=${createdId}`)}
                className="block w-full rounded-[22px] bg-slate-950 px-5 py-4 text-base font-black text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] active:scale-[0.99]"
              >
                Open Restaurant App
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedId(null);
                  setName("");
                }}
                className="block w-full rounded-[22px] bg-red-600 px-5 py-4 text-base font-black text-white shadow-[0_14px_32px_rgba(220,38,38,0.25)] active:scale-[0.99]"
              >
                Create Another Restaurant
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}