import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const appName = `${slug} Waiter`;

  return {
    title: appName,
    description: `${slug} waiter panel`,
    other: {
      "apple-mobile-web-app-title": appName,
    },
  };
}

export default function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}