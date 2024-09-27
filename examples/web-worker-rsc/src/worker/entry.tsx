import ReactDomServer from "react-dom/server";
import dep from "./dep";

const root = (
  <div>
    <div>Rendered in web worker</div>
    <div>{dep}</div>
  </div>
);

const result = ReactDomServer.renderToString(root);
self.postMessage(result);
