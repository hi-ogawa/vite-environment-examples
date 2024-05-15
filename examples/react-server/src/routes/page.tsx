import "./_server.css";
import { changeCounter, getCounter } from "./_action";
import { ClientComponent, UseActionStateDemo } from "./_client";
import { SharedComponent } from "./_shared";

export default async function Page() {
  return (
    <div>
      <SharedComponent message="server" />
      <div className="flex justify-center w-36 m-1 p-1 important:(bg-[rgb(220,220,255)])">
        unocss (server)
      </div>
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
