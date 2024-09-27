import "./polyfill";
import ReactServer from "react-server-dom-webpack/server";
import dep from "./dep";

const root = (
  <div>
    <div>Rendered in web worker</div>
    <div>{dep}</div>
  </div>
);

const stream = ReactServer.renderToReadableStream(root, {}, {});
console.log(stream);
self.postMessage("TODO");
