import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";

webpush.setVapidDetails(
  "mailto:demo@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { restaurant_id, table } = body;

    if (!restaurant_id || !table) {
      return NextResponse.json(
        { error: "restaurant_id and table are required" },
        { status: 400 }
      );
    }

   const { data: subscriptions, error } = await supabase
  .from("push_subscriptions")
  .select("id, subscription, endpoint")
  .eq("restaurant_id", restaurant_id)
  .eq("panel", "kitchen");

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
            title: "🧾🔔 NEW ORDER",
            body: `Table ${table} sent a new order`,
            url: `/kitchen?id=${restaurant_id}&table=${table}`,
          })
        );
        sent++;
      } catch (pushError: any) {
        console.error("Push send error:", pushError);

        if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
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