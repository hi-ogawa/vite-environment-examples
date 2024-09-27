import "../polyfill-webpack";
import ReactServer from "react-server-dom-webpack/server";
import { Root } from "./root";

const stream = ReactServer.renderToReadableStream(<Root />, {}, {});
self.postMessage(stream, { transfer: [stream] });
