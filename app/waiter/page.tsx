"use client";

import { Suspense, useEffect, useState } from "react";
import MiniApp from "@/components/MiniApp";
import { supabase } from "@/lib/supabase";

function StaffGate() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const params = new URLSearchParams(window.location.search);
      const restaurantId = params.get("id");

      if (!restaurantId) {
        window.location.href = "/launcher";
        return;
      }

      const activeRestaurantId = localStorage.getItem("activeRestaurantId");
      const activePanel = localStorage.getItem("activePanel");

      if (activeRestaurantId === restaurantId && activePanel === "staff") {
        if (!cancelled) setAllowed(true);
        return;
      }

   const urlDeviceToken = params.get("device");

const trustedDeviceToken =
  urlDeviceToken ||
  localStorage.getItem(`trustedDeviceToken:${restaurantId}:staff`);
      if (!trustedDeviceToken) {
        window.location.href = `/launcher?id=${restaurantId}`;
        return;
      }

      const { data } = await supabase.rpc("verify_trusted_device", {
        p_restaurant_id: Number(restaurantId),
        p_panel: "staff",
        p_device_token: trustedDeviceToken,
      });

      if (data?.success) {
        localStorage.setItem("activeRestaurantId", restaurantId);
        localStorage.setItem("activePanel", "staff");

        if (!cancelled) setAllowed(true);
        return;
      }

      localStorage.removeItem(`trustedDeviceToken:${restaurantId}:staff`);
      window.location.href = `/launcher?id=${restaurantId}`;
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) return null;

  return <MiniApp forcedRole="staff" />;
}

export default function WaiterPage() {
  return (
    <Suspense fallback={null}>
      <StaffGate />
    </Suspense>
  );
}