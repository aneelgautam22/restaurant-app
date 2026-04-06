"use client";

import { useParams } from "next/navigation";

export default function KitchenPage() {
  const params = useParams();
  const slug = params.slug;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        {slug} - Kitchen Panel
      </h1>
    </div>
  );
}