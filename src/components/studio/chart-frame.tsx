import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { ResponsiveContainer } from "recharts";

export function ChartFrame({
  children,
  height = 224,
}: {
  children: ReactElement;
  height?: number;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return <div className="rounded-lg bg-raised" style={{ height }} />;
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}