import "./lib/polyfill-webpack";
import ReactDomClient from "react-dom/client";
import ReactClient from "react-server-dom-webpack/client.browser";

async function main() {
  ReactDomClient;
  ReactClient;
}

main();
