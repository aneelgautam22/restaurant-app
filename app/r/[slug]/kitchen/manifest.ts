import type { MetadataRoute } from "next";

export default function manifest({
  params,
}: {
  params: { slug: string };
}): MetadataRoute.Manifest {
  const slug = params.slug;

  return {
    name: `${slug} Kitchen`,
    short_name: `${slug} Kitchen`,
    description: `${slug} kitchen panel`,
    start_url: `/r/${slug}/kitchen`,
    id: `/r/${slug}/kitchen`,
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