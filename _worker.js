export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/config.js") {
      const config = {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL ?? "",
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ?? "",
      };

      return new Response(
        `window.__APP_CONFIG = ${JSON.stringify(config)};`,
        {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    if (request.method !== "GET") {
      return env.ASSETS.fetch(request);
    }

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
