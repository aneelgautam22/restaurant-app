import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type PushPanel = "waiter" | "kitchen";

type PushSubscriptionPayload = {
  endpoint?: unknown;
};

type SubscribeBody = {
  restaurant_id?: unknown;
  subscription?: PushSubscriptionPayload;
  panel?: unknown;
  device_token?: unknown;
  trusted_device_token?: unknown;
};

function isSubscribeBody(value: unknown): value is SubscribeBody {
  return typeof value === "object" && value !== null;
}

function getDeviceToken(req: Request, body: SubscribeBody) {
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

function parsePushPanel(value: unknown): PushPanel | null {
  return value === "waiter" || value === "kitchen" ? value : null;
}

async function verifyStaffDevice(restaurantId: number, deviceToken: string) {
  const { data, error } = await supabase.rpc("verify_trusted_device", {
    p_restaurant_id: restaurantId,
    p_panel: "staff",
    p_device_token: deviceToken,
  });

  if (error) {
    console.error("Push subscribe auth check failed:", error.message);
    return false;
  }

  return Boolean(data?.success);
}

export async function POST(req: Request) {
  try {
    const rawBody: unknown = await req.json();

    if (!isSubscribeBody(rawBody)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const restaurantId = parseRestaurantId(rawBody.restaurant_id);
    const subscription = rawBody.subscription;
    const panel = parsePushPanel(rawBody.panel);
    const deviceToken = getDeviceToken(req, rawBody);

    if (!restaurantId || !subscription?.endpoint || !panel) {
      return NextResponse.json(
        { error: "restaurant_id, subscription.endpoint, and panel are required" },
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

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          restaurant_id: restaurantId,
          subscription,
          endpoint: subscription.endpoint,
          panel,
        },
        {
          onConflict: "endpoint,panel",
        }
      );

    if (error) {
      console.error("SUBSCRIBE UPSERT ERROR:", error.message);
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true, panel });
  } catch (error) {
    console.error("SUBSCRIBE ROUTE ERROR:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
