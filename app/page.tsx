"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-7 py-8">
        <section className="w-full text-center">
          <img
            src="/logo.png"
            alt="ServeX Logo"
            className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-[0_16px_45px_rgba(220,38,38,0.28)]"
          />

          <h1 className="mt-5 flex items-center justify-center text-5xl font-black tracking-tight text-slate-950">
            <span>SERVE</span>

            <span className="ml-[2px] inline-block text-[4.2rem] leading-none text-red-600">
              X
            </span>
          </h1>

          <p className="mt-3 text-lg font-semibold text-slate-500">
  Modern Restaurant{" "}
  <span className="text-red-600 font-bold">
    POS
  </span>
</p>

          <div className="mt-7">
            <img
              src="/launcher-preview.png"
              alt="ServeX Preview"
              className="mx-auto w-full max-w-[320px] object-contain"
            />
          </div>

          <div className="mt-8 space-y-3">
            <Link
              href="/launcher"
              className="block w-full rounded-[22px] bg-slate-950 px-5 py-4 text-base font-black text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] active:scale-[0.99]"
            >
              Open Workspace
            </Link>

            <Link
              href="/create"
              className="block w-full rounded-[22px] bg-red-600 px-5 py-4 text-base font-black text-white shadow-[0_14px_32px_rgba(220,38,38,0.25)] active:scale-[0.99]"
            >
              Create Workspace
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}