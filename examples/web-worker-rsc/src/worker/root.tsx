import React from "react";

export function Root() {
  return (
    <div>
      <div>Rendered in web worker</div>
      <pre>[rendered at {new Date().toISOString()}]</pre>
      <React.Suspense fallback={<div>Sleeping 1 sec...</div>}>
        <Sleep ms={1000} />
      </React.Suspense>
    </div>
  );
}

async function Sleep(props: { ms: number }) {
  await new Promise((r) => setTimeout(r, props.ms));
  return <pre>[rendered at {new Date().toISOString()}]</pre>;
}
