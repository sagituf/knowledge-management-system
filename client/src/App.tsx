import { useEffect, useState } from "react";

export default function App() {
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setAi(d.ai))
      .catch(() => setAi(null));
  }, []);
  return (
    <main>
      <h1>Knowledge Management System</h1>
      <p>AI configured: {ai === null ? "unknown" : String(ai)}</p>
    </main>
  );
}
