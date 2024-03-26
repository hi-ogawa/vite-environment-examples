export function handler(req: Request) {
  return new Response(`hello: ${req.url}`);
}
