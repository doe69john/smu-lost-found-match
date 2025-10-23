export default {
  async fetch(request, env) {
    if (request.method !== "GET") {
      return env.ASSETS.fetch(request);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (shouldBypassSpaRouting(request)) {
      return assetResponse;
    }
    if (!(await haveSupabaseSecrets(env))) {
      return new Response("Missing environment variables", { status: 500 });
    }

    const indexUrl = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};

function shouldBypassSpaRouting(request) {
  const url = new URL(request.url);
  const lastSegment = url.pathname.split("/").pop() || "";
  if (lastSegment.includes(".")) {
    return true;
  }

  const accept = request.headers.get("accept")?.toLowerCase() || "";
  const mode = request.headers.get("sec-fetch-mode")?.toLowerCase() || "";
  const isNavigation =
    mode === "navigate" ||
    mode === "document" ||
    accept.includes("text/html");

  return !isNavigation;
}

async function haveSupabaseSecrets(env) {
  const required = [
    "VITE_SUPABASE_PROJECT_ID",
    "DEFAULT_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_URL",
  ];

  for (const name of required) {
    const value = await readSecret(env, name);
    if (!value) {
      console.error(`Missing Supabase binding for ${name}`);
      return false;
    }
  }

  return true;
}

async function readSecret(env, name) {
  const binding = env[name];
  if (!binding) {
    return undefined;
  }

  if (typeof binding === "string") {
    const trimmed = binding.trim();
    return trimmed || undefined;
  }

  if (typeof binding.get === "function") {
    try {
      const value = binding.get.length > 0 ? await binding.get(name) : await binding.get();
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || undefined;
      }
      return value ?? undefined;
    } catch (error) {
      console.error(`Failed to read binding for ${name}`, error);
    }
  }

  return undefined;
}
