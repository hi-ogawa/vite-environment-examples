import { changeCount1, count1 } from "./_action";
import { Counter3 } from "./_client";

export default function Page() {
  return (
    <div>
      <h4>Server action</h4>
      <div>
        <h4 style={{ marginBottom: "0.5rem" }}>
          "use server" file + server component
        </h4>
        <form action={changeCount1} data-testid="counter1">
          <div>Count: {count1}</div>
          <button name="value" value={-1}>
            -1
          </button>
          <button name="value" value={+1}>
            +1
          </button>
        </form>
      </div>
      <div>
        <h4 style={{ marginBottom: "0.5rem" }}>
          "use server" top-level function + server component
        </h4>
        <form action={changeCount2} data-testid="counter2">
          <div>Count: {count2}</div>
          <button name="value" value={-1}>
            -1
          </button>
          <button name="value" value={+1}>
            +1
          </button>
        </form>
      </div>
      <div>
        <h4 style={{ marginBottom: "0.5rem" }}>
          "use server" file + client component
        </h4>
        <Counter3 />
      </div>
      <div>
        <h4 style={{ marginBottom: "0.5rem" }}>
          "use server" closure + server component
        </h4>
        {"todo" || <Counter4 />}
      </div>
    </div>
  );
}

let count2 = 0;

async function changeCount2(formData: FormData) {
  "use server";
  count2 += Number(formData.get("value"));
}

let count4 = 0;

function Counter4() {
  const name = Math.random().toString(36).slice(2);

  async function changeCount4(formData: FormData) {
    "use server";
    // - `count4` at top-level scope should be kept as is
    // - `name` in server component scope should be bound to server action
    count4 += Number(formData.get(name));
  }

  return (
    <form action={changeCount4} data-testid="counter4">
      <div>Count: {count4}</div>
      <button name={name} value={-1}>
        -1
      </button>
      <button name={name} value={+1}>
        +1
      </button>
    </form>
  );
}

/*
[closure server action lifting transform]

export function $$lift_changeCount4(name, formData) {
  ...
}

$$lift_changeCount4 = $$register($$lift_changeCount4, "<id>", "$$lift_changeCount4");

function Counter4() {
  const name = ...;
  const changeCount4 = $$lift_changeCount4.bind(name);
  ...
}
*/
