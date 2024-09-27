import ReactDomServer from "react-dom/server";

const result = ReactDomServer.renderToString(<div>Rendered in web worker</div>);
self.postMessage(result);
