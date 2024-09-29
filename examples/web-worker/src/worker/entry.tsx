import ReactDomServer from "react-dom/server";
import depCondition from "test-dep-conditions";
import dep from "./dep";
import { depThrowError } from "./dep-error";
import workerInWorkerUrl from "./worker-in-worker?worker-runner";

self.addEventListener("message", (e) => {
  if (e.data.type === "render") {
    const root = (
      <div>
        <div>Rendered in web worker</div>
        <div>{dep}</div>
        <div>test-dep-conditions: {depCondition}</div>
      </div>
    );
    const result = ReactDomServer.renderToString(root);
    self.postMessage({ type: "render", data: result });
  }
  if (e.data.type === "error") {
    depThrowError();
  }
  if (e.data.type === "worker-in-worker") {
    const worker = new Worker(workerInWorkerUrl, { type: "module" });
    worker.addEventListener("message", (e) => {
      if (e.data.type === "ready") {
        self.postMessage({ type: "worker-in-worker", data: e.data.data });
      }
    });
  }
});

self.postMessage({ type: "ready" });
