import { Link } from "../features/router/client";

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
        <h4>Hello Server Component</h4>
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
        {props.children}
      </body>
    </html>
  );
}
