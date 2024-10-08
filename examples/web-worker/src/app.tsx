import React from "react";
import workerUrl from "./worker/entry?worker-env";

export function App() {
  const [count, setCount] = React.useState(0);
  const [workerMessage, setWorkerMessage] = React.useState(
    "Waiting for worker...",
  );

  React.useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    worker.addEventListener("message", (e) => {
      if (e.data.type === "ready") {
        if (window.location.search.includes("error")) {
          worker.postMessage({ type: "error" });
          setWorkerMessage("See devtool console");
          return;
        }
        if (window.location.search.includes("worker-in-worker")) {
          worker.postMessage({ type: "worker-in-worker" });
          return;
        }
        worker.postMessage({ type: "render" });
      }
      if (e.data.type === "render") {
        setWorkerMessage(e.data.data);
      }
      if (e.data.type === "worker-in-worker") {
        setWorkerMessage(e.data.data);
      }
    });
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
