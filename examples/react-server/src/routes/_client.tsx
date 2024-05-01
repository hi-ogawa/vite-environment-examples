"use client";

import "./_client.css";
import React from "react";
import { checkAnswer } from "./_action";
import { SharedComponent } from "./_shared";

export function ClientComponent() {
  const [count, setCount] = React.useState(0);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div data-testid="client-component">
      <h4>Hello Client Component</h4>
      <SharedComponent message="client" />
      <div className="flex justify-center w-36 m-1 p-1 important:(bg-[rgb(255,220,220)])">
        unocss (client)
      </div>
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
  const [data, formAction, isPending] = React.useActionState(checkAnswer, null);

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
