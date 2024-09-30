import React from "react";
import ReactClient from "react-server-dom-webpack/client";
import workerUrl from "./worker/entry?worker-env";

export function App() {
  const [count, setCount] = React.useState(0);
  const [workerMessage, setWorkerMessage] = React.useState<React.ReactNode>(
    "Waiting for worker...",
  );

  React.useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    worker.addEventListener("message", async (e) => {
      const root = await ReactClient.createFromReadableStream<React.ReactNode>(
        e.data,
      );
      setWorkerMessage(root);
    });
    return () => {
      worker.terminate();
    };
  }, []);

  return (
    <div>
      <h4>Client</h4>
      <div>Count: {count}</div>
      <button onClick={() => setCount((c) => c - 1)}>-1</button>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
      <hr />
      <h4>Worker</h4>
      <div data-testid="worker-message">{workerMessage}</div>
    </div>
  );
}
