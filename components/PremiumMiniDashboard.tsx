"use client";

import React from "react";

type KitchenStatusKey = "pending" | "ready";

type GroupedTableOrder = {
  table_number: string;
  order_ids: number[];
  remarks: string[];
  items: {
    item_name: string;
    quantity: number;
    total: number;
    status: KitchenStatusKey;
  }[];
  total: number;
  unpaid_orders_count: number;
  table_status: KitchenStatusKey;
};

type HourlyTrendPoint = {
  hour: number;
  label: string;
  shortLabel: string;
  sales: number;
};

type RecentActivityItem = {
  id: string | number;
  title: string;
  subtitle?: string;
  time?: string;
  amount?: number;
  type?: "paid" | "order" | "ready" | "info";
};

type PremiumMiniDashboardProps = {
  restaurantName: string;
  todaySales: number;
  totalOrdersToday: number;
  totalItemsSoldToday: number;
  totalUnpaidAmount: number;
  totalProfitToday: number;
  unpaidTablesCount: number;
  lowStockCount: number;
  peakHourLabel: string;
  salesVsYesterday: {
    text: string;
    positive: boolean;
  };
  profitVsYesterday: {
    text: string;
    positive: boolean;
  };
  groupedTableOrders: GroupedTableOrder[];
  dashboardMobileTab: "unpaid" | "activity";
  setDashboardMobileTab: React.Dispatch<React.SetStateAction<"unpaid" | "activity">>;
  hourlySalesTrend: HourlyTrendPoint[];
  recentActivity: RecentActivityItem[];
  formatMoney: (value: number) => string;
  changeView?: (view: "order" | "kitchen" | "salesOverview" | "report") => void;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-white/12 bg-white/[0.07] backdrop-blur-2xl",
        "shadow-[0_18px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.16)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function StatIconBubble({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-16 w-16 items-center justify-center rounded-full text-[30px]",
        "border border-white/15 bg-white/[0.10] backdrop-blur-2xl",
        "shadow-[0_12px_30px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.22)]"
      )}
    >
      {children}
    </div>
  );
}

function TinyBadge({
  text,
  positive,
}: {
  text: string;
  positive: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold",
        positive
          ? "bg-emerald-500/18 text-emerald-300 ring-1 ring-emerald-300/20"
          : "bg-rose-500/18 text-rose-300 ring-1 ring-rose-300/20"
      )}
    >
      {text}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-4 px-1">
      <div className="text-[42px] leading-none">{icon}</div>
      <div>
        <h2 className="text-[24px] font-extrabold tracking-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-white/65">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  footer,
  className = "",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("min-h-[190px] p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-white/82">{title}</p>
          <p className="mt-4 text-[30px] font-black tracking-tight text-white">{value}</p>
          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>
        <StatIconBubble>{icon}</StatIconBubble>
      </div>
    </GlassCard>
  );
}

function SalesSplitCard({
  formatMoney,
}: {
  formatMoney: (value: number) => string;
}) {
  const rows = [
    { label: "Cash", value: 0, pct: "(0.0%)" },
    { label: "QR", value: 0, pct: "(0.0%)" },
    { label: "Card", value: 0, pct: "(0.0%)" },
  ];

  return (
    <GlassCard className="min-h-[190px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-white/82">💳 Today Sales Split</p>
          <div className="mt-5 space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[48px_1fr_auto] items-center gap-3">
                <span className="text-[15px] text-white/82">{row.label}</span>
                <span className="text-[15px] font-bold text-white">
                  Rs. {formatMoney(row.value)}
                </span>
                <span className="text-[13px] text-white/45">{row.pct}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          <StatIconBubble>💳</StatIconBubble>
          <div className="relative h-20 w-20 rounded-full bg-[conic-gradient(#60a5fa_0_25%,#f59e0b_25%_50%,#a78bfa_50%_75%,#34d399_75%_100%)] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <div className="h-full w-full rounded-full bg-[#11182a]/95 ring-1 ring-white/10" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function InfoCompactCard({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <GlassCard className="min-h-[160px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-white/82">{title}</p>
          <p className="mt-4 text-[15px] leading-6 text-white/70">{subtitle}</p>
        </div>
        <StatIconBubble>{icon}</StatIconBubble>
      </div>
    </GlassCard>
  );
}

function ItemsOrdersCard({
  totalItemsSoldToday,
  totalOrdersToday,
}: {
  totalItemsSoldToday: number;
  totalOrdersToday: number;
}) {
  return (
    <GlassCard className="min-h-[160px] p-5">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[24px]">🍽️</span>
            <span className="text-[15px] text-white/82">Items Sold</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-cyan-300 text-[28px]">〰️</span>
            <span className="text-[28px] font-black text-white">{totalItemsSoldToday}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[24px]">🧾</span>
            <span className="text-[15px] text-white/82">Orders</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-fuchsia-300 text-[28px]">〰️</span>
            <span className="text-[28px] font-black text-white">{totalOrdersToday}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function SalesTrendCard({
  points,
  formatMoney,
  peakHourLabel,
}: {
  points: HourlyTrendPoint[];
  formatMoney: (value: number) => string;
  peakHourLabel: string;
}) {
  const chartPoints = points.length > 0 ? points : [];
  const max = Math.max(...chartPoints.map((p) => Number(p.sales || 0)), 1);
  const width = 100;
  const height = 34;

  const coords = chartPoints.map((point, index) => {
    const x = chartPoints.length <= 1 ? 0 : (index / (chartPoints.length - 1)) * width;
    const y = height - (Number(point.sales || 0) / max) * height;
    return { x, y, ...point };
  });

  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-[24px]">📈</span>
            <p className="text-[18px] font-bold text-white">Sales Trend</p>
          </div>
          <p className="mt-1 text-sm text-white/60">Minimal hourly chart</p>
        </div>

        <div className="rounded-full bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10">
          {peakHourLabel && peakHourLabel !== "-" ? peakHourLabel : "No peak yet"}
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/8 bg-[#0f1628]/70 p-4">
        {coords.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-white/40">
            No sales trend yet
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible">
              <defs>
                <linearGradient id="premiumTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(56,189,248,0.35)" />
                  <stop offset="100%" stopColor="rgba(168,85,247,0.05)" />
                </linearGradient>
                <linearGradient id="premiumTrendStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(52,211,153,0.95)" />
                  <stop offset="50%" stopColor="rgba(56,189,248,0.95)" />
                  <stop offset="100%" stopColor="rgba(168,85,247,0.95)" />
                </linearGradient>
              </defs>

              {[0, 1, 2, 3].map((row) => {
                const y = (height / 3) * row;
                return (
                  <line
                    key={row}
                    x1="0"
                    y1={y}
                    x2={width}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="2 3"
                    strokeWidth="0.6"
                  />
                );
              })}

              {coords.length > 0 && (
                <path
                  d={`${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`}
                  fill="url(#premiumTrendFill)"
                />
              )}

              <path
                d={linePath}
                fill="none"
                stroke="url(#premiumTrendStroke)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {coords.map((point) => (
                <circle
                  key={`${point.hour}-${point.x}`}
                  cx={point.x}
                  cy={point.y}
                  r="1.8"
                  fill="#fff"
                  stroke="rgba(34,211,238,0.95)"
                  strokeWidth="1"
                />
              ))}
            </svg>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {coords.slice(-4).map((point) => (
                <div
                  key={point.hour}
                  className="rounded-[18px] border border-white/8 bg-white/[0.04] px-3 py-2"
                >
                  <p className="text-[11px] text-white/45">{point.shortLabel}</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    Rs. {formatMoney(point.sales)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}

function UnpaidTablesPanel({
  groupedTableOrders,
  formatMoney,
}: {
  groupedTableOrders: GroupedTableOrder[];
  formatMoney: (value: number) => string;
}) {
  if (groupedTableOrders.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-[24px] border border-white/8 bg-[#10182a]/60 text-sm text-white/35">
        No unpaid tables
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groupedTableOrders.slice(0, 4).map((table) => (
        <div
          key={table.table_number}
          className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-white">Table {table.table_number}</p>
              <p className="mt-1 text-xs text-white/50">
                {table.unpaid_orders_count} unpaid order{table.unpaid_orders_count > 1 ? "s" : ""}
              </p>
            </div>

            <div
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                table.table_status === "ready"
                  ? "bg-emerald-500/18 text-emerald-300"
                  : "bg-amber-500/18 text-amber-300"
              )}
            >
              {table.table_status === "ready" ? "Ready" : "Pending"}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {table.items.slice(0, 3).map((item, index) => (
              <div
                key={`${table.table_number}-${item.item_name}-${index}`}
                className="flex items-center justify-between rounded-[18px] bg-[#0f1628]/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{item.item_name}</p>
                  <p className="text-[11px] text-white/40">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-white">Rs. {formatMoney(item.total)}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
            <p className="text-xs text-white/45">Outstanding</p>
            <p className="text-lg font-black text-white">Rs. {formatMoney(table.total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentActivityPanel({
  recentActivity,
  formatMoney,
}: {
  recentActivity: RecentActivityItem[];
  formatMoney: (value: number) => string;
}) {
  if (recentActivity.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-[24px] border border-white/8 bg-[#10182a]/60 text-sm text-white/35">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recentActivity.slice(0, 5).map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4"
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl",
              item.type === "paid"
                ? "bg-emerald-500/15"
                : item.type === "ready"
                  ? "bg-cyan-500/15"
                  : item.type === "order"
                    ? "bg-violet-500/15"
                    : "bg-white/10"
            )}
          >
            {item.type === "paid" ? "💵" : item.type === "ready" ? "🍽️" : item.type === "order" ? "🧾" : "🔔"}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{item.title}</p>
            {item.subtitle ? (
              <p className="truncate text-xs text-white/45">{item.subtitle}</p>
            ) : null}
          </div>

          <div className="text-right">
            {typeof item.amount === "number" ? (
              <p className="text-sm font-bold text-white">Rs. {formatMoney(item.amount)}</p>
            ) : null}
            {item.time ? <p className="text-[11px] text-white/40">{item.time}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PremiumMiniDashboard({
  todaySales,
  totalOrdersToday,
  totalItemsSoldToday,
  totalUnpaidAmount,
  totalProfitToday,
  peakHourLabel,
  salesVsYesterday,
  profitVsYesterday,
  groupedTableOrders,
  dashboardMobileTab,
  setDashboardMobileTab,
  hourlySalesTrend,
  recentActivity,
  formatMoney,
  changeView,
}: PremiumMiniDashboardProps) {
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[34px] bg-[#0a1020] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(80,180,255,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(120,92,255,0.20),transparent_30%),radial-gradient(circle_at_bottom,rgba(138,92,246,0.16),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="pointer-events-none absolute -left-24 top-12 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-24 right-0 h-64 w-64 rounded-full bg-fuchsia-500/12 blur-3xl" />

        <div className="relative z-10 p-4 space-y-5">
          <SectionTitle
            icon="📊"
            title="Dashboard"
            subtitle="Compact mobile-first business snapshot"
          />

          <div className="grid grid-cols-2 gap-4">
            <StatCard
              title="💰 Today Sales"
              value={`Rs. ${formatMoney(todaySales)}`}
              icon="💰"
              footer={
                <div className="flex flex-wrap gap-2">
                  <TinyBadge text={salesVsYesterday.text} positive={salesVsYesterday.positive} />
                  <div className="inline-flex items-center rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70">
                    vs yesterday
                  </div>
                </div>
              }
            />

            <SalesSplitCard formatMoney={formatMoney} />

            <StatCard
              title="⏳ Unpaid Amount"
              value={`Rs. ${formatMoney(totalUnpaidAmount)}`}
              icon="⏳"
            />

            <InfoCompactCard
              title="🔥 Best Seller"
              subtitle="No best seller yet"
              icon="🔥"
            />

            <StatCard
              title="💸 Today Profit"
              value={`Rs. ${formatMoney(totalProfitToday)}`}
              icon="💸"
              footer={
                <div className="flex flex-wrap gap-2">
                  <TinyBadge text={profitVsYesterday.text} positive={profitVsYesterday.positive} />
                  <div className="inline-flex items-center rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70">
                    vs yesterday
                  </div>
                </div>
              }
            />

            <ItemsOrdersCard
              totalItemsSoldToday={totalItemsSoldToday}
              totalOrdersToday={totalOrdersToday}
            />
          </div>

          <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2">
            <button
              type="button"
              onClick={() => changeView?.("order")}
              className={cn(
                "inline-flex items-center gap-3 rounded-full px-8 py-4 text-[17px] font-bold text-white",
                "bg-[linear-gradient(90deg,#49b8ff_0%,#4f7cff_45%,#7d59ff_100%)]",
                "shadow-[0_18px_40px_rgba(79,124,255,0.45),inset_0_1px_0_rgba(255,255,255,0.22)]"
              )}
            >
              <span className="text-[30px] leading-none">＋</span>
              <span>Take Order</span>
            </button>
          </div>

          <SalesTrendCard
            points={hourlySalesTrend}
            formatMoney={formatMoney}
            peakHourLabel={peakHourLabel}
          />

          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-bold text-white">Live Updates</p>
                <p className="mt-1 text-sm text-white/55">What needs action right now</p>
              </div>
            </div>

            <div className="mt-4 rounded-full bg-[#0d1426]/80 p-1 ring-1 ring-white/6">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDashboardMobileTab("unpaid")}
                  className={cn(
                    "rounded-full px-4 py-3 text-sm font-bold transition",
                    dashboardMobileTab === "unpaid"
                      ? "bg-white text-slate-900"
                      : "text-white/55"
                  )}
                >
                  Unpaid Tables
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardMobileTab("activity")}
                  className={cn(
                    "rounded-full px-4 py-3 text-sm font-bold transition",
                    dashboardMobileTab === "activity"
                      ? "bg-white text-slate-900"
                      : "text-white/55"
                  )}
                >
                  Recent Activity
                </button>
              </div>
            </div>

            <div className="mt-4">
              {dashboardMobileTab === "unpaid" ? (
                <UnpaidTablesPanel
                  groupedTableOrders={groupedTableOrders}
                  formatMoney={formatMoney}
                />
              ) : (
                <RecentActivityPanel
                  recentActivity={recentActivity}
                  formatMoney={formatMoney}
                />
              )}
            </div>
          </GlassCard>

          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}
