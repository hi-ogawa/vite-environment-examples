"use client";

import React from "react";

export function Link(props: JSX.IntrinsicElements["a"] & { href: string }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        if (
          e.currentTarget instanceof HTMLAnchorElement &&
          e.button === 0 &&
          !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) &&
          (!e.currentTarget.target || e.currentTarget.target === "_self")
        ) {
          e.preventDefault();
          history.pushState(null, "", e.currentTarget.href);
        }
      }}
    />
  );
}

type RouterContextType = {
  isPending: boolean;
};

export const RouterContext = React.createContext<RouterContextType>({
  isPending: false,
});

export function useRouter() {
  return React.use(RouterContext);
}