"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MiniApp from "@/components/MiniApp";

export default function TrustedDevicePage() {
  const params = useParams();

  const panel = String(params.panel || "");
  const restaurantId = String(params.restaurantId || "");
  const token = String(params.token || "");

  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verifyTrustedDevice() {
      if (!restaurantId || !token || (panel !== "owner" && panel !== "staff")) {
        window.location.href = "/launcher";
        return;
      }

      const { data } = await supabase.rpc("verify_trusted_device", {
        p_restaurant_id: Number(restaurantId),
        p_panel: panel,
        p_device_token: token,
      });

      if (!data?.success) {
        window.location.href = `/launcher?id=${restaurantId}`;
        return;
      }

      localStorage.setItem("activeRestaurantId", restaurantId);
      localStorage.setItem("activePanel", panel);
      localStorage.setItem("lastRestaurantId", restaurantId);
      localStorage.setItem("mini:lastRestaurantId", restaurantId);
      localStorage.setItem("lastPanel", panel === "staff" ? "waiter" : "mini");
      localStorage.setItem(`trustedDeviceToken:${restaurantId}:${panel}`, token);

      if (!cancelled) {
        setAllowed(true);
        setChecking(false);
      }
    }

    verifyTrustedDevice();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, panel, token]);

  if (checking || !allowed) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-white">
        Opening Restrofy...
      </main>
    );
  }

  return <MiniApp forcedRole={panel === "staff" ? "staff" : "owner"} />;
}