// todays-report/components/LiveClock.tsx
"use client";
import { useState, useEffect } from "react";

export function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="text-right border border-border rounded-xl px-5 py-3 bg-background min-w-[200px]">
      <div className="text-2xl font-extrabold tracking-tight text-foreground font-mono">{time}</div>
      <div className="text-xs text-muted-foreground font-medium mt-0.5">{date}</div>
    </div>
  );
}
