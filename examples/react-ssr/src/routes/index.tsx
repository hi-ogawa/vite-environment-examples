import React from "react";

export function Root() {
  const [count, setCount] = React.useState(0);

  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((v) => v - 1)}>-1</button>
      <button onClick={() => setCount((v) => v + 1)}>+1</button>
    </div>
  );
}
