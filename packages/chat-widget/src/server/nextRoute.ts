import type { FormFillRequestHandler } from "./createFormFillHandler";

export function createNextRoute(handler: FormFillRequestHandler) {
  if (!handler) {
    throw new Error("createNextRoute requires a request handler instance.");
  }

  return {
    async POST(request: Request) {
      return handler(request);
    },
    async OPTIONS() {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: "POST",
        },
      });
    },
  } satisfies Record<string, (request: Request) => Promise<Response>>;
}
