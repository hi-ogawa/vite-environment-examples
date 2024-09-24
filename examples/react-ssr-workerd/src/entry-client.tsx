import { tinyassert } from "@hiogawa/utils";
import React from "react";
import ReactDomClient from "react-dom/client";
import Page from "./routes/page";

async function main() {
  const el = document.getElementById("root");
  tinyassert(el);
  React.startTransition(() => {
    ReactDomClient.hydrateRoot(el, <Page url={window.location.href} />);
  });
}

main();
