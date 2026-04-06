"use client";

import { useParams } from "next/navigation";

export default function OwnerPage() {
  const params = useParams();
  const slug = params.slug;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        {slug} - Owner Panel
      </h1>
    </div>
  );
}