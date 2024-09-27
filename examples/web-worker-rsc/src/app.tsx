import React from "react";
import workerUrl from "./worker/entry?worker-runner";

export function App() {
  const [count, setCount] = React.useState(0);
  const [workerMessage, setWorkerMessage] = React.useState(
    "Waiting for worker...",
  );

  React.useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    worker.addEventListener("message", (e) => {
      setWorkerMessage(e.data);
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
      <div
        data-testid="worker-message"
        dangerouslySetInnerHTML={{ __html: workerMessage }}
      ></div>
    </div>
  );
}
