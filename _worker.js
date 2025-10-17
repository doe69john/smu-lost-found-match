export default {
  async fetch(request, env) {
    if (request.method !== "GET") {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);
    const lastSegment = url.pathname.split("/").pop() || "";
    const hasExtension = lastSegment.includes(".");

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (hasExtension) {
      return assetResponse;
    }

    const accept = (request.headers.get("accept") || "").toLowerCase();
    const secFetchMode = (request.headers.get("sec-fetch-mode") || "").toLowerCase();

    const isNavigation =
      secFetchMode === "navigate" ||
      secFetchMode === "document" ||
      accept.includes("text/html");

    if (!isNavigation) {
      return assetResponse;
    }

    const indexUrl = new URL("/index.html", url);
    const headers = new Headers(request.headers);
    const indexRequest = new Request(indexUrl.toString(), {
      headers,
      method: "GET",
    });
    return env.ASSETS.fetch(indexRequest);
  },
};
