import React from "react";

export function Root() {
  return (
    <div>
      <div>Rendered in web worker</div>
      <pre>[rendered at {new Date().toISOString()}]</pre>
      <React.Suspense
        fallback={<div>[Suspense:fallback] Sleeping 2 sec...</div>}
      >
        <div>
          [Suspense:OK] <Sleep ms={2000} />
        </div>
      </React.Suspense>
    </div>
  );
}

async function Sleep(props: { ms: number }) {
  await new Promise((r) => setTimeout(r, props.ms));
  return <pre>[rendered at {new Date().toISOString()}]</pre>;
}
