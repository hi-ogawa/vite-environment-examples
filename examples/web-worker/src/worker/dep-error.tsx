export interface _SomeTs {
  hello: "world";
}

export function depThrowError() {
  depThrowError2();
}

function depThrowError2() {
  throw new Error("test-error-stack");
}
