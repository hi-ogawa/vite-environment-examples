import React from "react";

export function App() {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((c) => c - 1)}>-1</button>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}
