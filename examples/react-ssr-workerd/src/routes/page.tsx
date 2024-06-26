import React from "react";

export default function Page() {
  const [count, setCount] = React.useState<number>();

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
    getCount().then(setCount);
  }, []);

  return (
    <div>
      <div>hydrated: {String(hydrated)}</div>
      <div>Count: {count ?? "..."}</div>
      <button onClick={async () => changeCount(-1).then(setCount)}>-1</button>
      <button onClick={async () => changeCount(+1).then(setCount)}>+1</button>
    </div>
  );
}

async function getCount() {
  const res = await fetch("/api");
  const { count } = await res.json();
  return count as number;
}

async function changeCount(delta: number) {
  const res = await fetch("/api", {
    method: "POST",
    body: JSON.stringify({ delta }),
  });
  const { count } = await res.json();
  return count as number;
}
