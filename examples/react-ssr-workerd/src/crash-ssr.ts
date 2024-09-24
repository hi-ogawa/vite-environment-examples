export type Test = {
  a: 0;
  b: 1;
};

export function crashSsr(message: string): never {
  throw new Error(message);
}
