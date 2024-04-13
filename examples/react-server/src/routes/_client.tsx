"use client";

import React from "react";

export function ClientComponent() {
  const [count, setCount] = React.useState(0);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div data-testid="client-component">
      <h4>Hello Client Component</h4>
      <div>hydrated: {String(hydrated)}</div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((v) => v - 1)}>-1</button>
      <button onClick={() => setCount((v) => v + 1)}>+1</button>
    </div>
  );
}
