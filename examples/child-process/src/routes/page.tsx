export default function Page() {
  return (
    <div>
      <meta name="bun-version" content={Bun.version} />
      <pre>Bun.version: {Bun.version}</pre>
    </div>
  );
}
