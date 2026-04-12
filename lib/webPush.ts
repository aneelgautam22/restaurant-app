import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  throw new Error("Missing VAPID keys in environment variables");
}

webpush.setVapidDetails(
  "mailto:test@example.com",
  publicKey,
  privateKey
);

export default webpush;