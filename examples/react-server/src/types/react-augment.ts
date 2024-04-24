import type {} from "react-dom/server";
import type {} from "react-dom/client";

declare module "react-dom/server" {
  interface RenderToReadableStreamOptions {
    formState: unknown;
  }
}

declare module "react-dom/client" {
  interface HydrationOptions {
    formState: unknown;
  }
}
