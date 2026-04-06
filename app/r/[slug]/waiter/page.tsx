"use client";

import { useParams } from "next/navigation";

export default function WaiterPage() {
  const params = useParams();
  const slug = params.slug;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        {slug} - Waiter Panel
      </h1>
    </div>
  );
}