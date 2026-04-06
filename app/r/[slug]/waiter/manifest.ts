import type { MetadataRoute } from "next";

export default function manifest({
  params,
}: {
  params: { slug: string };
}): MetadataRoute.Manifest {
  const slug = params.slug;

  return {
    name: `${slug} Waiter`,
    short_name: `${slug} Waiter`,
    description: `${slug} waiter panel`,
    start_url: `/r/${slug}/waiter`,
    id: `/r/${slug}/waiter`,
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}