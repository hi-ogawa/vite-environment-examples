import { changeCount1, count1 } from "./_action";

export default function Page() {
  return (
    <div>
      <h4>Server action</h4>
      <div>
        <h4>File</h4>
        <form action={changeCount1}>
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
        <h4>Function</h4>
        <form>TODO</form>
        {false && (
          <form action={changeCount2}>
            <span>Count: {count2}</span>
          </form>
        )}
      </div>
      <div>
        <h4>Closure</h4>
        <form>TODO</form>
      </div>
    </div>
  );
}

let count2 = 0;

async function changeCount2() {
  "use server";
}