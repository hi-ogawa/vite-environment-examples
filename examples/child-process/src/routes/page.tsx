import React from "react";

export default async function Page(props: { url: URL }) {
  if (props.url.searchParams.has("crash-rsc-page")) {
    throw new Error("boom");
  }

  return (
    <div>
      {typeof Bun !== "undefined" ? (
        <>
          <meta name="bun-version" content={Bun.version} />
          <pre>Bun.version: {Bun.version}</pre>
        </>
      ) : (
        <>
          <pre>process.version: {process.version}</pre>
        </>
      )}
      <div>
        <React.Suspense fallback={"Sleeping 1 sec ..."}>
          <Sleep ms={1000} />
        </React.Suspense>
      </div>
    </div>
  );
}

async function Sleep(props: { ms: number }) {
  await Bun.sleep(props.ms);
  return <div>Done!</div>;
}
