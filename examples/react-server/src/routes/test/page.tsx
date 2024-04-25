import { sleep } from "@hiogawa/utils";

export default async function Page() {
  await sleep(300);
  return <div>hello</div>;
}
