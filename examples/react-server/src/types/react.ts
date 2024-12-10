import type {} from "react-dom/client";
import type {} from "react-dom/server";

declare module "react-dom/server" {
  interface RenderToReadableStreamOptions {
    formState: unknown;
  }
}
