"use client";

import React from "react";
import { changeCount3 } from "./_action2";

export function Counter3() {
  const [count, formAction] = React.useActionState(changeCount3, null);
  return (
    <form action={formAction} data-testid="counter3">
      <div>Count: {count ?? 0}</div>
      <button name="value" value={-1}>
        -1
      </button>
      <button name="value" value={+1}>
        +1
      </button>
    </form>
  );
}
