import type {} from "react-dom/client";
import type {} from "react-dom/server";

declare module "react-dom/server" {
  interface RenderToReadableStreamOptions {
    formState: unknown;
  }
}

declare module "react-dom/client" {
  interface HydrationOptions {
    formState: unknown;
  }

  interface DO_NOT_USE_OR_YOU_WILL_BE_FIRED_EXPERIMENTAL_CREATE_ROOT_CONTAINERS {
    Document: Document;
  }
}
