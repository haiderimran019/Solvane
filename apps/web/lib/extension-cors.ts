const ALLOWED_EXTENSION_ORIGINS = new Set([
  "https://chatgpt.com",
  "https://claude.ai",
  "https://gemini.google.com",
  "https://www.perplexity.ai",
]);

export function extensionOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  return origin && ALLOWED_EXTENSION_ORIGINS.has(origin) ? origin : null;
}

export function extensionHeaders(request: Request): HeadersInit {
  const origin = extensionOrigin(request);
  return origin
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "content-type, x-solvane-extension",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        vary: "Origin",
      }
    : {};
}

export function extensionOptions(request: Request): Response {
  return new Response(null, { status: extensionOrigin(request) ? 204 : 403, headers: extensionHeaders(request) });
}

export function withExtensionCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  Object.entries(extensionHeaders(request)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
