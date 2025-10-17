export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET") {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);
    const lastSegment = url.pathname.split("/").pop() || "";
    const hasExtension = lastSegment.includes(".");

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

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
  },
};
