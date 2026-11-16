import { randomBytes } from "node:crypto";
import { join, resolve, sep } from "node:path";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const BASE_URL = (
  process.env.BASE_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`)
).replace(/\/+$/, "");
const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? resolve(process.env.PUBLIC_DIR)
  : null;
const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function makeCode() {
  let code;
  do {
    code = "";
    while (code.length < 6) {
      for (const byte of randomBytes(8)) {
        if (byte < 248) code += alphabet[byte % alphabet.length];
        if (code.length === 6) break;
      }
    }
  } while (links.has(code));
  return code;
}

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: corsHeaders,
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function serveStatic(pathname) {
  if (!PUBLIC_DIR) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const filePath = resolve(join(PUBLIC_DIR, relativePath));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${sep}`)) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  return new Response(file, {
    headers: {
      ...corsHeaders,
      "Content-Type": file.type,
    },
  });
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      let url;
      try {
        if (typeof body?.url !== "string") throw new Error();
        url = new URL(body.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        return jsonResponse({ error: "URL must use http or https" }, 400);
      }

      const code = makeCode();
      const link = {
        code,
        url: url.href,
        shortUrl: `${BASE_URL}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return jsonResponse(link, 201);
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return jsonResponse(Array.from(links.values()));
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const staticResponse = await serveStatic(pathname);
      if (staticResponse) {
        return request.method === "HEAD"
          ? new Response(null, {
              status: staticResponse.status,
              statusText: staticResponse.statusText,
              headers: staticResponse.headers,
            })
          : staticResponse;
      }
    }

    if (request.method === "GET" && /^\/[^/]+$/.test(pathname)) {
      const code = pathname.slice(1);
      const link = links.get(code);
      if (!link) return jsonResponse({ error: "Link not found" }, 404);
      link.hits += 1;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: link.url,
        },
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on port ${PORT}`);
