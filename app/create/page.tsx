"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CreateRestaurant() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      alert("Enter restaurant name");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("restaurants")
      .insert([
        {
          name: name.trim(),
          owner_password: "setup_pending",
          waiter_password: "setup_pending",
          kitchen_password: "setup_pending",
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error || !data) {
      alert(`Error: ${error?.message || "Failed to create restaurant"}`);
      return;
    }

    router.push(`/?id=${data.id}`);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-3xl shadow w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-center">Create Restaurant</h1>

        <input
          type="text"
          placeholder="Restaurant Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-xl px-4 py-3"
        />

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </div>
    </main>
  );
}