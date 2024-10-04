import "./lib/polyfill-webpack";
import ReactDomServer from "react-dom/server";
import ReactClient from "react-server-dom-webpack/client";

export default function handler(request: Request) {
  ReactDomServer;
  ReactClient;
  request;
}
