import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";

webpush.setVapidDetails(
  "mailto:demo@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type NewOrderBody = {
  restaurant_id?: unknown;
  table?: unknown;
  device_token?: unknown;
  trusted_device_token?: unknown;
};

type StoredPushSubscription = {
  id: number;
  subscription: webpush.PushSubscription;
  endpoint: string | null;
};

type PushSendError = {
  statusCode?: number;
};

function isNewOrderBody(value: unknown): value is NewOrderBody {
  return typeof value === "object" && value !== null;
}

function getDeviceToken(req: Request, body: NewOrderBody) {
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
    console.error("New-order push auth check failed:", error.message);
    return false;
  }

  return Boolean(data?.success);
}

export async function POST(req: Request) {
  try {
    const rawBody: unknown = await req.json();

    if (!isNewOrderBody(rawBody)) {
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

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription, endpoint")
      .eq("restaurant_id", restaurantId)
      .eq("panel", "kitchen")
      .returns<StoredPushSubscription[]>();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No subscriptions found",
      });
    }

    let sent = 0;

    for (const row of subscriptions) {
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({
            title: "NEW ORDER",
            body: `Table ${table} sent a new order`,
            url: `/kitchen?id=${restaurantId}&table=${encodeURIComponent(table)}`,
          })
        );
        sent++;
      } catch (error) {
        const pushError = error as PushSendError;
        console.error("Push send error:", pushError.statusCode ?? "unknown");

        if (pushError.statusCode === 404 || pushError.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
    });
  } catch (error) {
    console.error("new-order push error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
