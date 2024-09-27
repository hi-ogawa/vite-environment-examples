import React from "react";
import workerUrl from "./entry-worker?worker-runner";

export function App() {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    return () => {
      worker.terminate();
    };
  });

  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((c) => c - 1)}>-1</button>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}
