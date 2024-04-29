"use client";

import "./_client.css";
import React from "react";
import { checkAnswer } from "./_action";

export function ClientComponent() {
  const [count, setCount] = React.useState(0);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div data-testid="client-component">
      <h4>Hello Client Component</h4>
      <div data-hydrated={hydrated}>hydrated: {String(hydrated)}</div>
      <div>Count: {count}</div>
      <button className="client-btn" onClick={() => setCount((v) => v - 1)}>
        -1
      </button>
      <button className="client-btn" onClick={() => setCount((v) => v + 1)}>
        +1
      </button>
    </div>
  );
}

export function UseActionStateDemo() {
  const useActionState = (React as any).useActionState as ReactUseActionState;
  const [data, formAction, isPending] = useActionState(checkAnswer, null);

  return (
    <form action={formAction}>
      <h4>Hello useActionState</h4>
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
        <div>1 + 1 = </div>
        <input
          className="client-input"
          name="answer"
          placeholder="Answer?"
          required
        />
        <div data-testid="action-state">
          {isPending ? (
            "..."
          ) : data ? (
            <>
              {data.message} (tried{" "}
              {data.count === 1 ? "once" : data.count + " times"})
            </>
          ) : null}
        </div>
      </div>
    </form>
  );
}

// type is copied from ReactDOM.useFormState
// https://github.com/facebook/react/pull/28491
type ReactUseActionState = <State, Payload>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: Awaited<State>,
  permalink?: string,
) => [
  state: Awaited<State>,
  dispatch: (payload: Payload) => void,
  isPending: boolean,
];
