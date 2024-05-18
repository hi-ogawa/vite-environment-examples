export default function Page() {
  return (
    <div>
      <h4>Server action</h4>
      <div>
        <h5>Function directive</h5>
        {false && (
          <form action={changeCount}>
            <span>Count: {count}</span>
          </form>
        )}
      </div>
      <div>
        <h5>Closure</h5>
      </div>
    </div>
  );
}

let count = 0;

async function changeCount() {
  "use server";
}
