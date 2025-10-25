// _worker.js
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // 1) Root → /dashboard (permanent)
      if (url.pathname === "/" || url.pathname === "") {
        url.pathname = "/dashboard";
        return Response.redirect(url.toString(), 301);
      }

      // 2) Try to serve the static asset first
      let assetResponse = await env.ASSETS.fetch(request);

      // If asset exists or it's not a GET, return it as-is
      if (assetResponse.status !== 404 || request.method !== "GET") {
        return assetResponse;
      }

      // 3) If 404 on a GET, decide whether to SPA-fallback to index.html
      const lastSegment = url.pathname.split("/").pop() || "";
      const hasExtension = lastSegment.includes(".");
      if (hasExtension) {
        // Looks like a real file (e.g., .png/.js); return the original 404
        return assetResponse;
      }

      const accept = (request.headers.get("accept") || "").toLowerCase();
      const secFetchMode = (request.headers.get("sec-fetch-mode") || "").toLowerCase();
      const isNavigation =
        secFetchMode === "navigate" ||
        secFetchMode === "document" ||
        accept.includes("text/html");

      if (!isNavigation) {
        // Not a navigation request; keep the 404
        return assetResponse;
      }

      // 4) SPA fallback: serve /index.html from assets
      const indexUrl = new URL("/index.html", url);
      // Make a clean GET request for index.html; do not forward original Accept/headers blindly
      const indexRequest = new Request(indexUrl.toString(), { method: "GET", headers: { accept: "text/html" } });
      return await env.ASSETS.fetch(indexRequest);

    } catch (err) {
      // Helpful error so you see stack in browser + wrangler tail
      return new Response("Internal error:\n" + (err?.stack || String(err)), {
        status: 500,
        headers: { "content-type": "text/plain" }
      });
    }
  }
};
