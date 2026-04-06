"use client";

import { useEffect, useState } from "react";

type AppSplashProps = {
  subtitle?: string;
};

export default function AppSplash({
  subtitle = "Loading...",
}: AppSplashProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 40);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#1e293b_0%,_#0f172a_35%,_#020617_100%)] px-4">
      <div
        className={`text-center transition-all duration-700 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <div
          className={`mx-auto mb-3 h-20 w-20 rounded-[22px] overflow-hidden shadow-[0_18px_45px_rgba(239,68,68,0.35)] ring-1 ring-white/15 transition-all duration-700 ease-out ${
            visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          <img
            src="/logo.png"
            alt="Restrofy Logo"
            className="h-full w-full object-cover"
          />
        </div>

        <p
          className={`text-base font-extrabold tracking-[0.2em] uppercase mt-3 transition-all duration-700 delay-100 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          <span className="text-white">RESTRO</span>
          <span className="text-red-500">FY</span>
        </p>

        <p
          className={`mt-3 text-sm text-slate-300 transition-all duration-700 delay-150 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          {subtitle}
        </p>

        <div
          className={`mt-5 flex items-center justify-center gap-2 transition-all duration-700 delay-200 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse"></span>
          <span className="h-2.5 w-2.5 rounded-full bg-white/80 animate-pulse [animation-delay:200ms]"></span>
          <span className="h-2.5 w-2.5 rounded-full bg-white/60 animate-pulse [animation-delay:400ms]"></span>
        </div>
      </div>
    </main>
  );
}