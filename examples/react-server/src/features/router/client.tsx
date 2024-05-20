"use client";

import React from "react";

export function Link({
  activeProps,
  pendingProps,
  ...props
}: JSX.IntrinsicElements["a"] & {
  activeProps?: JSX.IntrinsicElements["a"];
  pendingProps?: JSX.IntrinsicElements["a"];
}) {
  const { isPending, pathname } = useRouter();

  return (
    <a
      {...props}
      {...(props.href === pathname ? activeProps : {})}
      {...(props.href === pathname && isPending ? pendingProps : {})}
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
  pathname: string;
};

export const RouterContext = React.createContext<RouterContextType>(undefined!);

export function useRouter() {
  return React.use(RouterContext);
}
