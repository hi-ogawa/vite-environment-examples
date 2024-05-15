import { sleep } from "@hiogawa/utils";

export default async function Page() {
  await sleep(1000);
  return <h4>Slow Page</h4>;
}
