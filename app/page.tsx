"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/home");
    }, 800);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center px-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-black shadow-[0_12px_40px_rgba(239,68,68,0.35)] ring-1 ring-white/10">
          <img
            src="/logo.png"
            alt="Restrofy Logo"
            className="h-16 w-16 object-contain"
          />
        </div>

        <h1 className="mt-6 text-5xl font-extrabold tracking-wide text-white">
          Restrofy
        </h1>

        <p className="mt-3 text-sm text-gray-400">
          Smart Restaurant Management
        </p>

        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-bounce"></span>
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-bounce [animation-delay:0.15s]"></span>
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-bounce [animation-delay:0.3s]"></span>
        </div>
      </div>
    </main>
  );
}