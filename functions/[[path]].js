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
  const lastSegment = url.pathname.split("/").pop() || "";
  const hasExtension = lastSegment.includes(".");

  if (hasExtension) {
    return response;
  }

  const accept = (request.headers.get("accept") || "").toLowerCase();
  const secFetchMode = (request.headers.get("sec-fetch-mode") || "").toLowerCase();

  const isNavigation =
    secFetchMode === "navigate" ||
    secFetchMode === "document" ||
    accept.includes("text/html");

  if (!isNavigation) {
    return response;
  }

  const indexUrl = new URL("/index.html", url);
  return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
}
