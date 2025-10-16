export async function onRequest(context) {
  const { request, next, env } = context;

  if (request.method !== "GET") {
    return next();
  }

  const response = await next();
  if (response.status !== 404) {
    return response;
  }

  const accept = request.headers.get("accept") || "";
  if (!accept.includes("text/html")) {
    return response;
  }

  const url = new URL(request.url);
  const indexUrl = new URL("/index.html", url);
  return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
}
