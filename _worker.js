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
    ["SUPABASE_PROJECT_ID", "VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID"],
    ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY"],
    ["SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_URL"],
  ];

  for (const [label, ...names] of required) {
    const value = await readBinding(env, names);
    if (!value) {
      console.error(`Missing Supabase binding for ${label}`);
      return false;
    }
  }

  return true;
}

async function readBinding(env, names) {
  for (const name of names) {
    const binding = env[name];
    if (!binding) {
      continue;
    }

    if (typeof binding === "string") {
      const trimmed = binding.trim();
      if (trimmed) {
        return trimmed;
      }
      continue;
    }

    if (typeof binding.get === "function") {
      try {
        const value = binding.get.length > 0 ? await binding.get(name) : await binding.get();
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed) {
            return trimmed;
          }
        } else if (value) {
          return value;
        }
      } catch (error) {
        console.error(`Failed to read binding for ${name}`, error);
      }
    }
  }

  return undefined;
}
