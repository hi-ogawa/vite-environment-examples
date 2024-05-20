// cf.
// https://github.com/TanStack/router/blob/05941e5ef2b7d2776e885cf473fdcc3970548b22/packages/history/src/index.ts

export function listenWindowHistory(onNavigation: () => void) {
  window.addEventListener("popstate", onNavigation);

  initStateKey();

  const oldPushState = window.history.pushState;
  window.history.pushState = function (...args) {
    args[0] = addStateKey(args[0]);
    const res = oldPushState.apply(this, args);
    onNavigation();
    return res;
  };

  const oldReplaceState = window.history.replaceState;
  window.history.replaceState = function (...args) {
    args[0] = addStateKey(args[0]);
    const res = oldReplaceState.apply(this, args);
    onNavigation();
    return res;
  };

  return () => {
    window.removeEventListener("popstate", onNavigation);
    window.history.pushState = oldPushState;
    window.history.replaceState = oldReplaceState;
  };
}

type HistoryState = null | {
  key?: string;
};

function initStateKey() {
  window.history.replaceState(
    addStateKey(window.history.state),
    "",
    window.location.href,
  );
}

function addStateKey(state: any) {
  const key = Math.random().toString(36).slice(2);
  return Object.assign({}, state || {}, { key } satisfies HistoryState);
}

export class BackForawrdCache {
  private cache: Record<string, any> = {};

  run<T>(f: () => T): T {
    const key = (window.history.state as HistoryState)?.key;
    if (typeof key === "string") {
      return (this.cache[key] ??= f());
    }
    return f();
  }
}
