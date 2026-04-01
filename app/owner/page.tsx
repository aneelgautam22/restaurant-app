"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MenuItem = {
  id: number;
  item_name: string;
  price: number;
  created_at?: string;
};

type OrderItem = {
  id: number;
  item_name: string;
  quantity: number;
  unit_price?: number | null;
};

type OrderRow = {
  id: number;
  table_number: string;
  status: string;
  created_at: string;
  waiter_cleared?: boolean | null;
  is_paid?: boolean | null;
  payment_method?: string | null;
  paid_at?: string | null;
  remarks?: string | null;
  order_items?: OrderItem[];
};

type SalesItem = {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
};

type OwnerView =
  | "dashboard"
  | "sales"
  | "reports"
  | "menu"
  | "tableOrders"
  | "paidHistory"
  | "passwords"
  | null;

type DailyTrendPoint = {
  date: string;
  shortLabel: string;
  sales: number;
};

type HoveredTrendPoint = {
  date: string;
  sales: number;
  x: number;
  y: number;
} | null;

type GroupedTableOrder = {
  table_number: string;
  order_ids: number[];
  remarks: string[];
  items: {
    item_name: string;
    quantity: number;
    total: number;
  }[];
  total: number;
  unpaid_orders_count: number;
};

function OwnerPageContent() {
  const searchParams = useSearchParams();
  const restaurantId = Number(searchParams.get("id") || 1);

  const [ownerView, setOwnerView] = useState<OwnerView>("dashboard");

  const [ownerPasswordInput, setOwnerPasswordInput] = useState("");
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [ownerPasswordFromDB, setOwnerPasswordFromDB] = useState("");

  const [restaurantName, setRestaurantName] = useState("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [editingItemPrice, setEditingItemPrice] = useState("");

  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newWaiterPassword, setNewWaiterPassword] = useState("");
  const [newKitchenPassword, setNewKitchenPassword] = useState("");
  const [savingPasswords, setSavingPasswords] = useState(false);

  const [trendDays, setTrendDays] = useState<7 | 15 | 30>(7);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<HoveredTrendPoint>(null);

  const [tableSearch, setTableSearch] = useState("");
  const [markingPaidTable, setMarkingPaidTable] = useState<string | null>(null);
  const [tablePaymentMethods, setTablePaymentMethods] = useState<
    Record<string, "cash" | "qr" | "card">
  >({});

  const getTodayLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [selectedReportDate, setSelectedReportDate] = useState(getTodayLocalDate());
  const [reportFromDate, setReportFromDate] = useState(getTodayLocalDate());
  const [reportToDate, setReportToDate] = useState(getTodayLocalDate());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedOwnerLogin = localStorage.getItem(`owner_logged_in_${restaurantId}`);
    if (savedOwnerLogin === "true") {
      setOwnerUnlocked(true);
    }
  }, [restaurantId]);

  async function fetchRestaurant() {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (!error && data) {
      const restaurantData = data as Record<string, any>;

      setOwnerPasswordFromDB(restaurantData.owner_password || "");
      setNewOwnerPassword(restaurantData.owner_password || "");
      setNewWaiterPassword(restaurantData.waiter_password || "");
      setNewKitchenPassword(restaurantData.kitchen_password || "");

      setRestaurantName(
        restaurantData.name ||
          restaurantData.restaurant_name ||
          restaurantData.restaurant ||
          restaurantData.title ||
          "Restaurant"
      );
    }
  }

  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as OrderRow[]);
    }
  }

  async function fetchMenu() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("item_name", { ascending: true });

    if (!error && data) {
      setMenuItems(data as MenuItem[]);
    }
  }

  useEffect(() => {
    fetchRestaurant();
    fetchOrders();
    fetchMenu();

    const ordersChannel = supabase
      .channel(`owner-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    const menuItemsChannel = supabase
      .channel(`owner-menu-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchMenu();
        }
      )
      .subscribe();

    const orderItemsChannel = supabase
      .channel(`owner-order-items-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchOrders();
      fetchMenu();
      fetchRestaurant();
    }, 2000);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuItemsChannel);
      supabase.removeChannel(orderItemsChannel);
      clearInterval(interval);
    };
  }, [restaurantId]);

  function unlockOwner() {
    if (ownerPasswordInput === ownerPasswordFromDB) {
      setOwnerUnlocked(true);
      setOwnerPasswordInput("");
      setOwnerView("dashboard");
      localStorage.setItem(`owner_logged_in_${restaurantId}`, "true");
      alert("Owner access granted");
    } else {
      alert("Wrong password");
    }
  }

  function logoutOwner() {
    localStorage.removeItem(`owner_logged_in_${restaurantId}`);
    setOwnerUnlocked(false);
    setOwnerView("dashboard");
    setEditingMenuId(null);
    setEditingItemName("");
    setEditingItemPrice("");
    setOwnerPasswordInput("");
    setHoveredTrendPoint(null);
    setTableSearch("");
  }

  function toggleOwnerView(view: Exclude<OwnerView, null>) {
    setOwnerView((prev) => (prev === view ? null : view));
  }

  async function handleAddMenuItem(e: React.FormEvent) {
    e.preventDefault();

    if (!newItemName.trim()) {
      alert("Please enter item name");
      return;
    }

    if (!newItemPrice.trim() || Number(newItemPrice) <= 0) {
      alert("Please enter valid price");
      return;
    }

    const { error } = await supabase.from("menu_items").insert([
      {
        restaurant_id: restaurantId,
        item_name: newItemName.trim(),
        price: Number(newItemPrice),
      },
    ]);

    if (error) {
      alert("Failed to add menu item");
      return;
    }

    setNewItemName("");
    setNewItemPrice("");
    fetchMenu();
    alert("Menu item added");
  }

  function startEditMenuItem(menu: MenuItem) {
    setEditingMenuId(menu.id);
    setEditingItemName(menu.item_name);
    setEditingItemPrice(String(menu.price));
  }

  function cancelEditMenuItem() {
    setEditingMenuId(null);
    setEditingItemName("");
    setEditingItemPrice("");
  }

  async function saveEditMenuItem(id: number) {
    if (!editingItemName.trim()) {
      alert("Please enter item name");
      return;
    }

    if (!editingItemPrice.trim() || Number(editingItemPrice) <= 0) {
      alert("Please enter valid price");
      return;
    }

    const { error } = await supabase
      .from("menu_items")
      .update({
        item_name: editingItemName.trim(),
        price: Number(editingItemPrice),
      })
      .eq("id", id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      alert("Failed to update menu item");
      return;
    }

    cancelEditMenuItem();
    fetchMenu();
    alert("Menu item updated");
  }

  async function deleteMenuItem(id: number) {
    const confirmDelete = confirm("Delete this menu item?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      alert("Failed to delete menu item");
      return;
    }

    fetchMenu();
    alert("Menu item deleted");
  }

  function getLocalDateString(dateValue: string) {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const todayLocalDate = getTodayLocalDate();

  const todayOrders = useMemo(() => {
    return orders.filter((order) => getLocalDateString(order.created_at) === todayLocalDate);
  }, [orders, todayLocalDate]);

  const totalOrdersToday = todayOrders.length;

  const totalItemsSoldToday = useMemo(() => {
    return todayOrders.reduce((sum, order) => {
      const qty =
        order.order_items?.reduce(
          (itemSum, item) => itemSum + Number(item.quantity || 0),
          0
        ) || 0;
      return sum + qty;
    }, 0);
  }, [todayOrders]);

  const totalRevenueToday = useMemo(() => {
    return todayOrders.reduce((sum, order) => {
      const revenue =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum +
            Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + revenue;
    }, 0);
  }, [todayOrders]);

  const salesByItem: SalesItem[] = useMemo(() => {
    const map: Record<string, SalesItem> = {};

    todayOrders.forEach((order) => {
      order.order_items?.forEach((item) => {
        if (!map[item.item_name]) {
          map[item.item_name] = {
            item_name: item.item_name,
            total_quantity: 0,
            total_revenue: 0,
          };
        }

        map[item.item_name].total_quantity += Number(item.quantity || 0);
        map[item.item_name].total_revenue +=
          Number(item.quantity || 0) * Number(item.unit_price || 0);
      });
    });

    return Object.values(map).sort((a, b) => b.total_quantity - a.total_quantity);
  }, [todayOrders]);

  const bestSellingItem = salesByItem.length > 0 ? salesByItem[0] : null;
  const lowestSellingItem =
    salesByItem.length > 0 ? salesByItem[salesByItem.length - 1] : null;

  const maxQty =
    salesByItem.length > 0
      ? Math.max(...salesByItem.map((item) => item.total_quantity))
      : 0;

  const minQty =
    salesByItem.length > 0
      ? Math.min(...salesByItem.map((item) => item.total_quantity))
      : 0;

  const paidOrders = useMemo(() => {
    return orders
      .filter((order) => order.is_paid === true)
      .sort((a, b) => {
        const aTime = a.paid_at ? new Date(a.paid_at).getTime() : 0;
        const bTime = b.paid_at ? new Date(b.paid_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [orders]);

  const reportPaidOrders = useMemo(() => {
    return paidOrders.filter(
      (order) =>
        order.paid_at && getLocalDateString(order.paid_at) === selectedReportDate
    );
  }, [paidOrders, selectedReportDate]);

  const rangePaidOrders = useMemo(() => {
    if (!reportFromDate || !reportToDate) return [];

    return paidOrders.filter((order) => {
      if (!order.paid_at) return false;
      const orderDate = getLocalDateString(order.paid_at);
      return orderDate >= reportFromDate && orderDate <= reportToDate;
    });
  }, [paidOrders, reportFromDate, reportToDate]);

  function buildReportData(sourceOrders: OrderRow[]) {
    const itemMap: Record<string, SalesItem> = {};
    const paymentTotals = {
      cash: 0,
      qr: 0,
      card: 0,
    };

    let totalSales = 0;
    let totalItemsSold = 0;

    sourceOrders.forEach((order) => {
      const orderTotal =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;

      totalSales += orderTotal;

      const method =
        order.payment_method === "qr" || order.payment_method === "card"
          ? order.payment_method
          : "cash";

      paymentTotals[method] += orderTotal;

      order.order_items?.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const revenue = quantity * Number(item.unit_price || 0);

        totalItemsSold += quantity;

        if (!itemMap[item.item_name]) {
          itemMap[item.item_name] = {
            item_name: item.item_name,
            total_quantity: 0,
            total_revenue: 0,
          };
        }

        itemMap[item.item_name].total_quantity += quantity;
        itemMap[item.item_name].total_revenue += revenue;
      });
    });

    const itemWiseReport = Object.values(itemMap).sort((a, b) => {
      if (b.total_quantity !== a.total_quantity) {
        return b.total_quantity - a.total_quantity;
      }
      return b.total_revenue - a.total_revenue;
    });

    return {
      totalSales,
      paidOrdersCount: sourceOrders.length,
      totalItemsSold,
      averageOrderValue:
        sourceOrders.length > 0 ? Math.round(totalSales / sourceOrders.length) : 0,
      itemWiseReport,
      topItem: itemWiseReport[0] || null,
      lowestItem:
        itemWiseReport.length > 0
          ? itemWiseReport[itemWiseReport.length - 1]
          : null,
      paymentTotals,
    };
  }

  const reportData = useMemo(() => {
    return buildReportData(reportPaidOrders);
  }, [reportPaidOrders]);

  const rangeReportData = useMemo(() => {
    return buildReportData(rangePaidOrders);
  }, [rangePaidOrders]);

  const dailySalesTrend = useMemo(() => {
    const days: DailyTrendPoint[] = [];
    const salesMap: Record<string, number> = {};

    paidOrders.forEach((order) => {
      if (!order.paid_at) return;

      const localDate = getLocalDateString(order.paid_at);
      const total =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;

      salesMap[localDate] = (salesMap[localDate] || 0) + total;
    });

    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;

      days.push({
        date: dateKey,
        shortLabel: `${month}/${day}`,
        sales: salesMap[dateKey] || 0,
      });
    }

    return days;
  }, [paidOrders, trendDays]);

  const monthlySalesTrend = useMemo(() => {
    const salesMap: Record<string, number> = {};

    paidOrders.forEach((order) => {
      if (!order.paid_at) return;

      const date = new Date(order.paid_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const monthKey = `${year}-${month}`;

      const total =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;

      salesMap[monthKey] = (salesMap[monthKey] || 0) + total;
    });

    const sortedKeys = Object.keys(salesMap).sort();

    return sortedKeys.map((key) => {
      const [year, month] = key.split("-");
      const labelDate = new Date(Number(year), Number(month) - 1, 1);

      return {
        monthKey: key,
        monthLabel: labelDate.toLocaleString(undefined, {
          month: "short",
          year: "numeric",
        }),
        sales: salesMap[key],
      };
    });
  }, [paidOrders]);

  const trendMaxSales = useMemo(() => {
    if (dailySalesTrend.length === 0) return 0;
    return Math.max(...dailySalesTrend.map((item) => item.sales), 0);
  }, [dailySalesTrend]);

  const chartWidth = 100;
  const chartHeight = 100;

  const trendLinePoints = useMemo(() => {
    if (dailySalesTrend.length === 0) return "";

    const max = trendMaxSales || 1;

    return dailySalesTrend
      .map((point, index) => {
        const x =
          dailySalesTrend.length === 1
            ? chartWidth / 2
            : (index / (dailySalesTrend.length - 1)) * chartWidth;
        const y = chartHeight - (point.sales / max) * 85 - 5;
        return `${x},${y}`;
      })
      .join(" ");
  }, [dailySalesTrend, trendMaxSales]);

  const dailyChartPoints = useMemo(() => {
    const max = trendMaxSales || 1;

    return dailySalesTrend.map((point, index) => {
      const x =
        dailySalesTrend.length === 1
          ? chartWidth / 2
          : (index / (dailySalesTrend.length - 1)) * chartWidth;
      const y = chartHeight - (point.sales / max) * 85 - 5;

      return {
        ...point,
        x,
        y,
      };
    });
  }, [dailySalesTrend, trendMaxSales]);

  const groupedTableOrders = useMemo(() => {
    const unpaidOrders = orders.filter((order) => order.is_paid !== true);
    const map: Record<string, GroupedTableOrder> = {};

    unpaidOrders.forEach((order) => {
      const tableNo = String(order.table_number || "").trim();
      if (!tableNo) return;

      if (!map[tableNo]) {
        map[tableNo] = {
          table_number: tableNo,
          order_ids: [],
          remarks: [],
          items: [],
          total: 0,
          unpaid_orders_count: 0,
        };
      }

      map[tableNo].order_ids.push(order.id);
      map[tableNo].unpaid_orders_count += 1;

      if (order.remarks && order.remarks.trim()) {
        map[tableNo].remarks.push(order.remarks.trim());
      }

      order.order_items?.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal = quantity * unitPrice;

        const existingItem = map[tableNo].items.find(
          (entry) => entry.item_name === item.item_name
        );

        if (existingItem) {
          existingItem.quantity += quantity;
          existingItem.total += lineTotal;
        } else {
          map[tableNo].items.push({
            item_name: item.item_name,
            quantity,
            total: lineTotal,
          });
        }

        map[tableNo].total += lineTotal;
      });
    });

    return Object.values(map)
      .sort((a, b) => {
        const aNum = Number(a.table_number);
        const bNum = Number(b.table_number);

        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          return aNum - bNum;
        }

        return a.table_number.localeCompare(b.table_number);
      })
      .map((table) => ({
        ...table,
        items: table.items.sort((a, b) => a.item_name.localeCompare(b.item_name)),
      }));
  }, [orders]);

  const filteredTableOrders = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();

    if (!search) return groupedTableOrders;

    return groupedTableOrders.filter((table) =>
      table.table_number.toLowerCase().includes(search)
    );
  }, [groupedTableOrders, tableSearch]);

  async function markGroupedTableAsPaid(
    tableNo: string,
    paymentMethod: "cash" | "qr" | "card"
  ) {
    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      alert("Invalid table number");
      return;
    }

    const unpaidOrdersForTable = orders.filter(
      (order) =>
        String(order.table_number).trim() === normalizedTableNo &&
        order.is_paid !== true
    );

    if (unpaidOrdersForTable.length === 0) {
      alert("No unpaid orders found for this table");
      return;
    }

    const confirmPay = confirm(
      `Mark all unpaid orders for table ${normalizedTableNo} as paid with ${paymentMethod.toUpperCase()}?`
    );
    if (!confirmPay) return;

    setMarkingPaidTable(normalizedTableNo);

    const orderIds = unpaidOrdersForTable.map((order) => order.id);

    const { error } = await supabase
      .from("orders")
      .update({
        is_paid: true,
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
      })
      .in("id", orderIds)
      .eq("restaurant_id", restaurantId);

    setMarkingPaidTable(null);

    if (error) {
      alert("Failed to mark orders as paid");
      return;
    }

    await fetchOrders();
    alert(`Table ${normalizedTableNo} marked as paid`);
  }

  async function savePasswords() {
    if (!newOwnerPassword.trim() || !newWaiterPassword.trim() || !newKitchenPassword.trim()) {
      alert("Please fill all passwords");
      return;
    }

    setSavingPasswords(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        owner_password: newOwnerPassword.trim(),
        waiter_password: newWaiterPassword.trim(),
        kitchen_password: newKitchenPassword.trim(),
      })
      .eq("id", restaurantId);

    setSavingPasswords(false);

    if (error) {
      alert("Failed to update passwords");
      return;
    }

    setOwnerPasswordFromDB(newOwnerPassword.trim());
    alert("Passwords updated successfully");
  }

  function ownerTabClass(view: Exclude<OwnerView, null>) {
    return `py-3 rounded-xl font-semibold text-sm transition ${
      ownerView === view
        ? "bg-blue-600 text-white shadow"
        : "bg-gray-200 text-gray-800"
    }`;
  }

  function trendDaysClass(days: 7 | 15 | 30) {
    return `px-3 py-2 rounded-xl text-sm font-medium ${
      trendDays === days
        ? "bg-blue-600 text-white"
        : "bg-gray-200 text-gray-800"
    }`;
  }

  function paymentButtonClass(
    tableNo: string,
    method: "cash" | "qr" | "card"
  ) {
    const selected = tablePaymentMethods[tableNo] || "cash";

    return `py-2 rounded-xl text-sm font-medium ${
      selected === method
        ? "bg-blue-600 text-white"
        : "bg-gray-200 text-gray-800"
    }`;
  }

  function formatPaymentMethod(method?: string | null) {
    if (!method) return "-";
    if (method === "qr") return "QR";
    if (method === "card") return "Card";
    return "Cash";
  }

  function formatReportDateLabel(dateValue: string) {
    if (!dateValue) return "-";
    return new Date(`${dateValue}T00:00:00`).toLocaleDateString();
  }

  function formatRangeLabel(fromDate: string, toDate: string) {
    if (!fromDate || !toDate) return "-";
    return `${formatReportDateLabel(fromDate)} to ${formatReportDateLabel(toDate)}`;
  }

  function formatExactDate(dateValue: string) {
    return new Date(`${dateValue}T00:00:00`).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (!ownerUnlocked) {
    return (
      <main className="min-h-screen bg-gray-100 p-3">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl shadow p-5 space-y-4 border">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {restaurantName || "Restaurant"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">Owner Panel Login</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold">Owner Password</label>
              <input
                type="password"
                value={ownerPasswordInput}
                onChange={(e) => setOwnerPasswordInput(e.target.value)}
                placeholder="Enter owner password"
                className="w-full border rounded-2xl px-4 py-3"
              />
            </div>

            <button
              type="button"
              onClick={unlockOwner}
              className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold"
            >
              Unlock Owner Panel
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-3">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-3xl shadow p-4 border space-y-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg font-bold shrink-0">
                {restaurantName ? restaurantName.charAt(0).toUpperCase() : "R"}
              </div>

              <h1 className="text-lg font-bold text-center flex-1 mx-2 truncate">
                {restaurantName || "Restaurant"}
              </h1>

              <button
                type="button"
                onClick={logoutOwner}
                className="bg-white text-red-600 px-3 py-1.5 rounded-full text-xs font-semibold shadow shrink-0"
              >
                Logout
              </button>
            </div>

            <div className="flex justify-center">
              <div className="px-4 py-1.5 rounded-full bg-white/20 text-sm font-semibold">
                Owner Panel
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleOwnerView("dashboard")}
              className={ownerTabClass("dashboard")}
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => toggleOwnerView("sales")}
              className={ownerTabClass("sales")}
            >
              Sales
            </button>

            <button
              type="button"
              onClick={() => toggleOwnerView("reports")}
              className={ownerTabClass("reports")}
            >
              Reports
            </button>

            <button
              type="button"
              onClick={() => toggleOwnerView("menu")}
              className={ownerTabClass("menu")}
            >
              Menu
            </button>

            <button
              type="button"
              onClick={() => toggleOwnerView("tableOrders")}
              className={ownerTabClass("tableOrders")}
            >
              Table Orders
            </button>

            <button
              type="button"
              onClick={() => toggleOwnerView("paidHistory")}
              className={ownerTabClass("paidHistory")}
            >
              Paid History
            </button>

            <button
              type="button"
              onClick={() => toggleOwnerView("passwords")}
              className={`${ownerTabClass("passwords")} col-span-2`}
            >
              Passwords
            </button>
          </div>

          {ownerView === "dashboard" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                  <p className="text-sm text-gray-600">Today Orders</p>
                  <p className="text-2xl font-bold">{totalOrdersToday}</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
                  <p className="text-sm text-gray-600">Items Sold</p>
                  <p className="text-2xl font-bold">{totalItemsSoldToday}</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold">Rs. {totalRevenueToday}</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3">
                  <p className="text-sm text-gray-600">Best Seller</p>
                  <p className="text-lg font-bold">
                    {bestSellingItem ? bestSellingItem.item_name : "-"}
                  </p>
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-4 space-y-2">
                <h3 className="text-lg font-bold">Today Highlights</h3>

                <p className="text-sm">
                  <span className="font-semibold">Highest Sold:</span>{" "}
                  {bestSellingItem
                    ? `${bestSellingItem.item_name} (${bestSellingItem.total_quantity})`
                    : "-"}
                </p>

                <p className="text-sm">
                  <span className="font-semibold">Lowest Sold:</span>{" "}
                  {lowestSellingItem
                    ? `${lowestSellingItem.item_name} (${lowestSellingItem.total_quantity})`
                    : "-"}
                </p>
              </div>
            </div>
          )}

          {ownerView === "sales" && (
            <div className="space-y-4">
              <div className="bg-white border rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-bold">Daily Sales Trend</h3>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTrendDays(7)}
                      className={trendDaysClass(7)}
                    >
                      7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendDays(15)}
                      className={trendDaysClass(15)}
                    >
                      15 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendDays(30)}
                      className={trendDaysClass(30)}
                    >
                      30 Days
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-500">
                  Paid orders ko date-wise trend. Point mathi mouse lagda exact date ra exact sales dekhिन्छ।
                </p>

                {dailySalesTrend.length === 0 ? (
                  <p className="text-sm text-gray-500">No trend data available.</p>
                ) : (
                  <>
                    <div className="relative w-full h-64 border rounded-2xl p-3 bg-gray-50">
                      {hoveredTrendPoint && (
                        <div
                          className="absolute z-10 bg-black text-white text-xs rounded-lg px-3 py-2 shadow"
                          style={{
                            left: `${Math.min(Math.max(hoveredTrendPoint.x, 8), 78)}%`,
                            top: `${Math.min(Math.max(hoveredTrendPoint.y - 10, 5), 75)}%`,
                            transform: "translate(-50%, -100%)",
                          }}
                        >
                          <p>{formatExactDate(hoveredTrendPoint.date)}</p>
                          <p>Rs. {hoveredTrendPoint.sales}</p>
                        </div>
                      )}

                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="w-full h-full"
                      >
                        <line x1="0" y1="95" x2="100" y2="95" stroke="#d1d5db" strokeWidth="0.6" />
                        <line x1="5" y1="5" x2="5" y2="95" stroke="#d1d5db" strokeWidth="0.6" />

                        {[25, 50, 75].map((y) => (
                          <line
                            key={y}
                            x1="5"
                            y1={y}
                            x2="100"
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="0.4"
                            strokeDasharray="1.5 1.5"
                          />
                        ))}

                        {trendLinePoints && (
                          <polyline
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="1.8"
                            points={trendLinePoints}
                          />
                        )}

                        {dailyChartPoints.map((point) => (
                          <circle
                            key={point.date}
                            cx={point.x}
                            cy={point.y}
                            r="2.1"
                            fill="#1d4ed8"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() =>
                              setHoveredTrendPoint({
                                date: point.date,
                                sales: point.sales,
                                x: point.x,
                                y: point.y,
                              })
                            }
                            onMouseLeave={() => setHoveredTrendPoint(null)}
                          />
                        ))}
                      </svg>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-sm">Exact Daily Sales</h4>

                      <div className="grid grid-cols-2 gap-2">
                        {dailySalesTrend.map((point) => (
                          <div
                            key={point.date}
                            className="border rounded-xl p-3 bg-white"
                          >
                            <p className="text-xs text-gray-500">
                              {formatExactDate(point.date)}
                            </p>
                            <p className="text-sm font-bold">Rs. {point.sales}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white border rounded-2xl p-4 space-y-3">
                <h3 className="text-lg font-bold">Monthly Trend</h3>

                {monthlySalesTrend.length === 0 ? (
                  <p className="text-sm text-gray-500">No monthly sales data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {monthlySalesTrend.map((month) => (
                      <div
                        key={month.monthKey}
                        className="flex items-center justify-between border rounded-xl p-3 bg-gray-50"
                      >
                        <span className="font-medium">{month.monthLabel}</span>
                        <span className="font-bold">Rs. {month.sales}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-2xl p-4 space-y-3">
                <h3 className="text-lg font-bold">Today Sales Chart</h3>

                {salesByItem.length === 0 && (
                  <p className="text-sm text-gray-500">No sales data for today.</p>
                )}

                {salesByItem.map((item) => {
                  const widthPercent =
                    maxQty > 0 ? (item.total_quantity / maxQty) * 100 : 0;

                  const isHighest = item.total_quantity === maxQty;
                  const isLowest = item.total_quantity === minQty;

                  let barClass = "bg-yellow-400 border-yellow-500 text-yellow-900";

                  if (isHighest) {
                    barClass = "bg-green-500 border-green-600 text-white";
                  } else if (isLowest) {
                    barClass = "bg-red-500 border-red-600 text-white";
                  }

                  return (
                    <div
                      key={item.item_name}
                      className="border rounded-2xl p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold">{item.item_name}</p>
                          <p className="text-sm text-gray-500">
                            Sold: {item.total_quantity} | Rs. {item.total_revenue}
                          </p>
                        </div>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className={`h-6 rounded-full border flex items-center justify-end px-2 text-xs font-bold ${barClass}`}
                          style={{ width: `${Math.max(widthPercent, 12)}%` }}
                        >
                          {item.total_quantity}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ownerView === "reports" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-xl font-bold">Reports</h2>
                  <span className="text-sm text-gray-500">Paid orders only</span>
                </div>

                <div className="border rounded-2xl p-4 bg-blue-50 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-bold">Today Report</h3>
                    <span className="text-sm text-gray-600">
                      Selected Date: {formatReportDateLabel(selectedReportDate)}
                    </span>
                  </div>

                  <div className="max-w-xs">
                    <label className="block text-sm font-semibold mb-2">Date</label>
                    <input
                      type="date"
                      value={selectedReportDate}
                      onChange={(e) => setSelectedReportDate(e.target.value)}
                      className="w-full border rounded-xl px-4 py-3 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Total Sales</p>
                      <p className="text-2xl font-bold">Rs. {reportData.totalSales}</p>
                    </div>

                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Paid Orders</p>
                      <p className="text-2xl font-bold">
                        {reportData.paidOrdersCount}
                      </p>
                    </div>

                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Items Sold</p>
                      <p className="text-2xl font-bold">
                        {reportData.totalItemsSold}
                      </p>
                    </div>

                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Avg Order Value</p>
                      <p className="text-2xl font-bold">
                        Rs. {reportData.averageOrderValue}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border rounded-2xl p-4 space-y-3">
                      <h4 className="font-bold">Item-wise Report</h4>

                      {reportData.itemWiseReport.length === 0 && (
                        <p className="text-sm text-gray-500">
                          No paid orders found for this date.
                        </p>
                      )}

                      {reportData.itemWiseReport.map((item) => (
                        <div
                          key={item.item_name}
                          className="flex items-center justify-between text-sm border-b pb-2"
                        >
                          <div>
                            <p className="font-semibold">{item.item_name}</p>
                            <p className="text-gray-500">
                              Qty: {item.total_quantity}
                            </p>
                          </div>
                          <p className="font-bold">Rs. {item.total_revenue}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white border rounded-2xl p-4 space-y-3">
                      <h4 className="font-bold">Payment Method Breakdown</h4>

                      <div className="border rounded-xl p-3 flex items-center justify-between">
                        <span>Cash</span>
                        <span className="font-bold">
                          Rs. {reportData.paymentTotals.cash}
                        </span>
                      </div>

                      <div className="border rounded-xl p-3 flex items-center justify-between">
                        <span>QR</span>
                        <span className="font-bold">
                          Rs. {reportData.paymentTotals.qr}
                        </span>
                      </div>

                      <div className="border rounded-xl p-3 flex items-center justify-between">
                        <span>Card</span>
                        <span className="font-bold">
                          Rs. {reportData.paymentTotals.card}
                        </span>
                      </div>

                      <div className="border rounded-xl p-3 bg-gray-50">
                        <p className="text-sm text-gray-500">Top Item</p>
                        <p className="font-bold">
                          {reportData.topItem
                            ? `${reportData.topItem.item_name} (${reportData.topItem.total_quantity})`
                            : "-"}
                        </p>
                      </div>

                      <div className="border rounded-xl p-3 bg-gray-50">
                        <p className="text-sm text-gray-500">Lowest Item</p>
                        <p className="font-bold">
                          {reportData.lowestItem
                            ? `${reportData.lowestItem.item_name} (${reportData.lowestItem.total_quantity})`
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-2xl p-4 bg-orange-50 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-bold">Custom Date Range Report</h3>
                    <span className="text-sm text-gray-600">
                      {formatRangeLabel(reportFromDate, reportToDate)}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={reportFromDate}
                        onChange={(e) => setReportFromDate(e.target.value)}
                        className="w-full border rounded-xl px-4 py-3 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={reportToDate}
                        onChange={(e) => setReportToDate(e.target.value)}
                        className="w-full border rounded-xl px-4 py-3 bg-white"
                      />
                    </div>
                  </div>

                  {reportFromDate > reportToDate && (
                    <p className="text-sm text-red-600 font-medium">
                      From date cannot be greater than To date.
                    </p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Total Sales</p>
                      <p className="text-2xl font-bold">
                        Rs. {reportFromDate > reportToDate ? 0 : rangeReportData.totalSales}
                      </p>
                    </div>

                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Paid Orders</p>
                      <p className="text-2xl font-bold">
                        {reportFromDate > reportToDate ? 0 : rangeReportData.paidOrdersCount}
                      </p>
                    </div>

                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Items Sold</p>
                      <p className="text-2xl font-bold">
                        {reportFromDate > reportToDate ? 0 : rangeReportData.totalItemsSold}
                      </p>
                    </div>

                    <div className="bg-white border rounded-2xl p-4">
                      <p className="text-sm text-gray-500">Avg Order Value</p>
                      <p className="text-2xl font-bold">
                        Rs. {reportFromDate > reportToDate ? 0 : rangeReportData.averageOrderValue}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border rounded-2xl p-4 space-y-3">
                      <h4 className="font-bold">Item-wise Report</h4>

                      {reportFromDate <= reportToDate &&
                        rangeReportData.itemWiseReport.length === 0 && (
                          <p className="text-sm text-gray-500">
                            No paid orders found for this date range.
                          </p>
                        )}

                      {reportFromDate <= reportToDate &&
                        rangeReportData.itemWiseReport.map((item) => (
                          <div
                            key={item.item_name}
                            className="flex items-center justify-between text-sm border-b pb-2"
                          >
                            <div>
                              <p className="font-semibold">{item.item_name}</p>
                              <p className="text-gray-500">
                                Qty: {item.total_quantity}
                              </p>
                            </div>
                            <p className="font-bold">Rs. {item.total_revenue}</p>
                          </div>
                        ))}
                    </div>

                    <div className="bg-white border rounded-2xl p-4 space-y-3">
                      <h4 className="font-bold">Payment Method Breakdown</h4>

                      <div className="border rounded-xl p-3 flex items-center justify-between">
                        <span>Cash</span>
                        <span className="font-bold">
                          Rs. {reportFromDate > reportToDate ? 0 : rangeReportData.paymentTotals.cash}
                        </span>
                      </div>

                      <div className="border rounded-xl p-3 flex items-center justify-between">
                        <span>QR</span>
                        <span className="font-bold">
                          Rs. {reportFromDate > reportToDate ? 0 : rangeReportData.paymentTotals.qr}
                        </span>
                      </div>

                      <div className="border rounded-xl p-3 flex items-center justify-between">
                        <span>Card</span>
                        <span className="font-bold">
                          Rs. {reportFromDate > reportToDate ? 0 : rangeReportData.paymentTotals.card}
                        </span>
                      </div>

                      <div className="border rounded-xl p-3 bg-gray-50">
                        <p className="text-sm text-gray-500">Top Item</p>
                        <p className="font-bold">
                          {reportFromDate > reportToDate
                            ? "-"
                            : rangeReportData.topItem
                            ? `${rangeReportData.topItem.item_name} (${rangeReportData.topItem.total_quantity})`
                            : "-"}
                        </p>
                      </div>

                      <div className="border rounded-xl p-3 bg-gray-50">
                        <p className="text-sm text-gray-500">Lowest Item</p>
                        <p className="font-bold">
                          {reportFromDate > reportToDate
                            ? "-"
                            : rangeReportData.lowestItem
                            ? `${rangeReportData.lowestItem.item_name} (${rangeReportData.lowestItem.total_quantity})`
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {ownerView === "menu" && (
            <div className="bg-white border rounded-2xl p-4">
              <h3 className="text-lg font-bold mb-3">Menu Management</h3>

              <form onSubmit={handleAddMenuItem} className="space-y-3 mb-4">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="New item name"
                  className="w-full border rounded-xl px-4 py-3"
                />

                <input
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="Price"
                  className="w-full border rounded-xl px-4 py-3"
                />

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
                >
                  Add Menu Item
                </button>
              </form>

              <div className="space-y-3">
                {menuItems.map((menu) => (
                  <div
                    key={menu.id}
                    className="border rounded-2xl p-3 bg-gray-50 space-y-3"
                  >
                    {editingMenuId === menu.id ? (
                      <>
                        <input
                          type="text"
                          value={editingItemName}
                          onChange={(e) => setEditingItemName(e.target.value)}
                          className="w-full border rounded-xl px-4 py-3"
                        />

                        <input
                          type="number"
                          value={editingItemPrice}
                          onChange={(e) => setEditingItemPrice(e.target.value)}
                          className="w-full border rounded-xl px-4 py-3"
                        />

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditMenuItem(menu.id)}
                            className="flex-1 bg-green-600 text-white py-2 rounded-xl font-medium"
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditMenuItem}
                            className="flex-1 bg-gray-400 text-white py-2 rounded-xl font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{menu.item_name}</p>
                            <p className="text-sm text-gray-500">Rs. {menu.price}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditMenuItem(menu)}
                            className="flex-1 bg-yellow-500 text-white py-2 rounded-xl font-medium"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteMenuItem(menu.id)}
                            className="flex-1 bg-red-600 text-white py-2 rounded-xl font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ownerView === "tableOrders" && (
            <div className="bg-white rounded-2xl shadow p-4 space-y-4">
              <div>
                <h2 className="text-xl font-bold">Table Orders</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Search table number to filter unpaid table orders
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Search Table Number
                </label>
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Enter table number"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div className="space-y-3">
                {filteredTableOrders.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No unpaid table orders found.
                  </p>
                )}

                {filteredTableOrders.map((table) => {
                  const selectedPaymentMethod =
                    tablePaymentMethods[table.table_number] || "cash";

                  return (
                    <div
                      key={table.table_number}
                      className="border rounded-2xl p-4 bg-gray-50 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold">
                              Table {table.table_number}
                            </h3>

                            <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700">
                              Unpaid
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 mt-1">
                            Unpaid Orders: {table.unpaid_orders_count}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {table.items.map((item) => (
                          <div
                            key={item.item_name}
                            className="flex items-center justify-between border rounded-xl px-3 py-2 bg-white"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {item.item_name} x {item.quantity}
                              </p>
                            </div>
                            <p className="text-sm font-semibold">Rs. {item.total}</p>
                          </div>
                        ))}
                      </div>

                      {table.remarks.length > 0 && (
                        <div className="border rounded-xl p-3 bg-yellow-50">
                          <p className="text-xs font-semibold text-gray-600 mb-2">
                            Remarks
                          </p>
                          <div className="space-y-1">
                            {table.remarks.map((remark, index) => (
                              <p
                                key={`${table.table_number}-remark-${index}`}
                                className="text-sm text-gray-800 whitespace-pre-wrap"
                              >
                                • {remark}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between text-lg font-bold">
                          <span>Total</span>
                          <span>Rs. {table.total}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">
                          Payment Method
                        </label>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setTablePaymentMethods((prev) => ({
                                ...prev,
                                [table.table_number]: "cash",
                              }))
                            }
                            className={paymentButtonClass(table.table_number, "cash")}
                          >
                            Cash
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setTablePaymentMethods((prev) => ({
                                ...prev,
                                [table.table_number]: "qr",
                              }))
                            }
                            className={paymentButtonClass(table.table_number, "qr")}
                          >
                            QR
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setTablePaymentMethods((prev) => ({
                                ...prev,
                                [table.table_number]: "card",
                              }))
                            }
                            className={paymentButtonClass(table.table_number, "card")}
                          >
                            Card
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          markGroupedTableAsPaid(
                            table.table_number,
                            selectedPaymentMethod
                          )
                        }
                        disabled={markingPaidTable === table.table_number}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
                      >
                        {markingPaidTable === table.table_number
                          ? "Marking..."
                          : "Mark as Paid"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ownerView === "paidHistory" && (
            <div className="bg-white rounded-2xl shadow p-4 space-y-4">
              <h2 className="text-xl font-bold">Paid History</h2>

              <div className="space-y-3">
                {paidOrders.length === 0 && (
                  <p className="text-sm text-gray-500">No paid orders yet.</p>
                )}

                {paidOrders.map((order) => {
                  const orderTotal =
                    order.order_items?.reduce(
                      (sum, item) =>
                        sum +
                        Number(item.quantity || 0) *
                          Number(item.unit_price || 0),
                      0
                    ) || 0;

                  return (
                    <div
                      key={order.id}
                      className="border rounded-2xl p-3 space-y-2 bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-base">
                            Table {order.table_number}
                          </p>
                          <p className="text-xs text-gray-500">Order #{order.id}</p>
                        </div>

                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                          Paid
                        </span>
                      </div>

                      <div className="text-sm text-gray-700 space-y-1">
                        {order.order_items?.length ? (
                          order.order_items.map((item) => (
                            <p key={item.id}>
                              {item.item_name} x {item.quantity}
                            </p>
                          ))
                        ) : (
                          <p>No items</p>
                        )}
                      </div>

                      {order.remarks && (
                        <div className="border rounded-xl p-2 bg-yellow-50">
                          <p className="text-xs font-semibold text-gray-600 mb-1">
                            Remarks
                          </p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {order.remarks}
                          </p>
                        </div>
                      )}

                      <div className="text-sm space-y-1 pt-1 border-t">
                        <p>
                          <span className="font-semibold">Total:</span> Rs.{" "}
                          {orderTotal}
                        </p>
                        <p>
                          <span className="font-semibold">Method:</span>{" "}
                          {formatPaymentMethod(order.payment_method)}
                        </p>
                        <p>
                          <span className="font-semibold">Paid At:</span>{" "}
                          {order.paid_at
                            ? new Date(order.paid_at).toLocaleString()
                            : "-"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ownerView === "passwords" && (
            <div className="bg-white border rounded-2xl p-4 space-y-4">
              <h3 className="text-lg font-bold">Password Management</h3>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Owner Password
                </label>
                <input
                  type="text"
                  value={newOwnerPassword}
                  onChange={(e) => setNewOwnerPassword(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Waiter Password
                </label>
                <input
                  type="text"
                  value={newWaiterPassword}
                  onChange={(e) => setNewWaiterPassword(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Kitchen Password
                </label>
                <input
                  type="text"
                  value={newKitchenPassword}
                  onChange={(e) => setNewKitchenPassword(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <button
                type="button"
                onClick={savePasswords}
                disabled={savingPasswords}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
              >
                {savingPasswords ? "Saving..." : "Save Passwords"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function OwnerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OwnerPageContent />
    </Suspense>
  );
}