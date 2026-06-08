export const metadata = {
  title: "ServeX Staff",
  manifest: "/waiter/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ServeX Staff",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/logo.png",
  },
};

export default function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}