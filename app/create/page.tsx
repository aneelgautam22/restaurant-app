"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CreateRestaurant() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

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
          kitchen_password: "setup_pending",
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error || !data) {
      alert(`Error: ${error?.message || "Failed to create restaurant"}`);
      return;
    }

    router.push(`/home?id=${data.id}`);
  }

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
            Create your restaurant workspace and start managing smarter
          </p>
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

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-4 py-3.5 text-white font-semibold shadow-[0_14px_30px_rgba(239,68,68,0.35)] hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Creating Restaurant..." : "Create Account"}
            </button>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs leading-5 text-slate-500 text-center">
              Your restaurant will be created first. Panel passwords can be set
              up later from your owner side.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}