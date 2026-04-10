"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppSplash from "@/components/AppSplash";
import PanelLoginCard from "@/components/PanelLoginCard";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";

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
  status?: string | null;
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
  | "order"
  | "kitchen"
  | "salesOverview"
  | "report"
  | "billing"
  | "paymentHistory";

type PopupView = "menuItems" | "passwords" | null;
type SalesPeriod = "day" | "week" | "month";

type DailyTrendPoint = {
  date: string;
  shortLabel: string;
  sales: number;
};

type HoveredTrendPoint = {
  label: string;
  sales: number;
  x: number;
  y: number;
} | null;

type HourlyTrendPoint = {
  hour: number;
  label: string;
  shortLabel: string;
  sales: number;
};

type HoveredHourlyPoint = {
  hour: number;
  label: string;
  sales: number;
  x: number;
  y: number;
} | null;

type KitchenStatusKey = "pending" | "preparing" | "ready";

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

type TakeOrderCartItem = {
  id: number;
  item_name: string;
  price: number;
  quantity: number;
};

function OwnerPageContent() {
  const searchParams = useSearchParams();
  const restaurantIdParam = searchParams.get("id");
  const restaurantId = restaurantIdParam ? Number(restaurantIdParam) : null;

  const [ownerView, setOwnerView] = useState<OwnerView>("dashboard");
  const [popupView, setPopupView] = useState<PopupView>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [showTakeOrderModal, setShowTakeOrderModal] = useState(false);
  const [takeOrderTableNumber, setTakeOrderTableNumber] = useState("");
  const [takeOrderSearch, setTakeOrderSearch] = useState("");
  const [takeOrderRemarks, setTakeOrderRemarks] = useState("");
  const [takeOrderItems, setTakeOrderItems] = useState<TakeOrderCartItem[]>([]);
  const [submittingTakeOrder, setSubmittingTakeOrder] = useState(false);
  const [showTakeOrderCart, setShowTakeOrderCart] = useState(false);
  const [reportOrder, setReportOrder] = useState<OrderRow | null>(null);
  const [selectedPaidOrder, setSelectedPaidOrder] = useState<OrderRow | null>(null);
  const [reportPaymentMethod, setReportPaymentMethod] = useState<"cash" | "qr" | "card">("cash");
  const [markingReportPaid, setMarkingReportPaid] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingOrderLoading, setEditingOrderLoading] = useState(false);

  const [ownerPasswordInput, setOwnerPasswordInput] = useState("");
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [ownerPasswordFromDB, setOwnerPasswordFromDB] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
 useEffect(() => {
  if (!restaurantId) return;

  localStorage.setItem("lastRestaurantId", String(restaurantId));
  localStorage.setItem("lastPanel", "mini");
}, [restaurantId]);
  const [restaurantExists, setRestaurantExists] = useState(true);
  const [isSetupDone, setIsSetupDone] = useState(false);
  const [checkingRestaurant, setCheckingRestaurant] = useState(true);

  const [setupRestaurantName, setSetupRestaurantName] = useState("");
  const [setupOwnerPassword, setSetupOwnerPassword] = useState("");
  const [setupWaiterPassword, setSetupWaiterPassword] = useState("");
  const [setupKitchenPassword, setSetupKitchenPassword] = useState("");
  const [settingUpRestaurant, setSettingUpRestaurant] = useState(false);

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
  const [passwordsLoaded, setPasswordsLoaded] = useState(false);

  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<HoveredTrendPoint>(null);
  const [hoveredHourlyPoint, setHoveredHourlyPoint] = useState<HoveredHourlyPoint>(null);

  const [tableSearch, setTableSearch] = useState("");
  const [markingPaidTable, setMarkingPaidTable] = useState<string | null>(null);
  const [tablePaymentMethods, setTablePaymentMethods] = useState<
    Record<string, "cash" | "qr" | "card">
  >({});

  const [dashboardMobileTab, setDashboardMobileTab] = useState<"unpaid" | "activity">(
    "unpaid"
  );
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("day");
  const [kitchenStatusExpanded, setKitchenStatusExpanded] = useState(false);
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState<"all" | KitchenStatusKey>("all");
  const [openedKitchenTables, setOpenedKitchenTables] = useState<Record<string, boolean>>({});
  const [kitchenUpdatingTable, setKitchenUpdatingTable] = useState<string | null>(null);
  const [kitchenUpdatingStatus, setKitchenUpdatingStatus] = useState<KitchenStatusKey | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const ordersRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderIdsRef = useRef<number[]>([]);

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
  const [showSplash, setShowSplash] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error" | "info";
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    confirmText: string;
    cancelText: string;
  } | null>(null);

  useEffect(() => {
  const timer = setTimeout(() => {
    setShowSplash(false);
  }, 700);

  return () => clearTimeout(timer);
}, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(message: string, kind: "success" | "error" | "info" = "info") {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ message, kind });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2200);
  }

  function askConfirm(
    message: string,
    confirmText = "Confirm",
    cancelText = "Cancel"
  ) {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({ message, confirmText, cancelText });
    });
  }

  function handleConfirmResponse(value: boolean) {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmDialog(null);
    if (resolver) resolver(value);
  }

  function renderFeedbackOverlays() {
    return (
      <>
        {toast && (
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex justify-center px-4">
            <div
              className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(15,23,42,0.25)] ${
                toast.kind === "success"
                  ? "bg-emerald-600"
                  : toast.kind === "error"
                    ? "bg-rose-600"
                    : "bg-slate-900"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {confirmDialog && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 px-4">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.30)]">
              <h3 className="text-lg font-bold text-slate-900">Please confirm</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{confirmDialog.message}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmResponse(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmResponse(true)}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!restaurantId) return;

    const savedOwnerLogin = localStorage.getItem(`owner_logged_in_${restaurantId}`);
    if (savedOwnerLogin === "true") {
      setOwnerUnlocked(true);
    }
  }, [restaurantId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
      }
    }

    if (showHeaderMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHeaderMenu]);

  function scrollMainContentToTop() {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function scheduleOrdersRefresh(delay = 120) {
    if (ordersRefreshTimeoutRef.current) {
      clearTimeout(ordersRefreshTimeoutRef.current);
    }

    ordersRefreshTimeoutRef.current = setTimeout(() => {
      ordersRefreshTimeoutRef.current = null;
      fetchOrders();
    }, delay);
  }

  function scheduleMenuRefresh(delay = 120) {
    if (menuRefreshTimeoutRef.current) {
      clearTimeout(menuRefreshTimeoutRef.current);
    }

    menuRefreshTimeoutRef.current = setTimeout(() => {
      menuRefreshTimeoutRef.current = null;
      fetchMenu();
    }, delay);
  }

  function changeView(view: OwnerView) {
  if (ownerView === view && popupView === null) {
    scrollMainContentToTop();
    return;
  }

  setIsSwitching(true);
  setShowHeaderMenu(false);

  // 🔥 instant switch
  setOwnerView(view);
  setPopupView(null);
  scrollMainContentToTop();

  // 🔥 smooth without delay
  requestAnimationFrame(() => {
    setIsSwitching(false);
  });
}


  const miniQrLink =
    typeof window !== "undefined" && restaurantId
      ? `${window.location.origin}/mini?id=${restaurantId}`
      : "";

  function openQrAccess() {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    setShowHeaderMenu(false);
    setShowQR(true);
  }

  async function copyMiniQrLink() {
    if (!miniQrLink) {
      showToast("Link not ready", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(miniQrLink);
      showToast("Link copied", "success");
    } catch {
      showToast("Failed to copy link", "error");
    }
  }

  function downloadMiniQr() {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    const canvas = document.getElementById("mini-qr-canvas") as HTMLCanvasElement | null;

    if (!canvas) {
      showToast("QR not found", "error");
      return;
    }

    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `mini-qr-${restaurantId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  function openTakeOrderModal() {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    setShowHeaderMenu(false);
    setShowTakeOrderModal(true);
  }

  function resetTakeOrderForm() {
    setTakeOrderTableNumber("");
    setTakeOrderSearch("");
    setTakeOrderRemarks("");
    setTakeOrderItems([]);
    setShowTakeOrderCart(false);
    setEditingOrderId(null);
    setEditingOrderLoading(false);
  }

  function closeTakeOrderModal() {
    if (submittingTakeOrder) return;
    setShowTakeOrderModal(false);
    resetTakeOrderForm();
  }

  function addTakeOrderItem(menu: MenuItem) {
    setTakeOrderItems((prev) => {
      const existing = prev.find((item) => item.id === menu.id);
      if (existing) {
        return prev.map((item) =>
          item.id === menu.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [
        ...prev,
        {
          id: menu.id,
          item_name: menu.item_name,
          price: Number(menu.price || 0),
          quantity: 1,
        },
      ];
    });
  }

  function decreaseTakeOrderItem(menuId: number) {
    setTakeOrderItems((prev) =>
      prev
        .map((item) =>
          item.id === menuId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function increaseTakeOrderItem(menuId: number) {
    setTakeOrderItems((prev) =>
      prev.map((item) =>
        item.id === menuId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function removeTakeOrderItem(menuId: number) {
    setTakeOrderItems((prev) => prev.filter((item) => item.id !== menuId));
  }

  async function submitTakeOrder() {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    if (!takeOrderTableNumber.trim()) {
      showToast("Please enter table number", "error");
      return;
    }

    if (!/^\d+$/.test(takeOrderTableNumber.trim())) {
      showToast("Please enter valid table number", "error");
      return;
    }

    if (takeOrderItems.length === 0) {
      showToast("Please add at least one item", "error");
      return;
    }

    setSubmittingTakeOrder(true);

    const payload = {
      table_number: takeOrderTableNumber.trim(),
      remarks: takeOrderRemarks.trim() || null,
      status: "pending",
      waiter_cleared: false,
      is_paid: false,
    };

    if (editingOrderId) {
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update(payload)
        .eq("id", editingOrderId)
        .eq("restaurant_id", restaurantId);

      if (updateOrderError) {
        setSubmittingTakeOrder(false);
        showToast("Failed to update order", "error");
        return;
      }

      const { error: deleteItemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", editingOrderId);

      if (deleteItemsError) {
        setSubmittingTakeOrder(false);
        showToast("Failed to refresh order items", "error");
        return;
      }

      const updatedItemsPayload = takeOrderItems.map((item) => ({
        order_id: editingOrderId,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.price,
        status: "pending",
      }));

      const { error: insertItemsError } = await supabase
        .from("order_items")
        .insert(updatedItemsPayload);

      setSubmittingTakeOrder(false);

      if (insertItemsError) {
        showToast("Failed to update order items", "error");
        return;
      }

      resetTakeOrderForm();
      setShowTakeOrderModal(false);
      await fetchOrders();
      showToast("Order updated successfully", "success");
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          restaurant_id: restaurantId,
          ...payload,
        },
      ])
      .select()
      .single();

    if (orderError || !orderData) {
      setSubmittingTakeOrder(false);
      showToast("Failed to create order", "error");
      return;
    }

    const orderItemsPayload = takeOrderItems.map((item) => ({
      order_id: orderData.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.price,
      status: "pending",
    }));

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    setSubmittingTakeOrder(false);

    if (orderItemsError) {
      await supabase.from("orders").delete().eq("id", orderData.id);
      showToast("Failed to save order items", "error");
      return;
    }

    resetTakeOrderForm();
    setShowTakeOrderModal(false);
    await fetchOrders();
    showToast("Order sent to kitchen", "success");
  }

  function getOrderDisplayStatus(order: OrderRow): KitchenStatusKey {
    const statuses = order.order_items?.map((item) => item.status || order.status) || [];
    if (statuses.some((status) => status === "preparing")) return "preparing";
    if (statuses.length > 0 && statuses.every((status) => status === "ready")) return "ready";
    if (order.status === "ready") return "ready";
    if (order.status === "preparing") return "preparing";
    return "pending";
  }

  async function handleEditOrder(order: OrderRow) {
    if (order.is_paid) {
      showToast("Paid order edit garna mildaina", "error");
      return;
    }

    const currentStatus = getOrderDisplayStatus(order);
    if (currentStatus === "preparing" || currentStatus === "ready") {
      showToast("Preparing or ready bhayeko order edit garna mildaina", "error");
      return;
    }

    setEditingOrderLoading(true);
    setEditingOrderId(order.id);
    setTakeOrderTableNumber(String(order.table_number || ""));
    setTakeOrderSearch("");
    setTakeOrderRemarks(order.remarks || "");
    setTakeOrderItems(
      (order.order_items || []).map((item) => ({
        id: item.id,
        item_name: item.item_name,
        price: Number(item.unit_price || 0),
        quantity: Number(item.quantity || 0),
      }))
    );
    setShowHeaderMenu(false);
    setShowTakeOrderCart(false);
    setShowTakeOrderModal(true);
    setOwnerView("order");
    setEditingOrderLoading(false);
  }

  async function handleCancelOrder(orderId: number) {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    const targetOrder = orders.find((order) => order.id === orderId);
    if (!targetOrder) {
      showToast("Order not found", "error");
      return;
    }

    if (targetOrder.is_paid) {
      showToast("Paid order cancel garna mildaina", "error");
      return;
    }

    const currentStatus = getOrderDisplayStatus(targetOrder);
    if (currentStatus === "preparing" || currentStatus === "ready") {
      showToast("Preparing or ready bhayeko order cancel garna mildaina", "error");
      return;
    }

    const confirmCancel = await askConfirm(`Cancel order #${orderId} for table ${targetOrder.table_number}?`, "Yes, cancel", "Keep");
    if (!confirmCancel) return;

    const { error: deleteItemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (deleteItemsError) {
      showToast("Failed to cancel order items", "error");
      return;
    }

    const { error: deleteOrderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId);

    if (deleteOrderError) {
      showToast("Failed to cancel order", "error");
      return;
    }

    if (editingOrderId === orderId) {
      resetTakeOrderForm();
      setShowTakeOrderModal(false);
    }

    await fetchOrders();
    showToast("Order cancelled", "success");
  }


  function openOrderReport(order: OrderRow) {
    if (order.is_paid) {
      showToast("Yo order already paid chha", "error");
      return;
    }

    setReportOrder(order);
    setReportPaymentMethod((order.payment_method === "qr" || order.payment_method === "card") ? order.payment_method : "cash");
    setShowHeaderMenu(false);
  }

  function closeOrderReport() {
    if (markingReportPaid) return;
    setReportOrder(null);
    setReportPaymentMethod("cash");
  }

  function getOrderTotal(order: OrderRow | null) {
    if (!order) return 0;
    return (order.order_items || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    );
  }

  function openPaidOrderBill(order: OrderRow) {
    setSelectedPaidOrder(order);
    setShowHeaderMenu(false);
  }

  function closePaidOrderBill() {
    setSelectedPaidOrder(null);
  }

function printReceipt() {
    if (typeof window === "undefined") return;
    if (!reportOrder && !selectedPaidOrder) return;
    window.print();
  }

  function downloadReceipt() {
    if (typeof window === "undefined" || !reportOrder) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let y = 50;

    const line = (textValue: string, x = marginX, fontSize = 11, align: "left" | "center" | "right" = "left") => {
      doc.setFontSize(fontSize);
      doc.text(textValue, align === "center" ? pageWidth / 2 : x, y, { align });
      y += fontSize + 8;
    };

    const divider = () => {
      doc.setDrawColor(190, 190, 190);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 14;
    };

    const ensurePage = (extra = 20) => {
      if (y + extra > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 50;
      }
    };

    line(`${restaurantName || "Restaurant"}`, marginX, 16, "center");
    line(`KOT Bill`, marginX, 18, "center");
    line(`Order #${reportOrder.id}`, marginX, 11, "center");
    y += 4;
    divider();

    line(`Type: Dine In`);
    line(`Table: ${reportOrder.table_number}`);
    line(`Order By: Waiter`);
    line(`Order At: ${new Date(reportOrder.created_at).toLocaleString()}`);
    divider();

    line(`S.N   Item`, marginX, 11);
    doc.text(`Qty`, pageWidth - marginX, y - 19, { align: "right" });
    divider();

    (reportOrder.order_items || []).forEach((item, index) => {
      ensurePage(40);
      const itemLines = doc.splitTextToSize(`${index + 1}. ${item.item_name}`, pageWidth - marginX * 2 - 50);
      doc.setFontSize(11);
      doc.text(itemLines, marginX, y);
      doc.text(String(item.quantity || 0), pageWidth - marginX, y, { align: "right" });
      y += itemLines.length * 16 + 6;
    });

    divider();
    line(`Total Dishes: ${(reportOrder.order_items || []).length}`);
    line(
      `Total Qty: ${(reportOrder.order_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}`
    );

    if (reportOrder.remarks) {
      ensurePage(50);
      divider();
      line(`Remarks:`, marginX, 11);
      const remarkLines = doc.splitTextToSize(reportOrder.remarks, pageWidth - marginX * 2);
      doc.text(remarkLines, marginX, y);
      y += remarkLines.length * 16 + 6;
    }

    divider();
    line(`Viewed At: ${new Date().toLocaleString()}`);
    y += 6;
    line(`Thank You!`, marginX, 12, "center");

    doc.save(`receipt-table-${reportOrder.table_number}-order-${reportOrder.id}.pdf`);
  }

  function downloadPaidOrderBill() {
    if (typeof window === "undefined" || !selectedPaidOrder) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    let y = 50;

    const line = (textValue: string, x = marginX, fontSize = 11, align: "left" | "center" | "right" = "left") => {
      doc.setFontSize(fontSize);
      doc.text(textValue, align === "center" ? pageWidth / 2 : x, y, { align });
      y += fontSize + 8;
    };

    const divider = () => {
      doc.setDrawColor(190, 190, 190);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 14;
    };

    const ensurePage = (extra = 20) => {
      if (y + extra > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 50;
      }
    };

    line(`${restaurantName || "Restaurant"}`, marginX, 16, "center");
    line(`Customer Bill`, marginX, 18, "center");
    line(`Order #${selectedPaidOrder.id}`, marginX, 11, "center");
    y += 4;
    divider();

    line(`Table: ${selectedPaidOrder.table_number}`);
    line(
      `Paid At: ${selectedPaidOrder.paid_at ? new Date(selectedPaidOrder.paid_at).toLocaleString() : "-"}`
    );
    line(`Payment: ${formatPaymentMethod(selectedPaidOrder.payment_method)}`);
    divider();

    line(`Item`, marginX, 11);
    doc.text(`Qty`, pageWidth - marginX - 70, y - 19, { align: "right" });
    doc.text(`Amount`, pageWidth - marginX, y - 19, { align: "right" });
    divider();

    (selectedPaidOrder.order_items || []).forEach((item) => {
      ensurePage(40);
      const itemLines = doc.splitTextToSize(`${item.item_name}`, pageWidth - marginX * 2 - 110);
      const amount = Number(item.quantity || 0) * Number(item.unit_price || 0);
      doc.setFontSize(11);
      doc.text(itemLines, marginX, y);
      doc.text(String(item.quantity || 0), pageWidth - marginX - 70, y, { align: "right" });
      doc.text(`Rs. ${amount}`, pageWidth - marginX, y, { align: "right" });
      y += itemLines.length * 16 + 6;
    });

    divider();
    doc.setFontSize(13);
    doc.text(`Total: Rs. ${getOrderTotal(selectedPaidOrder)}`, pageWidth - marginX, y, {
      align: "right",
    });
    y += 22;

    if (selectedPaidOrder.remarks) {
      ensurePage(50);
      divider();
      line(`Remarks:`, marginX, 11);
      const remarkLines = doc.splitTextToSize(selectedPaidOrder.remarks, pageWidth - marginX * 2);
      doc.text(remarkLines, marginX, y);
      y += remarkLines.length * 16 + 6;
    }

    y += 8;
    line(`Thank You!`, marginX, 12, "center");

    doc.save(`customer-bill-table-${selectedPaidOrder.table_number}-order-${selectedPaidOrder.id}.pdf`);
  }

  async function markOrderAsPaidFromReport() {
    if (!restaurantId || !reportOrder) {
      showToast("Invalid order", "error");
      return;
    }

    const confirmPay = await askConfirm(`Table ${reportOrder.table_number} ko order #${reportOrder.id} lai ${reportPaymentMethod.toUpperCase()} bata paid mark garne?`, "Mark paid", "Back");
    if (!confirmPay) return;

    setMarkingReportPaid(true);

    const { error } = await supabase
      .from("orders")
      .update({
        is_paid: true,
        payment_method: reportPaymentMethod,
        paid_at: new Date().toISOString(),
      })
      .eq("id", reportOrder.id)
      .eq("restaurant_id", restaurantId);

    setMarkingReportPaid(false);

    if (error) {
      showToast("Failed to mark order as paid", "error");
      return;
    }

    await fetchOrders();
    setReportOrder(null);
    setReportPaymentMethod("cash");
    showToast("Order marked as paid", "success");
  }

  async function fetchRestaurant(showLoader = false) {
    if (!restaurantId) {
      setRestaurantExists(false);
      setCheckingRestaurant(false);
      return;
    }

    if (showLoader) {
      setCheckingRestaurant(true);
    }

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (error || !data) {
      setRestaurantExists(false);
      setCheckingRestaurant(false);
      return;
    }

    const restaurantData = data as Record<string, any>;

    setRestaurantExists(true);

    const fetchedRestaurantName =
      restaurantData.name ||
      restaurantData.restaurant_name ||
      restaurantData.restaurant ||
      restaurantData.title ||
      "";

    const fetchedOwnerPassword = restaurantData.owner_password || "";
    const fetchedWaiterPassword = restaurantData.waiter_password || "";
    const fetchedKitchenPassword = restaurantData.kitchen_password || "";

    const setupComplete =
      restaurantData.is_setup_done === true ||
      (!!fetchedRestaurantName &&
        fetchedOwnerPassword !== "setup_pending" &&
        fetchedWaiterPassword !== "setup_pending" &&
        fetchedKitchenPassword !== "setup_pending");

    setIsSetupDone(setupComplete);

    setRestaurantName(fetchedRestaurantName || "Restaurant");
    setOwnerPasswordFromDB(fetchedOwnerPassword);
    if (!passwordsLoaded) {
  setNewOwnerPassword(fetchedOwnerPassword);
  setNewWaiterPassword(fetchedWaiterPassword);
  setNewKitchenPassword(fetchedKitchenPassword);
  setPasswordsLoaded(true);
}

    if (!setupComplete) {
      setSetupRestaurantName(fetchedRestaurantName || "");
      setSetupOwnerPassword(
        fetchedOwnerPassword === "setup_pending" ? "" : fetchedOwnerPassword
      );
      setSetupWaiterPassword(
        fetchedWaiterPassword === "setup_pending" ? "" : fetchedWaiterPassword
      );
      setSetupKitchenPassword(
        fetchedKitchenPassword === "setup_pending" ? "" : fetchedKitchenPassword
      );
      setOwnerUnlocked(false);

      if (typeof window !== "undefined") {
        localStorage.removeItem(`owner_logged_in_${restaurantId}`);
      }
    }

    setCheckingRestaurant(false);
  }

  async function fetchOrders() {
    if (!restaurantId || !isSetupDone) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      orderIdsRef.current = (data as OrderRow[]).map((order) => order.id);
      setOrders(data as OrderRow[]);
    }
  }

  async function fetchMenu() {
    if (!restaurantId || !isSetupDone) return;

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
    fetchRestaurant(true);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !isSetupDone) return;

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
          scheduleOrdersRefresh(80);
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
          scheduleMenuRefresh(80);
        }
      )
      .subscribe();

    const orderItemsChannel = supabase
      .channel(`owner-order-items-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        (payload) => {
          const newRecord = payload.new as { order_id?: number } | null;
          const oldRecord = payload.old as { order_id?: number } | null;
          const changedOrderId = newRecord?.order_id ?? oldRecord?.order_id;

          if (!changedOrderId) return;

          const belongsToRestaurant = orderIdsRef.current.includes(changedOrderId);
          if (!belongsToRestaurant) return;

          scheduleOrdersRefresh(80);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuItemsChannel);
      supabase.removeChannel(orderItemsChannel);

      if (ordersRefreshTimeoutRef.current) {
        clearTimeout(ordersRefreshTimeoutRef.current);
        ordersRefreshTimeoutRef.current = null;
      }

      if (menuRefreshTimeoutRef.current) {
        clearTimeout(menuRefreshTimeoutRef.current);
        menuRefreshTimeoutRef.current = null;
      }
    };
  }, [restaurantId, isSetupDone]);

  async function handleInitialSetup(e: React.FormEvent) {
    e.preventDefault();

    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    if (!setupRestaurantName.trim()) {
      showToast("Please enter restaurant name", "error");
      return;
    }

    if (!setupOwnerPassword.trim()) {
      showToast("Please enter owner password", "error");
      return;
    }

    if (!setupWaiterPassword.trim()) {
      showToast("Please enter waiter password", "error");
      return;
    }

    if (!setupKitchenPassword.trim()) {
      showToast("Please enter kitchen password", "error");
      return;
    }

    setSettingUpRestaurant(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        name: setupRestaurantName.trim(),
        owner_password: setupOwnerPassword.trim(),
        waiter_password: setupWaiterPassword.trim(),
        kitchen_password: setupKitchenPassword.trim(),
        is_setup_done: true,
      })
      .eq("id", restaurantId);

    setSettingUpRestaurant(false);

    if (error) {
      showToast("Failed to complete restaurant setup", "error");
      return;
    }

    setRestaurantName(setupRestaurantName.trim());
    setOwnerPasswordFromDB(setupOwnerPassword.trim());
    setNewOwnerPassword(setupOwnerPassword.trim());
    setNewWaiterPassword(setupWaiterPassword.trim());
    setNewKitchenPassword(setupKitchenPassword.trim());
    setIsSetupDone(true);
    showToast("Restaurant setup completed", "success");
    fetchRestaurant();
  }

  function unlockOwner() {
    if (!ownerPasswordFromDB || ownerPasswordFromDB === "setup_pending") {
      showToast("Owner password not found. Please complete setup first.", "error");
      return;
    }

    if (ownerPasswordInput === ownerPasswordFromDB) {
      setOwnerUnlocked(true);
      setOwnerPasswordInput("");
      setOwnerView("dashboard");

      if (restaurantId) {
        localStorage.setItem(`owner_logged_in_${restaurantId}`, "true");
      }

      showToast("Owner access granted", "success");
    } else {
      showToast("Wrong password", "error");
    }
  }

  function logoutOwner() {
    if (restaurantId) {
      localStorage.removeItem(`owner_logged_in_${restaurantId}`);
    }

    setOwnerUnlocked(false);
    setOwnerView("dashboard");
    setPopupView(null);
    setShowHeaderMenu(false);
    setEditingMenuId(null);
    setEditingItemName("");
    setEditingItemPrice("");
    setOwnerPasswordInput("");
    setHoveredTrendPoint(null);
    setHoveredHourlyPoint(null);
    setTableSearch("");
    setIsSwitching(false);
  }

  async function handleAddMenuItem(e: React.FormEvent) {
    e.preventDefault();

    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    if (!newItemName.trim()) {
      showToast("Please enter item name", "error");
      return;
    }

    if (!newItemPrice.trim() || Number(newItemPrice) <= 0) {
      showToast("Please enter valid price", "error");
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
      showToast("Failed to add menu item", "error");
      return;
    }

    setNewItemName("");
    setNewItemPrice("");
    fetchMenu();
    showToast("Menu item added", "success");
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
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    if (!editingItemName.trim()) {
      showToast("Please enter item name", "error");
      return;
    }

    if (!editingItemPrice.trim() || Number(editingItemPrice) <= 0) {
      showToast("Please enter valid price", "error");
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
      showToast("Failed to update menu item", "error");
      return;
    }

    cancelEditMenuItem();
    fetchMenu();
    showToast("Menu item updated", "success");
  }

  async function deleteMenuItem(id: number) {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    const confirmDelete = await askConfirm("Delete this menu item?", "Delete", "Keep");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      showToast("Failed to delete menu item", "error");
      return;
    }

    fetchMenu();
    showToast("Menu item deleted", "success");
  }

  function getLocalDateString(dateValue: string) {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getDateWithOffset(offsetDays: number) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatHourLabel(hour: number) {
    const normalized = ((hour % 24) + 24) % 24;
    const suffix = normalized >= 12 ? "PM" : "AM";
    const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
    return `${displayHour} ${suffix}`;
  }

  function formatHourShort(hour: number) {
    const normalized = ((hour % 24) + 24) % 24;
    const suffix = normalized >= 12 ? "PM" : "AM";
    const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
    return `${displayHour}${suffix}`;
  }

  function getNiceCeiling(value: number) {
    if (value <= 0) return 1000;
    if (value <= 100) return 100;
    if (value <= 500) return Math.ceil(value / 100) * 100;
    if (value <= 2000) return Math.ceil(value / 250) * 250;
    if (value <= 10000) return Math.ceil(value / 500) * 500;
    return Math.ceil(value / 1000) * 1000;
  }

  function startOfDay(dateValue = new Date()) {
    const d = new Date(dateValue);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(dateValue: Date, days: number) {
    const d = new Date(dateValue);
    d.setDate(d.getDate() + days);
    return d;
  }

  const todayLocalDate = getTodayLocalDate();
  const yesterdayLocalDate = getDateWithOffset(-1);

  const todayOrders = useMemo(() => {
    return orders.filter((order) => getLocalDateString(order.created_at) === todayLocalDate);
  }, [orders, todayLocalDate]);

  const yesterdayOrders = useMemo(() => {
    return orders.filter(
      (order) => getLocalDateString(order.created_at) === yesterdayLocalDate
    );
  }, [orders, yesterdayLocalDate]);

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
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + revenue;
    }, 0);
  }, [todayOrders]);


  const filteredTakeOrderMenuItems = useMemo(() => {
    const keyword = takeOrderSearch.trim().toLowerCase();

    if (!keyword) return menuItems;

    return menuItems.filter((item) =>
      item.item_name.toLowerCase().includes(keyword)
    );
  }, [menuItems, takeOrderSearch]);

  const popularTakeOrderItems = useMemo(() => {
    const countMap: Record<number, number> = {};

    orders.forEach((order) => {
      order.order_items?.forEach((orderItem) => {
        const matchedMenu = menuItems.find(
          (menu) => menu.item_name.toLowerCase() === orderItem.item_name.toLowerCase()
        );

        if (!matchedMenu) return;

        countMap[matchedMenu.id] =
          (countMap[matchedMenu.id] || 0) + Number(orderItem.quantity || 0);
      });
    });

    return [...menuItems]
      .sort((a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0))
      .slice(0, 8);
  }, [orders, menuItems]);

  const takeOrderCartCount = useMemo(() => {
    return takeOrderItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [takeOrderItems]);

  const takeOrderCartTotal = useMemo(() => {
    return takeOrderItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  }, [takeOrderItems]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (showTakeOrderModal || reportOrder || showQR) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showTakeOrderModal, reportOrder, selectedPaidOrder, showQR]);

const todayPaidOrders = useMemo(() => {
  return orders.filter(
    (order) =>
      order.is_paid === true &&
      order.paid_at &&
      getLocalDateString(order.paid_at) === todayLocalDate
  );
}, [orders, todayLocalDate]);

const todayPaymentBreakdown = useMemo(() => {
  const totals = {
    cash: 0,
    qr: 0,
    card: 0,
  };

  todayPaidOrders.forEach((order) => {
    const orderTotal =
      order.order_items?.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0
      ) || 0;

    const method =
      order.payment_method === "qr" || order.payment_method === "card"
        ? order.payment_method
        : "cash";

    totals[method] += orderTotal;
  });

  const total = totals.cash + totals.qr + totals.card;

  return {
    ...totals,
    cashPercent: total > 0 ? ((totals.cash / total) * 100).toFixed(1) : "0.0",
    qrPercent: total > 0 ? ((totals.qr / total) * 100).toFixed(1) : "0.0",
    cardPercent: total > 0 ? ((totals.card / total) * 100).toFixed(1) : "0.0",
  };
}, [todayPaidOrders]);

  const totalRevenueYesterday = useMemo(() => {
    return yesterdayOrders.reduce((sum, order) => {
      const revenue =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + revenue;
    }, 0);
  }, [yesterdayOrders]);

  const salesVsYesterday = useMemo(() => {
    const diff = totalRevenueToday - totalRevenueYesterday;

    if (totalRevenueYesterday <= 0) {
      if (totalRevenueToday > 0) {
        return {
          text: `+Rs. ${diff} vs yesterday`,
          className: "text-emerald-600",
        };
      }

      return {
        text: "Rs. 0 vs yesterday",
        className: "text-slate-500",
      };
    }

    const percentage = Math.abs((diff / totalRevenueYesterday) * 100).toFixed(1);

    if (diff > 0) {
      return {
        text: `+${percentage}% vs yesterday`,
        className: "text-emerald-600",
      };
    }

    if (diff < 0) {
      return {
        text: `-${percentage}% vs yesterday`,
        className: "text-rose-600",
      };
    }

    return {
      text: "0% vs yesterday",
      className: "text-slate-500",
    };
  }, [totalRevenueToday, totalRevenueYesterday]);

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

  useEffect(() => {
    orderIdsRef.current = orders.map((order) => order.id);
  }, [orders]);

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

  const hourlySalesTrend = useMemo(() => {
    const salesByHour: Record<number, number> = {};

    todayOrders.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      const total =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;

      salesByHour[hour] = (salesByHour[hour] || 0) + total;
    });

    const orderHours = todayOrders.map((order) => new Date(order.created_at).getHours());

    let startHour = 10;
    let endHour = 22;

    if (orderHours.length > 0) {
      startHour = Math.max(0, Math.min(...orderHours) - 1);
      endHour = Math.min(23, Math.max(...orderHours) + 1);
    }

    if (endHour - startHour < 5) {
      startHour = Math.max(0, startHour - 2);
      endHour = Math.min(23, endHour + 2);
    }

    const points: HourlyTrendPoint[] = [];

    for (let hour = startHour; hour <= endHour; hour++) {
      points.push({
        hour,
        label: formatHourLabel(hour),
        shortLabel: formatHourShort(hour),
        sales: salesByHour[hour] || 0,
      });
    }

    return points;
  }, [todayOrders]);

  const groupedTableOrders = useMemo(() => {
    const normalizeKitchenStatus = (value?: string | null): KitchenStatusKey => {
      if (value === "ready") return "ready";
      if (value === "preparing") return "preparing";
      return "pending";
    };

    const tableStatusPriority: Record<KitchenStatusKey, number> = {
      preparing: 3,
      pending: 2,
      ready: 1,
    };

    const unpaidOnly = orders.filter((order) => order.is_paid !== true);
    const map: Record<string, GroupedTableOrder> = {};

    unpaidOnly.forEach((order) => {
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
          table_status: normalizeKitchenStatus(order.status),
        };
      }

      map[tableNo].order_ids.push(order.id);
      map[tableNo].unpaid_orders_count += 1;

      if (order.remarks && order.remarks.trim()) {
        map[tableNo].remarks.push(order.remarks.trim());
      }

      const orderLevelStatus = normalizeKitchenStatus(order.status);
      if (tableStatusPriority[orderLevelStatus] > tableStatusPriority[map[tableNo].table_status]) {
        map[tableNo].table_status = orderLevelStatus;
      }

      order.order_items?.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal = quantity * unitPrice;
        const itemStatus = normalizeKitchenStatus(item.status || order.status);

        const existingItem = map[tableNo].items.find(
          (entry) => entry.item_name === item.item_name && entry.status === itemStatus
        );

        if (existingItem) {
          existingItem.quantity += quantity;
          existingItem.total += lineTotal;
        } else {
          map[tableNo].items.push({
            item_name: item.item_name,
            quantity,
            total: lineTotal,
            status: itemStatus,
          });
        }

        if (tableStatusPriority[itemStatus] > tableStatusPriority[map[tableNo].table_status]) {
          map[tableNo].table_status = itemStatus;
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


const kitchenQueue = useMemo(() => {
  return groupedTableOrders
    .map((table) => {
      const relatedOrders = orders
        .filter(
          (order) =>
            String(order.table_number || "").trim() === table.table_number &&
            order.is_paid !== true
        )
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

      const oldestCreatedAt = relatedOrders[0]?.created_at || "";
      const visibleItems = table.items.sort((a, b) => a.item_name.localeCompare(b.item_name));

      return {
        ...table,
        items: visibleItems,
        oldestCreatedAt,
      };
    })
    .filter((table) => table.table_status !== "ready")
    .sort((a, b) => {
      const aTime = a.oldestCreatedAt ? new Date(a.oldestCreatedAt).getTime() : 0;
      const bTime = b.oldestCreatedAt ? new Date(b.oldestCreatedAt).getTime() : 0;
      return aTime - bTime;
    });
}, [groupedTableOrders, orders]);

async function updateKitchenTableStatus(
  tableNo: string,
  nextStatus: KitchenStatusKey
) {
  if (!restaurantId) {
    showToast("Invalid restaurant link", "error");
    return;
  }

  if (kitchenUpdatingTable === tableNo) return;

  const targetOrders = orders.filter(
    (order) =>
      String(order.table_number || "").trim() === tableNo &&
      order.is_paid !== true
  );

  if (targetOrders.length === 0) {
    showToast("No active kitchen order found", "error");
    return;
  }

  const currentTableStatus = targetOrders.some((order) => order.status === "preparing")
    ? "preparing"
    : targetOrders.length > 0 && targetOrders.every((order) => order.status === "ready")
      ? "ready"
      : "pending";

  if (currentTableStatus === nextStatus) {
    return;
  }

  const orderIds = targetOrders.map((order) => order.id);
  const previousOrdersSnapshot = orders;

  setKitchenUpdatingTable(tableNo);
  setKitchenUpdatingStatus(nextStatus);

  setOrders((prev) =>
    prev.map((order) => {
      if (String(order.table_number || "").trim() !== tableNo || order.is_paid === true) {
        return order;
      }

      return {
        ...order,
        status: nextStatus,
        order_items: (order.order_items || []).map((item) => ({
          ...item,
          status: nextStatus,
        })),
      };
    })
  );

  const [orderResult, itemResult] = await Promise.all([
    supabase
      .from("orders")
      .update({ status: nextStatus })
      .in("id", orderIds)
      .eq("restaurant_id", restaurantId),
    supabase
      .from("order_items")
      .update({ status: nextStatus })
      .in("order_id", orderIds),
  ]);

  const orderError = orderResult.error;
  const itemError = itemResult.error;

  if (orderError || itemError) {
    setOrders(previousOrdersSnapshot);
    showToast("Failed to update kitchen status", "error");
    setKitchenUpdatingTable(null);
    setKitchenUpdatingStatus(null);
    return;
  }

  await fetchOrders();
  showToast(`Table ${tableNo} moved to ${nextStatus}`, "success");
  setKitchenUpdatingTable(null);
  setKitchenUpdatingStatus(null);
}

  const kitchenStatusSummary = useMemo(() => {
    return groupedTableOrders.reduce(
      (acc, table) => {
        acc[table.table_status] += 1;
        return acc;
      },
      { pending: 0, preparing: 0, ready: 0 } as Record<KitchenStatusKey, number>
    );
  }, [groupedTableOrders]);

  const filteredKitchenTables = useMemo(() => {
    if (kitchenStatusFilter === "all") return groupedTableOrders;
    return groupedTableOrders.filter((table) => table.table_status === kitchenStatusFilter);
  }, [groupedTableOrders, kitchenStatusFilter]);

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
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    const normalizedTableNo = tableNo.trim();

    if (!normalizedTableNo) {
      showToast("Invalid table number", "error");
      return;
    }

    const unpaidOrdersForTable = orders.filter(
      (order) =>
        String(order.table_number).trim() === normalizedTableNo &&
        order.is_paid !== true
    );

    if (unpaidOrdersForTable.length === 0) {
      showToast("No unpaid orders found for this table", "error");
      return;
    }

    const confirmPay = await askConfirm(
      `Mark all unpaid orders for table ${normalizedTableNo} as paid with ${paymentMethod.toUpperCase()}?`,
      "Mark paid",
      "Back"
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
      showToast("Failed to mark orders as paid", "error");
      return;
    }

    await fetchOrders();
    showToast(`Table ${normalizedTableNo} marked as paid`, "success");
  }

  async function savePasswords() {
    if (!restaurantId) {
      showToast("Invalid restaurant link", "error");
      return;
    }

    if (!newOwnerPassword.trim()) {
      showToast("Please enter owner password", "error");
      return;
    }

    setSavingPasswords(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        owner_password: newOwnerPassword.trim(),
      })
      .eq("id", restaurantId);

    setSavingPasswords(false);

    if (error) {
      showToast("Failed to update owner password", "error");
      return;
    }

    setOwnerPasswordFromDB(newOwnerPassword.trim());
    showToast("Owner password updated successfully", "success");
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

  function formatShortDateWithDay(dateValue: Date) {
    const dayName = dateValue.toLocaleDateString(undefined, { weekday: "short" });
    const dateLabel = dateValue.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return {
      dayName,
      dateLabel,
      fullLabel: `${dayName}, ${dateLabel}`,
    };
  }

  const unpaidTablesCount = groupedTableOrders.length;
  const unpaidAmount = groupedTableOrders.reduce((sum, table) => sum + table.total, 0);
  const avgOrderValueToday =
    totalOrdersToday > 0 ? Math.round(totalRevenueToday / totalOrdersToday) : 0;

  const peakHourLabel = useMemo(() => {
    if (todayOrders.length === 0) return "-";

    const hourMap: Record<number, number> = {};

    todayOrders.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });

    const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
    if (!peakHour) return "-";

    const hourNum = Number(peakHour[0]);
    const from = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const toHour = (hourNum + 1) % 24;
    const to = toHour % 12 === 0 ? 12 : toHour % 12;
    const fromSuffix = hourNum >= 12 ? "PM" : "AM";
    const toSuffix = toHour >= 12 ? "PM" : "AM";

    return `${from} ${fromSuffix} - ${to} ${toSuffix}`;
  }, [todayOrders]);

  const recentActivity = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  const selectedSalesOrders = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    if (salesPeriod === "day") {
      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        return getLocalDateString(order.paid_at) === getLocalDateString(todayStart.toISOString());
      });
    }

    if (salesPeriod === "week") {
      const weekStart = addDays(todayStart, -6);
      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        const paidDate = startOfDay(new Date(order.paid_at));
        return paidDate >= weekStart && paidDate <= todayStart;
      });
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return paidOrders.filter((order) => {
      if (!order.paid_at) return false;
      const paidDate = startOfDay(new Date(order.paid_at));
      return paidDate >= monthStart && paidDate <= todayStart;
    });
  }, [paidOrders, salesPeriod]);

  const previousSalesOrders = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    if (salesPeriod === "day") {
      const prevDay = addDays(todayStart, -1);
      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        return getLocalDateString(order.paid_at) === getLocalDateString(prevDay.toISOString());
      });
    }

    if (salesPeriod === "week") {
      const currentWeekStart = addDays(todayStart, -6);
      const previousWeekStart = addDays(currentWeekStart, -7);
      const previousWeekEnd = addDays(currentWeekStart, -1);

      return paidOrders.filter((order) => {
        if (!order.paid_at) return false;
        const paidDate = startOfDay(new Date(order.paid_at));
        return paidDate >= previousWeekStart && paidDate <= previousWeekEnd;
      });
    }

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return paidOrders.filter((order) => {
      if (!order.paid_at) return false;
      const paidDate = startOfDay(new Date(order.paid_at));
      return paidDate >= prevMonthStart && paidDate <= prevMonthEnd;
    });
  }, [paidOrders, salesPeriod]);

  const selectedSalesSummary = useMemo(() => {
    const totalSales = selectedSalesOrders.reduce((sum, order) => {
      const total =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + total;
    }, 0);

    const previousSales = previousSalesOrders.reduce((sum, order) => {
      const total =
        order.order_items?.reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      return sum + total;
    }, 0);

    const totalOrders = selectedSalesOrders.length;

    const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    const itemMap: Record<string, SalesItem> = {};

    selectedSalesOrders.forEach((order) => {
      order.order_items?.forEach((item) => {
        if (!itemMap[item.item_name]) {
          itemMap[item.item_name] = {
            item_name: item.item_name,
            total_quantity: 0,
            total_revenue: 0,
          };
        }

        itemMap[item.item_name].total_quantity += Number(item.quantity || 0);
        itemMap[item.item_name].total_revenue +=
          Number(item.quantity || 0) * Number(item.unit_price || 0);
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => {
        if (b.total_quantity !== a.total_quantity) {
          return b.total_quantity - a.total_quantity;
        }
        return b.total_revenue - a.total_revenue;
      })
      .slice(0, 5);

    let comparisonText = "0% vs previous period";
    let comparisonClass = "text-slate-500";

    if (previousSales <= 0) {
      if (totalSales > 0) {
        comparisonText = `+Rs. ${totalSales} vs previous period`;
        comparisonClass = "text-emerald-600";
      }
    } else {
      const diff = totalSales - previousSales;
      const percentage = Math.abs((diff / previousSales) * 100).toFixed(1);

      if (diff > 0) {
        comparisonText = `+${percentage}% vs previous period`;
        comparisonClass = "text-emerald-600";
      } else if (diff < 0) {
        comparisonText = `-${percentage}% vs previous period`;
        comparisonClass = "text-rose-600";
      }
    }

    return {
      totalSales,
      totalOrders,
      avgOrderValue,
      topItems,
      bestSeller: topItems[0]?.item_name || "-",
      comparisonText,
      comparisonClass,
    };
  }, [selectedSalesOrders, previousSalesOrders]);

  const selectedSalesTrend = useMemo(() => {
    const now = new Date();

    if (salesPeriod === "day") {
      const salesByHour: Record<number, number> = {};
      selectedSalesOrders.forEach((order) => {
        const hour = new Date(order.paid_at || order.created_at).getHours();
        const total =
          order.order_items?.reduce(
            (sum, item) =>
              sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;
        salesByHour[hour] = (salesByHour[hour] || 0) + total;
      });

      const points = [];
      for (let hour = 0; hour <= 23; hour++) {
        points.push({
          label: formatHourShort(hour),
          fullLabel: formatHourLabel(hour),
          sales: salesByHour[hour] || 0,
        });
      }
      return points;
    }

    if (salesPeriod === "week") {
      const salesByDate: Record<string, number> = {};
      selectedSalesOrders.forEach((order) => {
        if (!order.paid_at) return;
        const key = getLocalDateString(order.paid_at);
        const total =
          order.order_items?.reduce(
            (sum, item) =>
              sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;
        salesByDate[key] = (salesByDate[key] || 0) + total;
      });

      const points = [];
      for (let i = 6; i >= 0; i--) {
        const d = addDays(startOfDay(now), -i);
        const key = getLocalDateString(d.toISOString());
        points.push({
          label: d.toLocaleDateString(undefined, { weekday: "short" }),
          fullLabel: d.toLocaleDateString(),
          sales: salesByDate[key] || 0,
        });
      }
      return points;
    }

    const salesByDate: Record<string, number> = {};
    selectedSalesOrders.forEach((order) => {
      if (!order.paid_at) return;
      const key = getLocalDateString(order.paid_at);
      const total =
        order.order_items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        ) || 0;
      salesByDate[key] = (salesByDate[key] || 0) + total;
    });

    const totalDays = now.getDate();
    const points = [];
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      const key = getLocalDateString(d.toISOString());
      points.push({
        label: `${day}`,
        fullLabel: d.toLocaleDateString(),
        sales: salesByDate[key] || 0,
      });
    }

    return points;
  }, [selectedSalesOrders, salesPeriod]);

  const salesDetailBoxes = useMemo(() => {
    const now = new Date();

    if (salesPeriod === "day") {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeLabel = now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      const todaySalesTillNow = paidOrders.reduce((sum, order) => {
        if (!order.paid_at) return sum;
        const paidDate = new Date(order.paid_at);
        if (getLocalDateString(order.paid_at) !== todayLocalDate) return sum;
        if (paidDate.getTime() > now.getTime()) return sum;

        const orderTotal =
          order.order_items?.reduce(
            (itemSum, item) =>
              itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;

        return sum + orderTotal;
      }, 0);

      const todayInfo = formatShortDateWithDay(now);

      return [
        {
          key: `day-${todayLocalDate}`,
          label: todayInfo.fullLabel,
          sublabel: `Sales till ${currentTimeLabel}`,
          sales: todaySalesTillNow,
          cardClass: "border-slate-200 bg-white",
          badgeClass: "bg-slate-100 text-slate-700",
          badgeText: `${formatHourShort(currentHour)}${currentMinute > 0 ? `:${String(currentMinute).padStart(2, "0")}` : ""}`,
        },
      ];
    }

    const totalDays = salesPeriod === "week" ? 7 : now.getDate();
    const points: {
  key: string;
  label: string;
  sublabel: string;
  sales: number;
}[] = [];

    for (let offset = totalDays - 1; offset >= 0; offset--) {
      const dateObj = addDays(startOfDay(now), -offset);
      const dateKey = getLocalDateString(dateObj.toISOString());
      const info = formatShortDateWithDay(dateObj);

      const sales = paidOrders.reduce((sum, order) => {
        if (!order.paid_at) return sum;
        if (getLocalDateString(order.paid_at) !== dateKey) return sum;

        const orderTotal =
          order.order_items?.reduce(
            (itemSum, item) =>
              itemSum + Number(item.quantity || 0) * Number(item.unit_price || 0),
            0
          ) || 0;

        return sum + orderTotal;
      }, 0);

      points.push({
        key: `${salesPeriod}-${dateKey}`,
        label: info.fullLabel,
        sublabel: salesPeriod === "week" ? "Daily total" : "Month daily total",
        sales,
      });
    }

    return points.map((point, index) => {
      if (index === 0) {
        return {
          ...point,
          cardClass: "border-slate-200 bg-white",
          badgeClass: "bg-slate-100 text-slate-700",
          badgeText: "Start",
        };
      }

      const previousSales = points[index - 1].sales;

      if (point.sales > previousSales) {
        return {
          ...point,
          cardClass: "border-emerald-200 bg-emerald-50",
          badgeClass: "bg-emerald-100 text-emerald-700",
          badgeText: "Up",
        };
      }

      if (point.sales < previousSales) {
        return {
          ...point,
          cardClass: "border-rose-200 bg-rose-50",
          badgeClass: "bg-rose-100 text-rose-700",
          badgeText: "Down",
        };
      }

      return {
        ...point,
        cardClass: "border-slate-300 bg-slate-100",
        badgeClass: "bg-slate-200 text-slate-700",
        badgeText: "Same",
      };
    });
  }, [paidOrders, salesPeriod, todayLocalDate]);

  const selectedTrendMaxSales = useMemo(() => {
    if (selectedSalesTrend.length === 0) return 0;
    return getNiceCeiling(Math.max(...selectedSalesTrend.map((item) => item.sales), 0));
  }, [selectedSalesTrend]);

  function iconBubble(icon: string, bg: string) {
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-base ${bg}`}
      >
        {icon}
      </span>
    );
  }

function bottomNavButtonClass(view: OwnerView) {
  const active = ownerView === view;
  return `flex flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2.5 text-[12px] font-semibold transition-all ${
    active
      ? "bg-slate-900 text-white shadow-[0_14px_34px_rgba(15,23,42,0.24)]"
      : "bg-white text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]"
  }`;
}

  function paymentButtonClass(tableNo: string, method: "cash" | "qr" | "card") {
    const selected = tablePaymentMethods[tableNo] || "cash";

    return `py-2.5 rounded-2xl text-sm font-semibold border ${
      selected === method
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-slate-700 border-slate-200"
    }`;
  }

  function salesPeriodButtonClass(period: SalesPeriod) {
    const active = salesPeriod === period;
    return `rounded-2xl px-3 py-2 text-sm font-semibold ${
      active ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
    }`;
  }

  function statCard(
    title: string,
    value: string | number,
    icon: string,
    cardClass = "bg-white border border-slate-200"
  ) {
    return (
      <div className={`rounded-[24px] p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.07)] ${cardClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">{title}</p>
            <p className="mt-1 break-words text-base font-bold text-slate-900">{value}</p>
          </div>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm">
            {icon}
          </span>
        </div>
      </div>
    );
  }

  function sectionTitle(title: string, subtitle: string, icon: string) {
    return (
      <div className="flex items-start gap-3.5">
        <div className="shrink-0">{iconBubble(icon, "bg-blue-50")}</div>
        <div>
          <h2 className="text-[17px] font-extrabold tracking-tight text-slate-900">{title}</h2>
          <p className="text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
      </div>
    );
  }

  function renderHourlyAreaChart() {
    const hourlyChartMaxSales =
      hourlySalesTrend.length === 0
        ? 0
        : getNiceCeiling(Math.max(...hourlySalesTrend.map((item) => item.sales), 0));

    const hourlyChartPoints = hourlySalesTrend.map((point, index) => {
      const max = hourlyChartMaxSales || 1;
      const x =
        hourlySalesTrend.length === 1
          ? 10
          : 10 + (index / Math.max(hourlySalesTrend.length - 1, 1)) * 86;
      const y = 90 - (point.sales / max) * 72;

      return {
        ...point,
        x,
        y,
      };
    });

    const hourlyLinePath = hourlyChartPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const hourlyAreaPath =
      hourlyChartPoints.length > 0
        ? [
            `M ${hourlyChartPoints[0].x} 90`,
            ...hourlyChartPoints.map((point) => `L ${point.x} ${point.y}`),
            `L ${hourlyChartPoints[hourlyChartPoints.length - 1].x} 90`,
            "Z",
          ].join(" ")
        : "";

    return (
      <div className="relative h-[170px] w-full rounded-[22px] border border-slate-200 bg-slate-50 p-2.5">
        {hoveredHourlyPoint && (
          <div
            className="absolute z-10 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{
              left: `${Math.min(Math.max(hoveredHourlyPoint.x, 12), 88)}%`,
              top: `${Math.min(Math.max(hoveredHourlyPoint.y - 6, 10), 76)}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p>{hoveredHourlyPoint.label}</p>
            <p>Rs. {hoveredHourlyPoint.sales}</p>
          </div>
        )}

        {hourlySalesTrend.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No hourly sales data for today.
          </div>
        ) : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="hourlyAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map((ratio) => {
              const y = 90 - ratio * 72;
              const value = Math.round((hourlyChartMaxSales || 1000) * ratio);
              return (
                <g key={`${ratio}-${value}`}>
                  <line
                    x1="10"
                    y1={y}
                    x2="96"
                    y2={y}
                    stroke="#dbeafe"
                    strokeWidth="0.5"
                    strokeDasharray="1.5 1.5"
                  />
                  <text
                    x="8.3"
                    y={y + 1.2}
                    textAnchor="end"
                    fontSize="3"
                    fill="#64748b"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <line x1="10" y1="18" x2="10" y2="90" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="10" y1="90" x2="96" y2="90" stroke="#94a3b8" strokeWidth="0.7" />

            {hourlyAreaPath && <path d={hourlyAreaPath} fill="url(#hourlyAreaFill)" />}
            {hourlyLinePath && (
              <path
                d={hourlyLinePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {hourlyChartPoints.map((point) => (
              <g key={point.hour}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1.8"
                  fill="#1d4ed8"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() =>
                    setHoveredHourlyPoint({
                      hour: point.hour,
                      label: point.label,
                      sales: point.sales,
                      x: point.x,
                      y: point.y,
                    })
                  }
                  onMouseLeave={() => setHoveredHourlyPoint(null)}
                />
                <text
                  x={point.x}
                  y="95.5"
                  textAnchor="middle"
                  fontSize="2.5"
                  fill="#64748b"
                >
                  {point.shortLabel}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    );
  }

  function renderCompactTrendChart() {
    const chartPoints = selectedSalesTrend.map((point, index) => {
      const max = selectedTrendMaxSales || 1;
      const x =
        selectedSalesTrend.length === 1
          ? 8
          : 8 + (index / Math.max(selectedSalesTrend.length - 1, 1)) * 86;
      const y = 88 - (point.sales / max) * 66;
      return { ...point, x, y };
    });

    const linePath = chartPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const areaPath =
      chartPoints.length > 0
        ? [
            `M ${chartPoints[0].x} 88`,
            ...chartPoints.map((point) => `L ${point.x} ${point.y}`),
            `L ${chartPoints[chartPoints.length - 1].x} 88`,
            "Z",
          ].join(" ")
        : "";

    return (
      <div className="relative h-[170px] w-full rounded-[22px] border border-slate-200 bg-slate-50 p-2.5">
        {hoveredTrendPoint && (
          <div
            className="absolute z-10 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{
              left: `${Math.min(Math.max(hoveredTrendPoint.x, 10), 86)}%`,
              top: `${Math.min(Math.max(hoveredTrendPoint.y - 6, 8), 74)}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p>{hoveredTrendPoint.label}</p>
            <p>Rs. {hoveredTrendPoint.sales}</p>
          </div>
        )}

        {selectedSalesTrend.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No trend data.
          </div>
        ) : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="salesCompactFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {[0, 0.5, 1].map((ratio) => {
              const y = 88 - ratio * 66;
              const value = Math.round((selectedTrendMaxSales || 1000) * ratio);
              return (
                <g key={`${ratio}-${value}`}>
                  <line
                    x1="8"
                    y1={y}
                    x2="96"
                    y2={y}
                    stroke="#dbeafe"
                    strokeWidth="0.5"
                    strokeDasharray="1.5 1.5"
                  />
                  <text
                    x="6.2"
                    y={y + 1.2}
                    textAnchor="end"
                    fontSize="2.8"
                    fill="#64748b"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <line x1="8" y1="20" x2="8" y2="88" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="8" y1="88" x2="96" y2="88" stroke="#94a3b8" strokeWidth="0.7" />

            {areaPath && <path d={areaPath} fill="url(#salesCompactFill)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {chartPoints.map((point, index) => (
  <g key={`${point.fullLabel}-${point.label}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1.8"
                  fill="#1d4ed8"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() =>
                    setHoveredTrendPoint({
                      label: point.fullLabel,
                      sales: point.sales,
                      x: point.x,
                      y: point.y,
                    })
                  }
                  onMouseLeave={() => setHoveredTrendPoint(null)}
                />
              {index % 3 === 0 && (
  <text
    x={point.x}
    y="97"
    textAnchor="middle"
    fontSize="3.6"
    fill="#334155"
  >
    {point.label}
  </text>
)}
              </g>
            ))}
          </svg>
        )}
      </div>
    );
  }

  function getKitchenStatusBadgeClass(status: KitchenStatusKey) {
    if (status === "ready") return "bg-emerald-100 text-emerald-700";
    if (status === "preparing") return "bg-amber-100 text-amber-700";
    return "bg-slate-200 text-slate-700";
  }

  function getKitchenStatusDotClass(status: KitchenStatusKey) {
    if (status === "ready") return "bg-emerald-500";
    if (status === "preparing") return "bg-amber-500";
    return "bg-slate-400";
  }

  function getKitchenStatusLabel(status: KitchenStatusKey) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function kitchenFilterButtonClass(filter: "all" | KitchenStatusKey) {
    const active = kitchenStatusFilter === filter;
    return `rounded-full px-3 py-2 text-[11px] font-semibold ${
      active ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
    }`;
  }


function renderKitchenStatusCards() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Table Queue</h3>
          
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
          {kitchenQueue.length} active
        </div>
      </div>

      {kitchenQueue.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          No kitchen queue right now.
        </div>
      ) : (
        <div className="space-y-3">
          {kitchenQueue.map((table, index) => {
            const isUpdatingKitchenTable = kitchenUpdatingTable === table.table_number;

            return (
            <div
              key={`kitchen-queue-${table.table_number}`}
              className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
            >
              {(index === 0 || index === 1) && (
                <div className="mb-3">
                  {index === 0 ? (
                    <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                      🔴 Oldest
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                      🟠 2nd Oldest
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-slate-900">Table {table.table_number}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {table.unpaid_orders_count} order(s) • {table.oldestCreatedAt ? new Date(table.oldestCreatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                  </p>
                </div>

                <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${getKitchenStatusBadgeClass(table.table_status)}`}>
                  {getKitchenStatusLabel(table.table_status)}
                </span>
              </div>

              <div className="mt-3 rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                <div className="space-y-2">
                  {table.items.map((item, itemIndex) => (
                    <div
                      key={`${table.table_number}-${item.item_name}-${itemIndex}`}
                      className="flex items-start justify-between gap-3 rounded-2xl bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.item_name}</p>
                        <p className="text-[11px] text-slate-500">Qty: {item.quantity}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {table.remarks.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">Remarks</p>
                    <div className="space-y-1">
                      {table.remarks.map((remark, remarkIndex) => (
                        <p
                          key={`${table.table_number}-remark-${remarkIndex}`}
                          className="text-[11px] font-medium text-slate-700"
                        >
                          • {remark}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isUpdatingKitchenTable}
                  onClick={() => updateKitchenTableStatus(table.table_number, "pending")}
                  className={`rounded-2xl py-2.5 text-xs font-bold transition ${
                    table.table_status === "pending"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  } ${isUpdatingKitchenTable ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]"}`}
                >
                  {isUpdatingKitchenTable && kitchenUpdatingStatus === "pending" ? "Updating..." : "Pending"}
                </button>
                <button
                  type="button"
                  disabled={isUpdatingKitchenTable}
                  onClick={() => updateKitchenTableStatus(table.table_number, "preparing")}
                  className={`rounded-2xl py-2.5 text-xs font-bold transition ${
                    table.table_status === "preparing"
                      ? "bg-amber-500 text-white"
                      : "border border-amber-300 bg-amber-50 text-amber-700"
                  } ${isUpdatingKitchenTable ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]"}`}
                >
                  {isUpdatingKitchenTable && kitchenUpdatingStatus === "preparing" ? "Updating..." : "Preparing"}
                </button>
                <button
                  type="button"
                  disabled={isUpdatingKitchenTable}
                  onClick={() => updateKitchenTableStatus(table.table_number, "ready")}
                  className={`rounded-2xl py-2.5 text-xs font-extrabold tracking-wide text-white shadow-md transition ${
                    table.table_status === "ready"
                      ? "bg-emerald-700"
                      : "bg-green-600"
                  } ${isUpdatingKitchenTable ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]"}`}
                >
                  {isUpdatingKitchenTable && kitchenUpdatingStatus === "ready" ? "Updating..." : "✅ Ready"}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderDashboardView() {

    return (
      <div className="space-y-4 pb-4">
        {sectionTitle("Dashboard", "Compact mobile-first business snapshot", "📊")}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">💰 Today Sales</p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-900">
                    Rs. {totalRevenueToday}
                  </p>
                  <p className={`mt-1 text-[11px] font-semibold ${salesVsYesterday.className}`}>
                    {salesVsYesterday.text}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  💰
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-blue-200 bg-blue-50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">💳 Today Sales Split</p>

                  <div className="mt-2 space-y-1.5 pr-1 text-[10px] text-slate-700">
                   <div className="flex items-center tabular-nums">
  <span className="w-9 shrink-0 font-medium text-slate-600">Cash</span>

  <span className="flex-1 text-right font-semibold text-slate-900 whitespace-nowrap pr-2">
    Rs. {todayPaymentBreakdown.cash}
  </span>

  <span className="w-[44px] shrink-0 text-right text-[9px] text-slate-500">
    ({todayPaymentBreakdown.cashPercent}%)
  </span>
</div>

                    <div className="flex items-center tabular-nums">
  <span className="w-9 shrink-0 font-medium text-slate-600">QR</span>

  <span className="flex-1 text-right font-semibold text-slate-900 whitespace-nowrap pr-2">
    Rs. {todayPaymentBreakdown.qr}
  </span>

  <span className="w-[44px] shrink-0 text-right text-[9px] text-slate-500">
    ({todayPaymentBreakdown.qrPercent}%)
  </span>
</div>

                 <div className="flex items-center tabular-nums">
  <span className="w-11 shrink-0 font-medium text-slate-600">Card</span>

  <span className="flex-1 text-right font-semibold text-slate-900 whitespace-nowrap pr-2">
    Rs. {todayPaymentBreakdown.card}
  </span>

  <span className="w-[44px] shrink-0 text-right text-[9px] text-slate-500">
    ({todayPaymentBreakdown.cardPercent}%)
  </span>
</div>
                  </div>
                </div>

                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  💳
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">⏳ Unpaid Amount</p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-900">
                    Rs. {unpaidAmount}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  ⏳
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-purple-200 bg-purple-50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">🔥 Best Seller</p>
                  <p className="mt-1 break-words text-base font-bold text-slate-900">
                    {bestSellingItem ? bestSellingItem.item_name : "-"}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-base">
                  🔥
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setKitchenStatusExpanded((prev) => !prev)}
              className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
            >
              <p className="text-[11px] font-medium text-slate-500">🍳 Kitchen Status</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  {kitchenStatusSummary.pending}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {kitchenStatusSummary.preparing}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {kitchenStatusSummary.ready}
                </span>
              </div>
            </button>

            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span>🍽️</span>
                  <span>Items Sold</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {totalItemsSoldToday}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span>🧾</span>
                  <span>Orders</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {totalOrdersToday}
                </span>
              </div>
            </div>
          </div>


          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {iconBubble("📈", "bg-blue-50")}
                <div>
                  <h3 className="font-bold text-slate-900">Sales Trend</h3>
                  <p className="text-xs text-slate-500">Minimal hourly chart</p>
                </div>
              </div>

              <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {peakHourLabel === "-" ? "No peak yet" : `Peak: ${peakHourLabel}`}
              </div>
            </div>

            {renderHourlyAreaChart()}
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              {iconBubble("📂", "bg-amber-50")}
              <div>
                <h3 className="font-bold text-slate-900">Live Updates</h3>
                <p className="text-xs text-slate-500">Compact mobile tab view</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDashboardMobileTab("unpaid")}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                  dashboardMobileTab === "unpaid"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Unpaid Tables
              </button>

              <button
                type="button"
                onClick={() => setDashboardMobileTab("activity")}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                  dashboardMobileTab === "activity"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Recent Activity
              </button>
            </div>

            {dashboardMobileTab === "unpaid" ? (
              groupedTableOrders.length === 0 ? (
                <p className="text-sm text-slate-500">No unpaid tables.</p>
              ) : (
                <div className="space-y-3">
                  {groupedTableOrders.slice(0, 5).map((table) => (
                    <div
                      key={table.table_number}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          Table {table.table_number}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {table.unpaid_orders_count} unpaid order(s)
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-slate-900">
                        Rs. {table.total}
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((order) => {
                  const total =
                    order.order_items?.reduce(
                      (sum, item) =>
                        sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
                      0
                    ) || 0;

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            Table {order.table_number}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            order.is_paid
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {order.is_paid ? "Paid" : "Unpaid"}
                        </span>
                      </div>

                      <p className="mt-2 text-right text-sm font-bold text-slate-900">
                        Rs. {total}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderSalesOverviewView() {
    const topItems = selectedSalesSummary.topItems;
    const highestQty = topItems.length > 0 ? topItems[0].total_quantity : 0;
    const lowestQty =
      topItems.length > 0 ? topItems[topItems.length - 1].total_quantity : 0;

    const titleMap: Record<SalesPeriod, string> = {
      day: "Today",
      week: "Last 7 Days",
      month: "This Month",
    };

    const detailSectionTitle =
      salesPeriod === "day"
        ? "Day Summary"
        : salesPeriod === "week"
        ? "Daily Sales Boxes"
        : "Month Daily Boxes";

    const detailSectionSubtitle =
      salesPeriod === "day"
        ? "Current time samma ko sales"
        : salesPeriod === "week"
        ? "Previous day sanga compare garera color dekhauxa"
        : "Each day ko sales compare garera color dekhauxa";

    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Sales Overview",
          "",
          "💹"
        )}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSalesPeriod("day")}
              className={salesPeriodButtonClass("day")}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setSalesPeriod("week")}
              className={salesPeriodButtonClass("week")}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setSalesPeriod("month")}
              className={salesPeriodButtonClass("month")}
            >
              Month
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm">
              <p className="text-[11px] font-medium text-slate-500">💰 Total Sales</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                Rs. {selectedSalesSummary.totalSales}
              </p>
              <p className={`mt-1 text-[11px] font-semibold ${selectedSalesSummary.comparisonClass}`}>
                {selectedSalesSummary.comparisonText}
              </p>
            </div>

            {statCard(
              "🧾 Orders",
              selectedSalesSummary.totalOrders,
              "🧾",
              "bg-blue-50 border border-blue-200"
            )}
            {statCard(
              "📦 Avg Order",
              `Rs. ${selectedSalesSummary.avgOrderValue}`,
              "📦",
              "bg-white border border-slate-200"
            )}
            {statCard(
              "🔥 Best Seller",
              selectedSalesSummary.bestSeller,
              "🔥",
              "bg-purple-50 border border-purple-200"
            )}
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              {iconBubble("📈", "bg-blue-50")}
              <div>
                <h3 className="font-bold text-slate-900">{titleMap[salesPeriod]} Trend</h3>
                <p className="text-xs text-slate-500">
                  {salesPeriod === "day"
                    ? "Hourly performance"
                    : salesPeriod === "week"
                    ? "Last 7 days"
                    : "Month to date"}
                </p>
              </div>
            </div>
            {renderCompactTrendChart()}
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              {iconBubble("🗂️", "bg-amber-50")}
              <div>
                <h3 className="font-bold text-slate-900">{detailSectionTitle}</h3>
                <p className="text-xs text-slate-500">{detailSectionSubtitle}</p>
              </div>
            </div>

            {salesDetailBoxes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No sales summary available.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {salesDetailBoxes.map((box) => (
                  <div
                    key={box.key}
                    className={`rounded-[16px] border px-3 py-2 shadow-sm ${box.cardClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold leading-snug text-slate-900">{box.label}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{box.sublabel}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-[2px] text-[10px] font-semibold ${box.badgeClass}`}
                      >
                        {box.badgeText}
                      </span>
                    </div>

                    <p className="mt-2 text-[13px] font-bold text-slate-900">Rs. {box.sales}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              {iconBubble("🍽️", "bg-green-50")}
              <div>
                <h3 className="font-bold text-slate-900">Top 5 Items {titleMap[salesPeriod]}</h3>
                <p className="text-xs text-slate-500">Summary boxes paxi item performance</p>
              </div>
            </div>

            {topItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No item sales for {salesPeriod === "day" ? "today" : salesPeriod === "week" ? "last 7 days" : "this month"}.
              </div>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, index) => {
                  const widthPercent =
                    highestQty > 0 ? (item.total_quantity / highestQty) * 100 : 0;

                  const isHighest = index === 0;
                  const isLowest = index === topItems.length - 1 && topItems.length > 1;

                const fillClass =
  index === 0
    ? "bg-emerald-500"
    : index === 1
    ? "bg-blue-500"
    : index === 2
    ? "bg-violet-500"
    : index === 3
    ? "bg-amber-500"
    : "bg-rose-500";

                  return (
                    <div
                      key={`${salesPeriod}-${item.item_name}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.item_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Qty: {item.total_quantity} • Rs. {item.total_revenue}
                          </p>
                        </div>

                        <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
  index === 0
    ? "bg-emerald-100 text-emerald-700"
    : index === 1
    ? "bg-blue-100 text-blue-700"
    : index === 2
    ? "bg-violet-100 text-violet-700"
    : index === 3
    ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700"
}`}
                        >
                          {index === 0
  ? "Top"
  : index === 1
  ? "2nd"
  : index === 2
  ? "3rd"
  : index === 3
  ? "4th"
  : "Low"}
                        </span>
                      </div>

                      <div className="h-5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`flex h-5 items-center justify-end rounded-full px-2 text-[10px] font-bold text-white ${fillClass}`}
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
          </div>
        </div>
      </div>
    );
  }


  function renderReportView() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Report",
          "Date-wise, custom range, item-wise, payment breakdown",
          "📝"
        )}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-5">
          <div className="rounded-[22px] border border-blue-200 bg-blue-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">Date-wise Report</h3>
              <span className="text-xs text-slate-600">
                {formatReportDateLabel(selectedReportDate)}
              </span>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={selectedReportDate}
                onChange={(e) => setSelectedReportDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {statCard("Total Sales", `Rs. ${reportData.totalSales}`, "💰")}
              {statCard("Paid Orders", reportData.paidOrdersCount, "✅")}
              {statCard("Items Sold", reportData.totalItemsSold, "🍽️")}
              {statCard("Avg Order", `Rs. ${reportData.averageOrderValue}`, "📦")}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-bold text-slate-900">Item-wise Report</h4>

              {reportData.itemWiseReport.length === 0 ? (
                <p className="text-sm text-slate-500">No paid orders found for this date.</p>
              ) : (
                <div className="space-y-3">
                  {reportData.itemWiseReport.map((item) => (
                    <div
                      key={item.item_name}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.item_name}</p>
                        <p className="text-sm text-slate-500">Qty: {item.total_quantity}</p>
                      </div>
                      <p className="font-bold text-slate-900">Rs. {item.total_revenue}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-bold text-slate-900">Payment Breakdown</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                  <span>Cash</span>
                  <span className="font-bold">Rs. {reportData.paymentTotals.cash}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                  <span>QR</span>
                  <span className="font-bold">Rs. {reportData.paymentTotals.qr}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                  <span>Card</span>
                  <span className="font-bold">Rs. {reportData.paymentTotals.card}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-orange-200 bg-orange-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">Custom Range Report</h3>
              <span className="text-xs text-slate-600">
                {formatRangeLabel(reportFromDate, reportToDate)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">From Date</label>
                <input
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">To Date</label>
                <input
                  type="date"
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                />
              </div>
            </div>

            {reportFromDate > reportToDate && (
              <p className="text-sm font-medium text-red-600">
                From date cannot be greater than To date.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {statCard(
                "Total Sales",
                `Rs. ${reportFromDate > reportToDate ? 0 : rangeReportData.totalSales}`,
                "💰"
              )}
              {statCard(
                "Paid Orders",
                reportFromDate > reportToDate ? 0 : rangeReportData.paidOrdersCount,
                "✅"
              )}
              {statCard(
                "Items Sold",
                reportFromDate > reportToDate ? 0 : rangeReportData.totalItemsSold,
                "🍽️"
              )}
              {statCard(
                "Avg Order",
                `Rs. ${reportFromDate > reportToDate ? 0 : rangeReportData.averageOrderValue}`,
                "📦"
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }


  function renderOrderView() {
    const activeOrders = orders
      .filter((order) => order.is_paid !== true)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
      <div className="space-y-3 pb-4">
        {sectionTitle("Order", "", "🍽️")}

        <div className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Live Bills</h3>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
              {activeOrders.length} Active
            </span>
          </div>

          {activeOrders.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No active order records yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activeOrders.map((order) => {
                const orderTotal =
                  order.order_items?.reduce(
                    (sum, item) =>
                      sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
                    0
                  ) || 0;
                const displayStatus = getOrderDisplayStatus(order);
                const itemPreview = (order.order_items || []).slice(0, 3);
                const moreCount = Math.max((order.order_items || []).length - 3, 0);
                const isLockedOrder = displayStatus === "preparing" || displayStatus === "ready";

                const statusClass =
                  displayStatus === "ready"
                    ? "bg-emerald-100 text-emerald-700"
                    : displayStatus === "preparing"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-700";

                return (
                  <div
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openOrderReport(order)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openOrderReport(order);
                      }
                    }}
                    className="min-h-[196px] rounded-[22px] bg-slate-50/90 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold leading-none text-slate-900">
                          Table {order.table_number}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {new Date(order.created_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${statusClass}`}>
                        {getKitchenStatusLabel(displayStatus)}
                      </span>
                    </div>

                    <div className="mt-3 rounded-[16px] bg-white px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                      {itemPreview.length === 0 ? (
                        <p className="text-[10px] text-slate-500">No items</p>
                      ) : (
                        <div className="space-y-1.5">
                          {itemPreview.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2">
                              <p className="truncate text-[10px] font-semibold text-slate-800">
                                {item.item_name} x {item.quantity}
                              </p>
                              <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                                Rs. {Number(item.quantity || 0) * Number(item.unit_price || 0)}
                              </span>
                            </div>
                          ))}
                          {moreCount > 0 && (
                            <p className="text-[9px] font-medium text-slate-500">+{moreCount} more item(s)</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total</p>
                        <p className="mt-1 text-[20px] font-bold leading-none text-slate-900">Rs. {orderTotal}</p>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openOrderReport(order);
                        }}
                        className="shrink-0 rounded-[12px] bg-blue-600 px-3 py-2 text-[10px] font-bold text-white shadow-sm"
                      >
                        Open
                      </button>
                    </div>

                    <div className="mt-2 min-h-[16px]">
                      {isLockedOrder ? (
                        <p className="text-[9px] font-semibold text-slate-500">
                          {displayStatus === "preparing"
                            ? "Preparing: edit/cancel locked"
                            : "Ready: edit/cancel locked"}
                        </p>
                      ) : order.remarks ? (
                        <p className="truncate text-[9px] font-medium text-amber-700">Remark: {order.remarks}</p>
                      ) : (
                        <p className="text-[9px] text-slate-400">Tap bill to open payment</p>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditOrder(order);
                        }}
                        disabled={editingOrderLoading || isLockedOrder}
                        className={`rounded-[12px] py-2 text-[10px] font-semibold ${
                          editingOrderLoading || isLockedOrder
                            ? "bg-slate-200 text-slate-400"
                            : "bg-white text-slate-700 ring-1 ring-slate-200"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCancelOrder(order.id);
                        }}
                        disabled={isLockedOrder}
                        className={`rounded-[12px] py-2 text-[10px] font-semibold ${
                          isLockedOrder
                            ? "bg-slate-200 text-slate-400"
                            : "bg-rose-50 text-rose-600 ring-1 ring-rose-100"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }


function renderKitchenView() {
  return (
    <div className="space-y-3 pb-4">
      {renderKitchenStatusCards()}
    </div>
  );
}

function renderBillingView() {

    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Billing",
          "Unpaid tables, unpaid amount, payment method, mark as paid",
          "💳"
        )}

        <div className="grid grid-cols-2 gap-3">
          {statCard("Unpaid Tables", unpaidTablesCount, "🪑", "bg-amber-50 border border-amber-200")}
          {statCard("Unpaid Amount", `Rs. ${unpaidAmount}`, "⏳", "bg-rose-50 border border-rose-200")}
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Search Table Number
            </label>
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Enter table number"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>

          <div className="space-y-4">
            {filteredTableOrders.length === 0 && (
              <p className="text-sm text-slate-500">No unpaid table orders found.</p>
            )}

            {filteredTableOrders.map((table) => {
              const selectedPaymentMethod =
                tablePaymentMethods[table.table_number] || "cash";

              return (
                <div
                  key={table.table_number}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">
                          Table {table.table_number}
                        </h3>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Unpaid
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Unpaid Orders: {table.unpaid_orders_count}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                      <p className="text-xs text-slate-500">Table Total</p>
                      <p className="font-bold text-slate-900">Rs. {table.total}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {table.items.map((item) => (
                      <div
                        key={item.item_name}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {item.item_name} x {item.quantity}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">Rs. {item.total}</p>
                      </div>
                    ))}
                  </div>

                  {table.remarks.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-600">Remarks</p>
                      <div className="space-y-1">
                        {table.remarks.map((remark, index) => (
                          <p
                            key={`${table.table_number}-remark-${index}`}
                            className="whitespace-pre-wrap text-sm text-slate-800"
                          >
                            • {remark}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
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
                      markGroupedTableAsPaid(table.table_number, selectedPaymentMethod)
                    }
                    disabled={markingPaidTable === table.table_number}
                    className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
                  >
                    {markingPaidTable === table.table_number ? "Marking..." : "Mark as Paid"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderPaymentHistoryView() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle(
          "Payment History",
          "Paid orders list with total, method, paid time, remarks",
          "🧾"
        )}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          {paidOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No paid orders yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {paidOrders.map((order) => {
                const orderTotal = getOrderTotal(order);

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => openPaidOrderBill(order)}
                    className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 text-left space-y-2 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          Table {order.table_number}
                        </p>
                        <p className="text-[11px] text-slate-500">#{order.id}</p>
                      </div>

                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
                        Paid
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-700">
                      {order.order_items?.length ? (
                        order.order_items.slice(0, 3).map((item) => (
                          <p key={item.id} className="truncate">
                            {item.item_name} x {item.quantity}
                          </p>
                        ))
                      ) : (
                        <p>No items</p>
                      )}

                      {order.order_items && order.order_items.length > 3 && (
                        <p className="text-[11px] text-slate-500">
                          +{order.order_items.length - 3} more
                        </p>
                      )}
                    </div>

                    {order.remarks && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                        <p className="mb-1 text-[10px] font-semibold text-slate-600">Remarks</p>
                        <p className="line-clamp-2 text-[11px] text-slate-800">
                          {order.remarks}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
                      <div className="rounded-xl bg-white p-2">
                        <p className="text-[10px] text-slate-500">Total</p>
                        <p className="text-xs font-bold text-slate-900">Rs. {orderTotal}</p>
                      </div>

                      <div className="rounded-xl bg-white p-2">
                        <p className="text-[10px] text-slate-500">Method</p>
                        <p className="text-xs font-bold text-slate-900">
                          {formatPaymentMethod(order.payment_method)}
                        </p>
                      </div>

                      <div className="col-span-2 rounded-xl bg-white p-2">
                        <p className="text-[10px] text-slate-500">Paid Time</p>
                        <p className="text-[11px] font-semibold text-slate-900">
                          {order.paid_at ? new Date(order.paid_at).toLocaleString() : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-900 px-3 py-2 text-center text-[11px] font-semibold text-white">
                      Tap to view customer bill
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }



  function renderMenuItemsPopup() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle("Menu Items", "Add, edit and delete restaurant menu", "🍽️")}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <form onSubmit={handleAddMenuItem} className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Item Name</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Enter item name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Enter price"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPopupView(null);
                  setShowHeaderMenu(false);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
              >
                Add Item
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {menuItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No menu items yet.
              </div>
            ) : (
              menuItems.map((menu) => (
                <div
                  key={menu.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-3 shadow-sm"
                >
                  {editingMenuId === menu.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingItemName}
                        onChange={(e) => setEditingItemName(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        placeholder="Item name"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingItemPrice}
                        onChange={(e) => setEditingItemPrice(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        placeholder="Price"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => saveEditMenuItem(menu.id)}
                          className="rounded-2xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditMenuItem}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMenuItem(menu.id)}
                          className="rounded-2xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{menu.item_name}</p>
                        <p className="mt-1 text-xs text-slate-500">Rs. {menu.price}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditMenuItem(menu)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMenuItem(menu.id)}
                          className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderPasswordsPopup() {
    return (
      <div className="space-y-4 pb-4">
        {sectionTitle("Passwords", "Update owner password", "🔐")}

        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Owner Password</label>
            <input
              type="text"
              value={newOwnerPassword}
              onChange={(e) => setNewOwnerPassword(e.target.value)}
              placeholder="Enter new owner password"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current password updates only for owner panel access.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setPopupView(null);
                setShowHeaderMenu(false);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Back
            </button>
            <button
              type="button"
              onClick={savePasswords}
              disabled={savingPasswords}
              className={`rounded-2xl px-4 py-3 text-sm font-bold text-white ${savingPasswords ? "bg-slate-400" : "bg-blue-600"}`}
            >
              {savingPasswords ? "Saving..." : "Save Password"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMainSection() {
    if (popupView === "menuItems") {
      return renderMenuItemsPopup();
    }

    if (popupView === "passwords") {
      return renderPasswordsPopup();
    }

    if (ownerView === "dashboard") {
      return renderDashboardView();
    }

    if (ownerView === "order") {
      return renderOrderView();
    }

    if (ownerView === "kitchen") {
      return renderKitchenView();
    }

    if (ownerView === "salesOverview") {
      return renderSalesOverviewView();
    }

    if (ownerView === "report") {
      return renderReportView();
    }

    if (ownerView === "billing") {
      return renderBillingView();
    }

    return renderPaymentHistoryView();
  }

  const shellClass =
  "mx-auto w-full max-w-[430px] min-h-screen bg-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.10)] text-[15px]";

  if (!restaurantId) {
    return (
      <>
        {renderFeedbackOverlays()}
        <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} flex items-center justify-center p-4`}>
          <div className="rounded-3xl bg-white p-5 text-center text-sm font-medium text-red-600 shadow border border-slate-200">
            Invalid restaurant link. Please use the correct restaurant URL.
          </div>
        </div>
      </main>
      </>
    );
  }
if (showSplash) {
  return <AppSplash />;
}
  if (checkingRestaurant) {
    return (
      <>
        {renderFeedbackOverlays()}
        <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} flex items-center justify-center p-4`}>
          <div className="rounded-3xl bg-white p-5 text-center text-sm font-medium shadow border border-slate-200">
            Loading...
          </div>
        </div>
      </main>
      </>
    );
  }

  if (!restaurantExists) {
    return (
      <>
        {renderFeedbackOverlays()}
        <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} flex items-center justify-center p-4`}>
          <div className="rounded-3xl bg-white p-5 text-center text-sm font-medium text-red-600 shadow border border-slate-200">
            Restaurant link not found. Please use the correct restaurant URL.
          </div>
        </div>
      </main>
      </>
    );
  }

  if (!isSetupDone) {
    return (
      <>
        {renderFeedbackOverlays()}
        <main className="min-h-screen bg-slate-200 flex justify-center px-3">
        <div className={`${shellClass} p-3`}>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900">Owner Setup</h1>
              <p className="mt-1 text-sm text-slate-500">
                Complete first-time setup for this restaurant
              </p>
            </div>

            <form onSubmit={handleInitialSetup} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  value={setupRestaurantName}
                  onChange={(e) => setSetupRestaurantName(e.target.value)}
                  placeholder="Enter restaurant name"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Owner Password
                </label>
                <input
                  type="text"
                  value={setupOwnerPassword}
                  onChange={(e) => setSetupOwnerPassword(e.target.value)}
                  placeholder="Create owner password"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Waiter Password
                </label>
                <input
                  type="text"
                  value={setupWaiterPassword}
                  onChange={(e) => setSetupWaiterPassword(e.target.value)}
                  placeholder="Create waiter password"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Kitchen Password
                </label>
                <input
                  type="text"
                  value={setupKitchenPassword}
                  onChange={(e) => setSetupKitchenPassword(e.target.value)}
                  placeholder="Create kitchen password"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />
              </div>

              <button
                type="submit"
                disabled={settingUpRestaurant}
                className="w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
              >
                {settingUpRestaurant ? "Setting up..." : "Complete Setup"}
              </button>
            </form>
          </div>
        </div>
      </main>
      </>
    );
  }

if (!ownerUnlocked) {
  return (
    <>
      {renderFeedbackOverlays()}
      <PanelLoginCard
      restaurantName={restaurantName}
      panelTitle="Owner Panel"
      panelDescription="Secure access to billing, reports and live restaurant activity."
      passwordLabel="Owner Password"
      passwordPlaceholder="Enter owner password"
      passwordValue={ownerPasswordInput}
      onPasswordChange={setOwnerPasswordInput}
      onSubmit={unlockOwner}
      buttonText="Unlock Owner Panel"
      theme="owner"
    />
    </>
  );
}

  return (
    <>
      {renderFeedbackOverlays()}
      <main className="min-h-screen bg-slate-200 flex justify-center px-3">
      <div className={`${shellClass} h-screen overflow-hidden relative`}>
        <div className="flex h-full flex-col px-3">
          <div className="shrink-0 pt-3 pb-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_10px_35px_rgba(15,23,42,0.08)]">
              <div className="rounded-[24px] bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3.5 text-white shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black">
  <img
    src="/logo.png"
    alt="Logo"
    className="h-full w-full object-cover"
  />
</div>

                    <div className="min-w-0">
                      <h1 className="truncate text-base font-bold">
                        {restaurantName || "Restaurant"}
                      </h1>
                      <p className="text-xs text-blue-100">Owner Panel</p>
                    </div>
                  </div>

                  <div className="relative shrink-0" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (popupView) {
                          setPopupView(null);
                          setShowHeaderMenu(false);
                        } else {
                          setShowHeaderMenu((prev) => !prev);
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold text-white"
                    >
                      ⋯
                    </button>

                    {showHeaderMenu && (
                      <div className="absolute right-0 top-12 z-20 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                        <button
                          type="button"
                          onClick={() => {
                            setPopupView("menuItems");
                            setShowHeaderMenu(false);
                            scrollMainContentToTop();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">🍽️</span>
                          Menu Items
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPopupView("passwords");
                            setShowHeaderMenu(false);
                            scrollMainContentToTop();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">🔐</span>
                          Passwords
                        </button>

                        <button
                          type="button"
                          onClick={openQrAccess}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">🔳</span>
                          QR Access
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            changeView("report");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">📝</span>
                          Report
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            changeView("billing");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">💳</span>
                          Billing
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            changeView("paymentHistory");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span className="text-base">🧾</span>
                          History
                        </button>

                        <button
                          type="button"
                          onClick={logoutOwner}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          <span className="text-base">🚪</span>
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                    Today Sales: Rs. {totalRevenueToday}
                  </span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                    Unpaid: Rs. {unpaidAmount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div ref={contentScrollRef} className="min-h-0 flex-1 overflow-y-auto pb-24">
            {isSwitching ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading...
              </div>
            ) : (
              renderMainSection()
            )}
          </div>
        </div>

        {popupView === null && !showTakeOrderModal && !reportOrder && (
          <button
            type="button"
            onClick={openTakeOrderModal}
            style={{
              position: "fixed",
              bottom: "100px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 99999,
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              border: "none",
              borderRadius: "9999px",
              padding: "14px 24px",
              fontSize: "14px",
              fontWeight: 700,
              boxShadow: "0 18px 35px rgba(37,99,235,0.35)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "20px", lineHeight: 1 }}>+</span>
            <span>Take Order</span>
          </button>
        )}

        {showTakeOrderModal && (
          <div className="absolute inset-0 z-50">
            <div
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
              onClick={closeTakeOrderModal}
            />

            <div className="absolute inset-0 flex items-end justify-center">
              <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden rounded-none bg-[#f8fafc] shadow-2xl">
                <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Order Entry</p>
                      <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">{editingOrderId ? "Edit Order" : "Take Order"}</h2>
                      <p className="text-xs text-slate-500">{editingOrderId ? "Order update garera save garna sakinchha" : "Quick order entry and send to kitchen"}</p>
                    </div>

                    <button
                      type="button"
                      onClick={closeTakeOrderModal}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-700 shadow-sm"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Table Number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={takeOrderTableNumber}
                        onChange={(e) => setTakeOrderTableNumber(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Table"
                        className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Search Items</label>
                      <input
                        type="text"
                        value={takeOrderSearch}
                        onChange={(e) => setTakeOrderSearch(e.target.value)}
                        placeholder="Search item"
                        className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-4 pb-28">
                    <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-[18px] font-extrabold tracking-tight text-slate-900">Popular Items</h3>
                          <p className="text-xs text-slate-500">Quick add</p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 shadow-sm ring-1 ring-amber-100">
                          Top {popularTakeOrderItems.length}
                        </span>
                      </div>

                      {popularTakeOrderItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                          No popular items yet.
                        </div>
                      ) : (
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                          {popularTakeOrderItems.map((item) => {
                            const activeItem = takeOrderItems.find((cartItem) => cartItem.id === item.id);

                            return (
                              <button
                                key={`popular-${item.id}`}
                                type="button"
                                onClick={() => addTakeOrderItem(item)}
                                className={`min-w-[86px] rounded-[16px] border px-3 py-2 text-center shadow-sm transition-all ${
                                  activeItem ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-slate-900">
                                  {item.item_name}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {takeOrderSearch.trim() !== "" && (
                      <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Search Results</h3>
                            <p className="text-xs text-slate-500">Search gareko items matra</p>
                          </div>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                            {filteredTakeOrderMenuItems.length}
                          </span>
                        </div>

                        {filteredTakeOrderMenuItems.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                            No matching items found.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {filteredTakeOrderMenuItems.map((item) => {
                              const activeItem = takeOrderItems.find((cartItem) => cartItem.id === item.id);

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => addTakeOrderItem(item)}
                                  className={`rounded-[18px] border p-3 text-left shadow-sm transition ${
                                    activeItem ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"
                                  }`}
                                >
                                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.item_name}</p>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-slate-900">Rs. {item.price}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${activeItem ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                                      {activeItem ? `${activeItem.quantity}` : "+ Add"}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Selected Items</h3>
                          <p className="text-[11px] text-slate-500">Compact quantity controls</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                          {takeOrderCartCount} items
                        </span>
                      </div>

                      {takeOrderItems.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
                          No items selected yet.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {takeOrderItems.map((item) => (
                            <div
                              key={`selected-${item.id}`}
                              className="flex items-center justify-between gap-2 rounded-[16px] bg-slate-50 px-2.5 py-2 ring-1 ring-slate-200"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-semibold text-slate-900">{item.item_name}</p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => decreaseTakeOrderItem(item.id)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[15px] font-bold text-slate-700 ring-1 ring-slate-200"
                                >
                                  −
                                </button>

                                <span className="min-w-[22px] text-center text-[12px] font-bold text-slate-900">
                                  {item.quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => increaseTakeOrderItem(item.id)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[15px] font-bold text-white shadow-sm"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm">✍️</span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Remarks</h3>
                          <p className="text-xs text-slate-500">Optional special instruction</p>
                        </div>
                      </div>
                      <textarea
                        value={takeOrderRemarks}
                        onChange={(e) => setTakeOrderRemarks(e.target.value)}
                        placeholder="Example: no sugar, extra spicy"
                        className="min-h-[92px] w-full resize-none rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(59,130,246,0.10)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200/80 bg-white/92 px-4 pb-4 pt-3 backdrop-blur">
                  <div className="mb-3 rounded-[26px] border border-slate-200/80 bg-white/90 p-2 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-[18px] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-3 py-2">
                        <p className="text-[11px] text-slate-500">Items</p>
                        <p className="text-sm font-bold text-slate-900">{takeOrderCartCount}</p>
                      </div>
                      <div className="rounded-[18px] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-3 py-2">
                        <p className="text-[11px] text-slate-500">Total</p>
                        <p className="text-sm font-bold text-slate-900">Rs. {takeOrderCartTotal}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTakeOrderCart(true)}
                        className="rounded-[20px] bg-slate-900 px-3 py-2 text-sm font-bold text-white shadow-[0_12px_24px_rgba(15,23,42,0.24)]"
                      >
                        View Cart
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={submitTakeOrder}
                    disabled={submittingTakeOrder || takeOrderItems.length === 0}
                    className="w-full rounded-[24px] bg-blue-600 py-3.5 text-sm font-extrabold text-white shadow-md disabled:opacity-60"
                  >
                    {submittingTakeOrder ? (editingOrderId ? "Updating..." : "Sending...") : (editingOrderId ? "Update Order" : "Send to Kitchen")}
                  </button>
                </div>

                {showTakeOrderCart && (
                  <div className="absolute inset-0 z-[60] flex items-end justify-center">
                    <div className="absolute inset-0 bg-slate-950/45" onClick={() => setShowTakeOrderCart(false)} />
                    <div className="relative w-full max-w-[430px] rounded-t-[28px] border border-slate-200 bg-white p-4 shadow-2xl">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">View Cart</h3>
                          <p className="text-xs text-slate-500">Add, minus, remove ra send</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTakeOrderCart(false)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700"
                        >
                          ×
                        </button>
                      </div>

                      {takeOrderItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          No items in cart.
                        </div>
                      ) : (
                        <div className="max-h-[45vh] space-y-3 overflow-y-auto pb-2">
                          {takeOrderItems.map((item) => (
                            <div
                              key={`cart-${item.id}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{item.item_name}</p>
                                  <p className="text-xs text-slate-500">Rs. {item.price} each</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeTakeOrderItem(item.id)}
                                  className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => decreaseTakeOrderItem(item.id)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-700"
                                  >
                                    −
                                  </button>
                                  <span className="min-w-[28px] text-center text-sm font-bold text-slate-900">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => increaseTakeOrderItem(item.id)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white"
                                  >
                                    +
                                  </button>
                                </div>
                                <p className="text-sm font-bold text-slate-900">Rs. {item.quantity * item.price}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 rounded-[20px] bg-slate-900 px-4 py-3 text-white">
                        <div className="flex items-center justify-between text-sm">
                          <span>Items</span>
                          <span className="font-bold">{takeOrderCartCount}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span>Total</span>
                          <span className="text-lg font-bold">Rs. {takeOrderCartTotal}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setShowTakeOrderCart(false)}
                          className="rounded-[20px] bg-slate-200 py-3 text-sm font-bold text-slate-700"
                        >
                          Close Cart
                        </button>
                        <button
                          type="button"
                          onClick={submitTakeOrder}
                          disabled={submittingTakeOrder || takeOrderItems.length === 0}
                          className="rounded-[20px] bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {submittingTakeOrder ? (editingOrderId ? "Updating..." : "Sending...") : (editingOrderId ? "Update Order" : "Send to Kitchen")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {reportOrder && (
          <div className="absolute inset-0 z-[70]">
            <div
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
              onClick={closeOrderReport}
            />

            <div className="absolute inset-0 flex items-end justify-center">
              <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden rounded-none bg-[#f8fafc] shadow-2xl">
                <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Receipt View</p>
                      <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Order Receipt</h2>
                    </div>

                    <button
                      type="button"
                      onClick={closeOrderReport}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-700 shadow-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-4 pb-28">
                    <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-5 shadow-sm">
                      <div className="text-center">
                        <h3 className="text-[34px] font-black tracking-tight text-slate-900">
                          KOT {reportOrder.id}
                        </h3>
                      </div>

                      <div className="mt-5 flex items-start justify-between gap-4 text-[15px] text-slate-800">
                        <div className="space-y-1">
                          <p>Type: Dine In</p>
                          <p>Order By: Owner</p>
                          <p>
                            Order At:{" "}
                            {new Date(reportOrder.created_at).toLocaleString([], {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p>Table: {reportOrder.table_number}</p>
                        </div>
                      </div>

                      <div className="my-5 border-t border-dashed border-slate-300" />

                      <div className="grid grid-cols-[52px_1fr_52px] items-center gap-2 text-[17px] font-bold text-slate-900">
                        <span>S.N</span>
                        <span>Dishes</span>
                        <span className="text-right">QTY</span>
                      </div>

                      <div className="my-4 border-t border-dashed border-slate-300" />

                      <div className="space-y-3">
                        {(reportOrder.order_items || []).length === 0 ? (
                          <p className="text-sm text-slate-500">No order items found.</p>
                        ) : (
                          (reportOrder.order_items || []).map((item, index) => (
                            <div
                              key={`report-item-${item.id}`}
                              className="grid grid-cols-[52px_1fr_52px] items-start gap-2 text-[18px] text-slate-900"
                            >
                              <span>{index + 1}.</span>
                              <div className="min-w-0">
                                <p className="break-words">{item.item_name}</p>
                              </div>
                              <span className="text-right">{item.quantity}</span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="my-5 border-t border-dashed border-slate-300" />

                      <div className="flex items-center justify-between gap-3 text-[18px] font-semibold text-slate-900">
                        <span>Total (Dishes/QTY)</span>
                        <span>
                          {(reportOrder.order_items || []).length}/
                          {(reportOrder.order_items || []).reduce(
                            (sum, item) => sum + Number(item.quantity || 0),
                            0
                          )}
                        </span>
                      </div>

                      {reportOrder.remarks && (
                        <>
                          <div className="my-5 border-t border-dashed border-slate-300" />
                          <div className="text-[15px] text-slate-900">
                            <p className="font-semibold">Remarks:</p>
                            <p className="mt-1 whitespace-pre-wrap">{reportOrder.remarks}</p>
                          </div>
                        </>
                      )}

                      <div className="my-5 border-t border-dashed border-slate-300" />

                      <div className="space-y-1 text-[15px] text-slate-900">
                        <p>Viewed By: Owner</p>
                        <p>
                          Viewed At:{" "}
                          {new Date().toLocaleString([], {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <p className="mt-6 text-center text-[20px] font-medium text-slate-900">
                        Thank You!
                      </p>
                    </div>

                    <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                      <div className="mb-3">
                        <h3 className="text-sm font-bold text-slate-900">Payment Option</h3>
                        <p className="text-xs text-slate-500">Payment method choose garera paid mark garnu</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setReportPaymentMethod("cash")}
                          className={`rounded-[18px] border py-3 text-sm font-semibold ${reportPaymentMethod === "cash" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportPaymentMethod("qr")}
                          className={`rounded-[18px] border py-3 text-sm font-semibold ${reportPaymentMethod === "qr" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                        >
                          QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportPaymentMethod("card")}
                          className={`rounded-[18px] border py-3 text-sm font-semibold ${reportPaymentMethod === "card" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                        >
                          Card
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
                  <div className="mb-3 rounded-[20px] bg-slate-900 px-4 py-3 text-white">
                    <div className="flex items-center justify-between text-sm">
                      <span>Selected Payment</span>
                      <span className="font-bold">{formatPaymentMethod(reportPaymentMethod)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span>Bill Total</span>
                      <span className="text-lg font-bold">Rs. {(reportOrder.order_items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={downloadReceipt}
                      className="rounded-[20px] bg-slate-200 py-3 text-sm font-bold text-slate-700"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={printReceipt}
                      className="rounded-[20px] bg-slate-900 py-3 text-sm font-bold text-white"
                    >
                      Print
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={closeOrderReport}
                      className="rounded-[20px] bg-slate-200 py-3 text-sm font-bold text-slate-700"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={markOrderAsPaidFromReport}
                      disabled={markingReportPaid}
                      className="rounded-[20px] bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {markingReportPaid ? "Marking..." : "Mark as Paid"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedPaidOrder && (
          <div className="absolute inset-0 z-[80]">
            <div
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
              onClick={closePaidOrderBill}
            />

            <div className="absolute inset-0 flex items-end justify-center">
              <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden rounded-none bg-[#f8fafc] shadow-2xl">
                <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Paid Receipt</p>
                      <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">Customer Bill</h2>
                    </div>

                    <button
                      type="button"
                      onClick={closePaidOrderBill}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-700 shadow-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                    <div className="text-center">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{restaurantName || "Restaurant"}</p>
                      <h3 className="mt-2 text-[30px] font-black tracking-tight text-slate-900">Customer Bill</h3>
                      <p className="mt-1 text-sm text-slate-500">Order #{selectedPaidOrder.id}</p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-[14px] text-slate-800">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Table</p>
                        <p className="mt-1 font-bold text-slate-900">{selectedPaidOrder.table_number}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Payment</p>
                        <p className="mt-1 font-bold text-slate-900">{formatPaymentMethod(selectedPaidOrder.payment_method)}</p>
                      </div>
                      <div className="col-span-2 rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Paid At</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {selectedPaidOrder.paid_at ? new Date(selectedPaidOrder.paid_at).toLocaleString() : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="my-5 border-t border-dashed border-slate-300" />

                    <div className="grid grid-cols-[1fr_56px_80px] items-center gap-2 text-[14px] font-bold text-slate-900">
                      <span>Item</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Amount</span>
                    </div>

                    <div className="my-4 border-t border-dashed border-slate-300" />

                    <div className="space-y-3">
                      {(selectedPaidOrder.order_items || []).length === 0 ? (
                        <p className="text-sm text-slate-500">No order items found.</p>
                      ) : (
                        (selectedPaidOrder.order_items || []).map((item) => (
                          <div
                            key={`paid-report-item-${item.id}`}
                            className="grid grid-cols-[1fr_56px_80px] items-start gap-2 text-[15px] text-slate-900"
                          >
                            <div className="min-w-0">
                              <p className="break-words font-medium">{item.item_name}</p>
                              <p className="text-[12px] text-slate-500">Rs. {Number(item.unit_price || 0)} each</p>
                            </div>
                            <span className="text-center">{item.quantity}</span>
                            <span className="text-right font-semibold">
                              Rs. {Number(item.quantity || 0) * Number(item.unit_price || 0)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {selectedPaidOrder.remarks && (
                      <>
                        <div className="my-5 border-t border-dashed border-slate-300" />
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[14px] text-slate-900">
                          <p className="font-semibold">Remarks</p>
                          <p className="mt-1 whitespace-pre-wrap">{selectedPaidOrder.remarks}</p>
                        </div>
                      </>
                    )}

                    <div className="my-5 border-t border-dashed border-slate-300" />

                    <div className="space-y-2 rounded-[22px] bg-slate-900 px-4 py-4 text-white">
                      <div className="flex items-center justify-between text-sm">
                        <span>Items</span>
                        <span className="font-bold">
                          {(selectedPaidOrder.order_items || []).reduce(
                            (sum, item) => sum + Number(item.quantity || 0),
                            0
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-base">
                        <span>Total</span>
                        <span className="text-xl font-extrabold">Rs. {getOrderTotal(selectedPaidOrder)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={downloadPaidOrderBill}
                      className="rounded-[20px] bg-slate-200 py-3 text-sm font-bold text-slate-700"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={printReceipt}
                      className="rounded-[20px] bg-slate-900 py-3 text-sm font-bold text-white"
                    >
                      Print
                    </button>
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={closePaidOrderBill}
                      className="w-full rounded-[20px] bg-blue-600 py-3 text-sm font-bold text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showQR && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">QR Access</h3>
                  <p className="mt-1 text-xs text-slate-500">Mini app access QR</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQR(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex justify-center">
                  <QRCodeCanvas
                    id="mini-qr-canvas"
                    value={miniQrLink || "about:blank"}
                    size={220}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Mini Link
                  </p>
                  <p className="break-all text-xs text-slate-700">{miniQrLink || "Link not ready"}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={copyMiniQrLink}
                    className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
                  >
                    Copy Link
                  </button>

                  <button
                    type="button"
                    onClick={downloadMiniQr}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(5,150,105,0.28)]"
                  >
                    Download QR
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 rounded-[15px] border border-white/60 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
          <div className="grid grid-cols-4 gap-2 px-2.5 pt-0.5 pb-4">
            <button
              type="button"
              onClick={() => changeView("dashboard")}
              className={bottomNavButtonClass("dashboard")}
            >
              <span className="text-lg">📊</span>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => changeView("order")}
              className={bottomNavButtonClass("order")}
            >
              <span className="text-base">🍽️</span>
              <span>Order</span>
            </button>

            <button
              type="button"
              onClick={() => changeView("kitchen")}
              className={bottomNavButtonClass("kitchen")}
            >
              <span className="text-base">🍳</span>
              <span>Kitchen</span>
            </button>

            <button
              type="button"
              onClick={() => changeView("salesOverview")}
              className={bottomNavButtonClass("salesOverview")}
            >
              <span className="text-base">💹</span>
              <span>Sales</span>
            </button>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

export default function OwnerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OwnerPageContent />
    </Suspense>
  );
}
