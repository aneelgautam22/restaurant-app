"use client";

import { Suspense, useEffect, useState } from "react";
import MiniApp from "@/components/MiniApp";
import { supabase } from "@/lib/supabase";

function MiniOwnerGate() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const params = new URLSearchParams(window.location.search);

      const restaurantId = params.get("id");
      const tokenFromUrl = params.get("device") || params.get("trusted");

      if (!restaurantId) {
        window.location.href = "/launcher";
        return;
      }

      const tokenFromStorage = localStorage.getItem(
        `trustedDeviceToken:${restaurantId}:owner`
      );

      const finalToken = tokenFromUrl || tokenFromStorage;

      if (!finalToken) {
        localStorage.removeItem("activeRestaurantId");
        localStorage.removeItem("activePanel");
        window.location.href = `/launcher?id=${restaurantId}`;
        return;
      }

      const { data, error } = await supabase.rpc("verify_trusted_device", {
        p_restaurant_id: Number(restaurantId),
        p_panel: "owner",
        p_device_token: finalToken,
      });

      if (error || !data?.success) {
        localStorage.removeItem("activeRestaurantId");
        localStorage.removeItem("activePanel");
        localStorage.removeItem(`trustedDeviceToken:${restaurantId}:owner`);

        window.location.href = `/launcher?id=${restaurantId}`;
        return;
      }

      localStorage.setItem("activeRestaurantId", restaurantId);
      localStorage.setItem("activePanel", "owner");
      localStorage.setItem(
        `trustedDeviceToken:${restaurantId}:owner`,
        finalToken
      );

      if (!cancelled) setAllowed(true);
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) return null;

  return <MiniApp forcedRole="owner" />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MiniOwnerGate />
    </Suspense>
  );
}