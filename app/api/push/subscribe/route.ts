import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { restaurant_id, subscription } = body;

    if (!restaurant_id || !subscription) {
      return NextResponse.json(
        { error: "restaurant_id and subscription are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("push_subscriptions").insert({
      restaurant_id,
      subscription,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}