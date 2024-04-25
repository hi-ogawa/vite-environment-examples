import fs from "node:fs";

export default async function Page() {
  const pkg = await fs.promises.readFile("package.json", "utf-8");
  return (
    <div>
      <div>hello</div>
      <pre>{pkg.slice(0, 100)}</pre>
    </div>
  );
}
