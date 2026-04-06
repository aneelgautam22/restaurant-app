"use client";

type PanelLoginCardProps = {
  restaurantName: string;
  panelTitle: string;
  panelDescription: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordValue: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  buttonText: string;
  theme?: "owner" | "waiter" | "kitchen";
};

export default function PanelLoginCard({
  restaurantName,
  panelTitle,
  panelDescription,
  passwordLabel,
  passwordPlaceholder,
  passwordValue,
  onPasswordChange,
  onSubmit,
  buttonText,
  theme = "owner",
}: PanelLoginCardProps) {
  const themeStyles = {
    owner: {
      accentText: "text-blue-400",
      button:
        "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_16px_30px_rgba(37,99,235,0.30)]",
      iconBg: "bg-blue-50",
      brandGlow: "shadow-[0_10px_30px_rgba(37,99,235,0.18)]",
    },
    waiter: {
      accentText: "text-emerald-400",
      button:
        "bg-gradient-to-r from-emerald-600 to-green-600 shadow-[0_16px_30px_rgba(5,150,105,0.30)]",
      iconBg: "bg-emerald-50",
      brandGlow: "shadow-[0_10px_30px_rgba(16,185,129,0.18)]",
    },
    kitchen: {
      accentText: "text-orange-400",
      button:
        "bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_16px_30px_rgba(249,115,22,0.30)]",
      iconBg: "bg-orange-50",
      brandGlow: "shadow-[0_10px_30px_rgba(249,115,22,0.18)]",
    },
  };

  const activeTheme = themeStyles[theme];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#19335d_0%,_#08142f_45%,_#030814_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-start justify-center">
        <div className="w-full pt-6">
          <div className="mb-5 text-center">
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-[18px] border-4 border-white bg-black p-1 ${activeTheme.brandGlow}`}
            >
              <img
                src="/logo.png"
                alt="Restrofy Logo"
                className="h-full w-full object-cover scale-125"
              />
            </div>

            <p className="mt-2 text-sm font-bold uppercase tracking-[0.25em]">
              <span className="text-white">RESTRO</span>
              <span className="text-red-500">FY</span>
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              {restaurantName || "Restaurant"}
            </h1>

            <p className={`mt-1 text-sm font-semibold ${activeTheme.accentText}`}>
              {panelTitle} Login
            </p>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/10 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="rounded-[22px] border border-white/70 bg-white/88 p-4 text-slate-900 shadow-inner">
              <div className="mb-4 rounded-[18px] border border-slate-200 bg-slate-100/90 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Secure Access
                </p>
                <p className="mt-1 text-[15px] font-semibold text-slate-800">
                  {passwordPlaceholder}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">
                  {panelDescription}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  {passwordLabel}
                </label>

                <div className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${activeTheme.iconBg}`}
                  >
                    <span className="text-lg">🔐</span>
                  </div>

                  <input
                    type="password"
                    value={passwordValue}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    placeholder={passwordPlaceholder}
                    className="w-full bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={onSubmit}
                  className={`w-full rounded-[18px] py-3.5 text-[16px] font-extrabold text-white active:scale-[0.98] active:opacity-90 ${activeTheme.button}`}
                >
                  {buttonText}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}