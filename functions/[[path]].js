export async function onRequest(context) {
  const { request, next, env } = context;

  if (request.method !== "GET") {
    return next();
  }

  const response = await next();
  if (response.status !== 404) {
    return response;
  }

  const url = new URL(request.url);
  const accept = (request.headers.get("accept") || "").toLowerCase();
  const lastSegment = url.pathname.split("/").pop() || "";
  const hasExtension = lastSegment.includes(".");

  const isHtmlNavigation =
    accept.includes("text/html") || accept.includes("*/*") || !hasExtension;

  if (!isHtmlNavigation) {
    return response;
  }

  const indexUrl = new URL("/index.html", url);
  return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
}
