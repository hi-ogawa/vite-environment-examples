import { tinyassert } from "@hiogawa/utils";
import ReactDomClient from "react-dom/client";
import { Root } from "./routes";
import React from "react";

async function main() {
  const el = document.getElementById("root");
  tinyassert(el);
  React.startTransition(() => {
    ReactDomClient.hydrateRoot(el, <Root />);
  });
}

main();
