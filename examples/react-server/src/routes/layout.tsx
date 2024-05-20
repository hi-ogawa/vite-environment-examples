import { Link } from "../features/router/client";
import { EffectCount, GlobalProgress, Hydrated } from "./_client";

export default async function Layout(props: React.PropsWithChildren) {
  return (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <title>react-server</title>
        <meta
          name="viewport"
          content="width=device-width, height=device-height, initial-scale=1.0"
        />
      </head>
      <body>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h4>Hello Server Component</h4>
          <a href="https://github.com/hi-ogawa/vite-environment-examples/tree/main/examples/react-server">
            GitHub
          </a>
          <GlobalProgress />
        </div>
        <ul>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/slow">Slow</Link>
          </li>
          <li>
            <Link href="/not-found">Not Found</Link>
          </li>
        </ul>
        <div style={{ marginBottom: "1rem" }}>
          <input style={{ marginRight: "0.5rem" }} placeholder="(test)" />
          <Hydrated />
          <EffectCount />
        </div>
        {props.children}
      </body>
    </html>
  );
}
