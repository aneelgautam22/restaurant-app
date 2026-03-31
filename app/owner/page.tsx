"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";

type MenuItem = {
  id: number;
  item_name: string;
  price: number;
  created_at?: string;
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
  order_items?: {
    id: number;
    item_name: string;
    quantity: number;
    unit_price?: number | null;
  }[];
};

type SalesItem = {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
};

type BillItem = {
  item_name: string;
  quantity: number;
  total: number;
};

function OwnerPageContent() {
  const searchParams = useSearchParams();
  const restaurantId = Number(searchParams.get("id") || 1);

  const [ownerView, setOwnerView] = useState<
    | "dashboard"
    | "sales"
    | "reports"
    | "menu"
    | "orders"
    | "bills"
    | "paidHistory"
    | "passwords"
  >("dashboard");

  const [ownerPasswordInput, setOwnerPasswordInput] = useState("");
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [ownerPasswordFromDB, setOwnerPasswordFromDB] = useState("");

  const [ownerOrderFilter, setOwnerOrderFilter] = useState<
    "all" | "pending" | "preparing" | "ready"
  >("all");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [editingItemPrice, setEditingItemPrice] = useState("");

  const [ownerBillTableNumber, setOwnerBillTableNumber] = useState("");
  const [ownerPaymentMethod, setOwnerPaymentMethod] = useState<"cash" | "qr" | "card">(
    "cash"
  );
  const [markingPaidOwner, setMarkingPaidOwner] = useState(false);

  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newWaiterPassword, setNewWaiterPassword] = useState("");
  const [newKitchenPassword, setNewKitchenPassword] = useState("");
  const [savingPasswords, setSavingPasswords] = useState(false);

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

  async function fetchRestaurant() {
    const { data, error } = await supabase
      .from("restaurants")
      .select("owner_password, waiter_password, kitchen_password")
      .eq("id", restaurantId)
      .single();

    if (!error && data) {
      setOwnerPasswordFromDB(data.owner_password || "");
      setNewOwnerPassword(data.owner_password || "");
      setNewWaiterPassword(data.waiter_password || "");
      setNewKitchenPassword(data.kitchen_password || "");
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
      setOwnerOrderFilter("all");
      alert("Owner access granted");
    } else {
      alert("Wrong password");
    }
  }

  function lockOwner() {
    setOwnerUnlocked(false);
    setOwnerView("dashboard");
    setOwnerOrderFilter("all");
    setEditingMenuId(null);
    setEditingItemName("");
    setEditingItemPrice("");
    setOwnerBillTableNumber("");
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

  type BillData = {
    matchedOrders: OrderRow[];
    billItems: BillItem[];
    grandTotal: number;
  };

  function buildBillData(tableNo: string): BillData {
    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      return {
        matchedOrders: [],
        billItems: [],
        grandTotal: 0,
      };
    }

    const matchedOrders = orders.filter(
      (order) =>
        String(order.table_number).trim() === normalizedTableNo &&
        order.is_paid !== true
    );

    const billMap: Record<string, BillItem> = {};

    matchedOrders.forEach((order) => {
      order.order_items?.forEach((item) => {
        const itemName = item.item_name;
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal = quantity * unitPrice;

        if (!billMap[itemName]) {
          billMap[itemName] = {
            item_name: itemName,
            quantity: 0,
            total: 0,
          };
        }

        billMap[itemName].quantity += quantity;
        billMap[itemName].total += lineTotal;
      });
    });

    const billItems = Object.values(billMap).sort((a, b) =>
      a.item_name.localeCompare(b.item_name)
    );

    const grandTotal = billItems.reduce((sum, item) => sum + item.total, 0);

    return {
      matchedOrders,
      billItems,
      grandTotal,
    };
  }

  const ownerBillData = useMemo(() => {
    return buildBillData(ownerBillTableNumber);
  }, [ownerBillTableNumber, orders]);

  async function markTableAsPaid(
    tableNo: string,
    paymentMethod: "cash" | "qr" | "card"
  ) {
    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      alert("Please enter table number");
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

    setMarkingPaidOwner(true);

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

    setMarkingPaidOwner(false);

    if (error) {
      alert("Failed to mark orders as paid");
      return;
    }

    await fetchOrders();
    alert(`Table ${normalizedTableNo} marked as paid`);
    setOwnerBillTableNumber("");
    setOwnerPaymentMethod("cash");
  }

  const todayString = new Date().toISOString().slice(0, 10);

  const todayOrders = useMemo(() => {
    return orders.filter((order) => order.created_at.startsWith(todayString));
  }, [orders, todayString]);

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

  const ownerFilteredOrders = useMemo(() => {
    const unpaidOrders = orders.filter((order) => order.is_paid !== true);

    if (ownerOrderFilter === "all") {
      return unpaidOrders;
    }

    return unpaidOrders.filter((order) => order.status === ownerOrderFilter);
  }, [orders, ownerOrderFilter]);

  const paidOrders = useMemo(() => {
    return orders
      .filter((order) => order.is_paid === true)
      .sort((a, b) => {
        const aTime = a.paid_at ? new Date(a.paid_at).getTime() : 0;
        const bTime = b.paid_at ? new Date(b.paid_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [orders]);

  function getLocalDateString(dateValue: string) {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

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

  function ownerTabClass(
    view:
      | "dashboard"
      | "sales"
      | "reports"
      | "menu"
      | "orders"
      | "bills"
      | "paidHistory"
      | "passwords"
  ) {
    return `py-3 rounded-xl font-semibold text-sm ${
      ownerView === view
        ? "bg-blue-600 text-white"
        : "bg-gray-200 text-gray-800"
    }`;
  }

  function ownerFilterClass(filter: "all" | "pending" | "preparing" | "ready") {
    return `px-3 py-2 rounded-xl text-sm font-medium ${
      ownerOrderFilter === filter
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

  return (
    <main className="min-h-screen bg-gray-100 p-3">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow p-4">
          <h1 className="text-2xl font-bold mb-4 text-center">Owner Panel</h1>

          {!ownerUnlocked ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold">Owner Password</label>

              <input
                type="password"
                value={ownerPasswordInput}
                onChange={(e) => setOwnerPasswordInput(e.target.value)}
                placeholder="Enter owner password"
                className="w-full border rounded-xl px-4 py-3"
              />

              <button
                type="button"
                onClick={unlockOwner}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
              >
                Unlock Owner Panel
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Owner Panel</h2>

                <button
                  type="button"
                  onClick={lockOwner}
                  className="bg-gray-500 text-white px-4 py-2 rounded-xl text-sm font-medium"
                >
                  Lock
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOwnerView("dashboard")}
                  className={ownerTabClass("dashboard")}
                >
                  Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerView("sales")}
                  className={ownerTabClass("sales")}
                >
                  Sales
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerView("reports")}
                  className={ownerTabClass("reports")}
                >
                  Reports
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerView("menu")}
                  className={ownerTabClass("menu")}
                >
                  Menu
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerView("orders")}
                  className={ownerTabClass("orders")}
                >
                  Orders
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerView("bills")}
                  className={ownerTabClass("bills")}
                >
                  Bills
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerView("paidHistory")}
                  className={ownerTabClass("paidHistory")}
                >
                  Paid History
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerView("passwords")}
                  className={ownerTabClass("passwords")}
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

              {ownerView === "orders" && (
                <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                  <div>
                    <h2 className="text-xl font-bold mb-3">Recent Orders</h2>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOwnerOrderFilter("all")}
                        className={ownerFilterClass("all")}
                      >
                        All
                      </button>

                      <button
                        type="button"
                        onClick={() => setOwnerOrderFilter("pending")}
                        className={ownerFilterClass("pending")}
                      >
                        Pending
                      </button>

                      <button
                        type="button"
                        onClick={() => setOwnerOrderFilter("preparing")}
                        className={ownerFilterClass("preparing")}
                      >
                        Preparing
                      </button>

                      <button
                        type="button"
                        onClick={() => setOwnerOrderFilter("ready")}
                        className={ownerFilterClass("ready")}
                      >
                        Ready
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {ownerFilteredOrders.length === 0 && (
                      <p className="text-gray-500 text-sm">
                        No unpaid orders found for this filter.
                      </p>
                    )}

                    {ownerFilteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="border rounded-2xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-base">
                              Table {order.table_number}
                            </p>
                            <p className="text-xs text-gray-500">Order #{order.id}</p>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                              order.status === "ready"
                                ? "bg-green-100 text-green-700"
                                : order.status === "preparing"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {order.status}
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

                        {order.status === "ready" && (
                          <p className="text-xs text-gray-500">
                            Waiter cleared: {order.waiter_cleared ? "Yes" : "No"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ownerView === "bills" && (
                <div className="bg-white rounded-2xl shadow p-4 space-y-4">
                  <h2 className="text-xl font-bold">Bill Lookup</h2>

                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Enter Table Number
                    </label>
                    <input
                      type="text"
                      value={ownerBillTableNumber}
                      onChange={(e) => setOwnerBillTableNumber(e.target.value)}
                      placeholder="Enter table number"
                      className="w-full border rounded-xl px-4 py-3"
                    />
                  </div>

                  {ownerBillTableNumber.trim() && (
                    <div className="border rounded-2xl p-4 bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">
                          Table {ownerBillTableNumber}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Unpaid Orders: {ownerBillData.matchedOrders.length}
                        </p>
                      </div>

                      {ownerBillData.matchedOrders.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No unpaid orders found for this table.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {ownerBillData.billItems.map((item) => (
                              <div
                                key={item.item_name}
                                className="flex items-center justify-between border-b pb-2 text-sm"
                              >
                                <div>
                                  <p className="font-medium">{item.item_name}</p>
                                  <p className="text-gray-500">Qty: {item.quantity}</p>
                                </div>
                                <p className="font-semibold">Rs. {item.total}</p>
                              </div>
                            ))}
                          </div>

                          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                            <div className="flex items-center justify-between text-lg font-bold">
                              <span>Grand Total</span>
                              <span>Rs. {ownerBillData.grandTotal}</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-sm font-semibold">
                              Payment Method
                            </label>

                            <div className="grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => setOwnerPaymentMethod("cash")}
                                className={`py-2 rounded-xl text-sm font-medium ${
                                  ownerPaymentMethod === "cash"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                Cash
                              </button>

                              <button
                                type="button"
                                onClick={() => setOwnerPaymentMethod("qr")}
                                className={`py-2 rounded-xl text-sm font-medium ${
                                  ownerPaymentMethod === "qr"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                QR
                              </button>

                              <button
                                type="button"
                                onClick={() => setOwnerPaymentMethod("card")}
                                className={`py-2 rounded-xl text-sm font-medium ${
                                  ownerPaymentMethod === "card"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                Card
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              markTableAsPaid(ownerBillTableNumber, ownerPaymentMethod)
                            }
                            disabled={markingPaidOwner}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
                          >
                            {markingPaidOwner ? "Marking..." : "Mark as Paid"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
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