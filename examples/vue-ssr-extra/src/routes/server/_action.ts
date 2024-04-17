let counter = 0;

export async function getCounter() {
  return counter;
}

export async function changeCounter(delta: number) {
  counter += delta;
}
