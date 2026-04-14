import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function inferPanel(
  bodyPanel: unknown,
  referer: string | null
): "waiter" | "kitchen" | null {
  if (bodyPanel === "waiter" || bodyPanel === "kitchen") {
    return bodyPanel;
  }

  if (!referer) return null;

  if (referer.includes("/waiter")) return "waiter";
  if (referer.includes("/kitchen")) return "kitchen";

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("SUBSCRIBE BODY:", body);
    console.log("SUBSCRIBE REFERER:", req.headers.get("referer"));

    const { restaurant_id, subscription, panel: rawPanel } = body;

    const referer = req.headers.get("referer");
    const panel = inferPanel(rawPanel, referer);

    if (!restaurant_id || !subscription?.endpoint || !panel) {
      return NextResponse.json(
        {
          error: "restaurant_id, subscription.endpoint, and panel are required",
          debug: {
            restaurant_id: restaurant_id ?? null,
            hasSubscription: !!subscription,
            endpoint: subscription?.endpoint ?? null,
            rawPanel: rawPanel ?? null,
            inferredPanel: panel ?? null,
            referer,
          },
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          restaurant_id: Number(restaurant_id),
          subscription,
          endpoint: subscription.endpoint,
          panel,
        },
        {
          onConflict: "endpoint,panel",
        }
      );

    if (error) {
      console.error("SUBSCRIBE UPSERT ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      panel,
      endpoint: subscription.endpoint,
    });
  } catch (error) {
    console.error("SUBSCRIBE ROUTE ERROR:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}