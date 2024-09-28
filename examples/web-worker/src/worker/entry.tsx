import ReactDomServer from "react-dom/server";
import dep from "./dep";
import { depThrowError } from "./dep-error";

self.addEventListener("message", (e) => {
  if (e.data.type === "render") {
    const root = (
      <div>
        <div>Rendered in web worker</div>
        <div>{dep}</div>
      </div>
    );
    const result = ReactDomServer.renderToString(root);
    self.postMessage({ type: "render", data: result });
  }
  if (e.data.type === "error") {
    depThrowError();
  }
});

self.postMessage({ type: "ready" });
