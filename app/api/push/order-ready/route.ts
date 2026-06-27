import { NextResponse } from "next/server";
import webpush from "@/lib/webPush";
import { supabase } from "@/lib/supabase";

type OrderReadyBody = {
  restaurant_id?: unknown;
  table?: unknown;
  device_token?: unknown;
  trusted_device_token?: unknown;
};

type StoredPushSubscription = {
  id: number;
  subscription: webpush.PushSubscription;
};

type PushSendError = {
  statusCode?: number;
};

function isOrderReadyBody(value: unknown): value is OrderReadyBody {
  return typeof value === "object" && value !== null;
}

function getDeviceToken(req: Request, body: OrderReadyBody) {
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  const headerToken = req.headers.get("x-trusted-device-token") || "";
  const bodyToken = body.trusted_device_token || body.device_token;

  if (typeof bodyToken === "string" && bodyToken.trim()) {
    return bodyToken.trim();
  }

  return headerToken.trim() || bearerToken;
}

function parseRestaurantId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseTable(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

async function verifyStaffDevice(restaurantId: number, deviceToken: string) {
  const { data, error } = await supabase.rpc("verify_trusted_device", {
    p_restaurant_id: restaurantId,
    p_panel: "staff",
    p_device_token: deviceToken,
  });

  if (error) {
    console.error("Order-ready push auth check failed:", error.message);
    return false;
  }

  return Boolean(data?.success);
}

export async function POST(req: Request) {
  try {
    const rawBody: unknown = await req.json();

    if (!isOrderReadyBody(rawBody)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const restaurantId = parseRestaurantId(rawBody.restaurant_id);
    const table = parseTable(rawBody.table);
    const deviceToken = getDeviceToken(req, rawBody);

    if (!restaurantId || !table) {
      return NextResponse.json(
        { error: "restaurant_id and table are required" },
        { status: 400 }
      );
    }

    if (!deviceToken) {
      return NextResponse.json({ error: "Trusted device token required" }, { status: 401 });
    }

    const verified = await verifyStaffDevice(restaurantId, deviceToken);

    if (!verified) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("restaurant_id", restaurantId)
      .eq("panel", "waiter")
      .returns<StoredPushSubscription[]>();

    if (error) {
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    let sent = 0;

    for (const sub of data || []) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: "KITCHEN READY",
            body: `Table ${table} ready! Pick now!`,
            url: `/waiter?id=${restaurantId}&table=${encodeURIComponent(table)}`,
          })
        );
        sent++;
      } catch (error) {
        const pushError = error as PushSendError;
        console.error("Push error:", pushError.statusCode ?? "unknown");

        if (pushError.statusCode === 404 || pushError.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
