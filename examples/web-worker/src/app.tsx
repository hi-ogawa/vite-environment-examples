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
    worker.postMessage("ping");
    return () => {
      worker.terminate();
    };
  }, []);

  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((c) => c - 1)}>-1</button>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
      <hr />
      <div
        data-testid="worker-message"
        dangerouslySetInnerHTML={{ __html: workerMessage }}
      ></div>
    </div>
  );
}
