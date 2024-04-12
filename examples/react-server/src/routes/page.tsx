import { changeCounter, getCounter } from "./_action";
import { ClientComponent } from "./_client";

export default function Page() {
  return (
    <div>
      <h4>Hello Server Component</h4>
      <div>
        <h4>Hello Server Action</h4>
        <form action={changeCounter}>
          <div>Count: {getCounter()}</div>
          <button name="value" value={-1}>
            -1
          </button>
          <button name="value" value={+1}>
            +1
          </button>
        </form>
      </div>
      <ClientComponent />
    </div>
  );
}
