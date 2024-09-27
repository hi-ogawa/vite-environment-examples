import React from "react";

export function Root() {
  return (
    <div>
      <div>Rendered in web worker</div>
      <pre>[rendered at {new Date().toISOString()}]</pre>
      <React.Suspense
        fallback={
          <div>
            [Suspense:fallback] <pre>Sleeping 1 sec...</pre>
          </div>
        }
      >
        <div>
          [Suspense:OK] <Sleep ms={1000} />
        </div>
      </React.Suspense>
    </div>
  );
}

async function Sleep(props: { ms: number }) {
  await new Promise((r) => setTimeout(r, props.ms));
  return <pre>[rendered at {new Date().toISOString()}]</pre>;
}
