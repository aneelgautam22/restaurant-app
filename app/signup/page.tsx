"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !password.trim()) {
      alert("Please fill all fields");
      return;
    }

    const { data, error } = await supabase
      .from("restaurants")
      .insert([
        {
          name: name.trim(),
          owner_password: password.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      alert("Error creating restaurant");
      return;
    }

    router.push(`/waiter?id=${data.id}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-center">
          Create Restaurant Account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Restaurant Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border px-4 py-3 rounded-xl"
          />

          <input
            type="password"
            placeholder="Owner Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border px-4 py-3 rounded-xl"
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
          >
            Create Account
          </button>
        </form>
      </div>
    </main>
  );
}