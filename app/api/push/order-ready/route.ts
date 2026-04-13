import { NextResponse } from "next/server";
import webpush from "@/lib/webPush";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { restaurant_id, table } = body;

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("restaurant_id", restaurant_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const sub of data || []) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: "👨‍🍳🔔 KITCHEN READY",
            body: `Table ${table} ready! Pick now!`,
            url: `/waiter?id=${restaurant_id}&table=${table}`,
          })
        );
      } catch (err) {
        console.error("Push error:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}