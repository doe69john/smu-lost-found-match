export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return env.ASSETS.fetch(request);
    }

    const lastSegment = url.pathname.split("/").pop() || "";
    const hasExtension = lastSegment.includes(".");

    let response = await env.ASSETS.fetch(request);

    if (response.status === 404) {
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
      const headers = new Headers(request.headers);
      const indexRequest = new Request(indexUrl.toString(), {
        headers,
        method: "GET",
      });
      response = await env.ASSETS.fetch(indexRequest);
    }

    if (!isHtmlResponse(response)) {
      return response;
    }

    return injectSupabaseEnv(response, env);
  },
};

function isHtmlResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

async function injectSupabaseEnv(response, env) {
  const supabaseUrl = env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? "";

  const script = `<script>window.__SUPABASE_URL__ = ${JSON.stringify(
    supabaseUrl
  )}; window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(
    supabaseAnonKey
  )};</script>`;

  const originalBody = await response.text();
  const injectedBody = originalBody.includes("</head>")
    ? originalBody.replace("</head>", `${script}</head>`)
    : `${script}${originalBody}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(injectedBody, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
