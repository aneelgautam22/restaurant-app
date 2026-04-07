"use client";

import Link from "next/link";

export default function HomePage() {
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
              href="/r/1/waiter"
              className="block rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Waiter Panel
            </Link>

            <Link
              href="/r/1/kitchen"
              className="block rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Kitchen Panel
            </Link>

            <Link
              href="/r/1/owner"
              className="block rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Open Owner Panel
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}