"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const restaurantId = searchParams.get("id") || "";
  const token = searchParams.get("token") || "";

  const [ownerPassword, setOwnerPassword] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const isValidLink = useMemo(() => {
    return /^\d+$/.test(restaurantId) && token.length > 10;
  }, [restaurantId, token]);

  async function completeSetup() {
    setErrorText("");

    if (!isValidLink) {
      setErrorText("Invalid setup link.");
      return;
    }

    if (ownerPassword.length < 4 || staffPassword.length < 4) {
      setErrorText("Password must be at least 4 characters.");
      return;
    }

    if (ownerPassword !== confirmOwnerPassword) {
      setErrorText("Owner password does not match.");
      return;
    }

    if (staffPassword !== confirmStaffPassword) {
      setErrorText("Staff password does not match.");
      return;
    }

    if (ownerPassword === staffPassword) {
      setErrorText("Owner and staff password must be different.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("setup_restaurant_passwords", {
      p_restaurant_id: Number(restaurantId),
      p_setup_token: token,
      p_owner_password: ownerPassword,
      p_staff_password: staffPassword,
    });

    setLoading(false);

    if (error) {
      setErrorText(error.message || "Setup failed.");
      return;
    }

    if (!data?.success) {
      setErrorText(data?.message || "Setup failed.");
      return;
    }

    router.push(`/launcher?id=${restaurantId}`);
  }

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md items-center justify-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-white">
              <img src="/logo.png" alt="Restrofy" className="h-16 w-16 object-contain" />
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight">
             Setup ServeX
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Create owner and staff access passwords.
            </p>
          </div>

          {!isValidLink && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
              Invalid setup link. Check restaurant ID and setup token.
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-200">
                Owner Password
              </label>
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                placeholder="Create owner password"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-200">
                Confirm Owner Password
              </label>
              <input
                type="password"
                value={confirmOwnerPassword}
                onChange={(e) => setConfirmOwnerPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                placeholder="Confirm owner password"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-200">
                Staff Password
              </label>
              <input
                type="password"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                placeholder="Create staff password"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-200">
                Confirm Staff Password
              </label>
              <input
                type="password"
                value={confirmStaffPassword}
                onChange={(e) => setConfirmStaffPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                placeholder="Confirm staff password"
              />
            </div>
          </div>

          {errorText && (
            <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
              {errorText}
            </p>
          )}

          <button
            type="button"
            disabled={loading || !isValidLink}
            onClick={completeSetup}
            className="mt-6 w-full rounded-2xl bg-red-500 px-4 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Complete Setup"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupContent />
    </Suspense>
  );
}