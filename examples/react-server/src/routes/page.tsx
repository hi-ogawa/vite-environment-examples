import "./_server.css";
import { changeCounter, getCounter } from "./_action";
import { ClientComponent, UseActionStateDemo } from "./_client";
import { SharedComponent } from "./_shared";

export default async function Layout() {
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
        <Page />
      </body>
    </html>
  );
}

async function Page() {
  return (
    <div>
      <h4>Hello Server Component</h4>
      <SharedComponent message="server" />
      <ServerActionDemo />
      <ClientComponent />
    </div>
  );
}

function ServerActionDemo() {
  return (
    <div data-testid="server-action">
      <h4>Hello Server Action</h4>
      <form action={changeCounter}>
        <div>Count: {getCounter()}</div>
        <button className="server-btn" name="value" value={-1}>
          -1
        </button>
        <button className="server-btn" name="value" value={+1}>
          +1
        </button>
      </form>
      <UseActionStateDemo />
    </div>
  );
}
