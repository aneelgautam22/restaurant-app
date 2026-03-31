import Link from "next/link";

export default function Home() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Restaurant Order System</h1>

      <div style={{ marginTop: 20 }}>
        <a href="/waiter">Waiter Screen</a>
      </div>

      <div style={{ marginTop: 20 }}>
        <a href="/kitchen">Kitchen Screen</a>
      </div>
    </div>
  );
}