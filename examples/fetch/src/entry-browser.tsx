import "./lib/polyfill-webpack";
import ReactDomClient from "react-dom/client";
import ReactClient from "react-server-dom-webpack/client";

async function main() {
  ReactDomClient;
  ReactClient;
}

main();
