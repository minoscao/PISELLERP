import { onRequestGet as getCatalogSeed } from "../functions/api/catalog-seed";
import {
  onRequestDelete as deletePersistState,
  onRequestGet as getPersistState,
  onRequestPost as postPersistState,
  onRequestPut as putPersistState,
} from "../functions/api/quote-persist";
import { onRequestGet as listPersistBackups } from "../functions/api/quote-persist/backups";
import { onRequestGet as getPersistBackup } from "../functions/api/quote-persist/backups/[name]";
import type { PersistEnv } from "../functions/_shared/persistStorage";

type WorkerEnv = PersistEnv & {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Optional recovery source used only when the R2 state object has not been seeded yet. */
  PERSIST_SEED_URL?: string;
};

type WorkerContext = { waitUntil(promise: Promise<unknown>): void };

const DEFAULT_PERSIST_SEED_URL =
  "https://media.githubusercontent.com/media/minoscao/PISELLERP/main/data/marketing-quote-v1.json";

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Storage request failed";
  return Response.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

async function restoreSeedState(env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
  const seed = await fetch(env.PERSIST_SEED_URL || DEFAULT_PERSIST_SEED_URL, { cache: "no-store" });
  if (!seed.ok || !seed.body) return new Response(null, { status: 404 });

  const [responseBody, storageBody] = seed.body.tee();
  const contentType = seed.headers.get("content-type") || "application/json; charset=utf-8";
  ctx.waitUntil(env.R2.put("erp-state/marketing-quote-v1.json", storageBody, {
    httpMetadata: { contentType },
  }));
  return new Response(responseBody, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": contentType,
      "X-Pisell-State-Source": "recovery-seed",
    },
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === "/api/catalog-seed") {
        return request.method === "GET"
          ? getCatalogSeed({ env })
          : new Response(null, { status: 405 });
      }

      if (pathname === "/api/quote-persist") {
        if (request.method === "GET") {
          const response = await getPersistState({ request, env });
          return response.status === 404 ? restoreSeedState(env, ctx) : response;
        }
        if (request.method === "PUT") return putPersistState({ request, env });
        if (request.method === "POST") return postPersistState({ request, env });
        if (request.method === "DELETE") return deletePersistState({ request, env });
        return new Response(null, { status: 405 });
      }

      if (pathname === "/api/quote-persist/backups") {
        return request.method === "GET"
          ? listPersistBackups({ env })
          : new Response(null, { status: 405 });
      }

      const backupMatch = pathname.match(/^\/api\/quote-persist\/backups\/([^/]+)$/);
      if (backupMatch) {
        if (request.method !== "GET") return new Response(null, { status: 405 });
        return getPersistBackup({ env, params: { name: decodeURIComponent(backupMatch[1] || "") } });
      }
    } catch (error) {
      return jsonError(error);
    }

    return env.ASSETS.fetch(request);
  },
};
