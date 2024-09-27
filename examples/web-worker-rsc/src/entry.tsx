import "./polyfill-webpack";
import ReactDomClient from "react-dom/client";
import { App } from "./app";

async function main() {
  const el = document.getElementById("root");
  ReactDomClient.createRoot(el!).render(<App />);
}

main();
