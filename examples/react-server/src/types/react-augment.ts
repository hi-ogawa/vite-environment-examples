import "react-dom/server";
import "react-dom/client";

// formState not typed yet
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
