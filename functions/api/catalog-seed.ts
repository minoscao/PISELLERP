import { type PersistEnv } from "../_shared/persistStorage";

type Context = { env: PersistEnv };
const CATALOG_OBJECT_KEY = "catalog/pisellHardwareSeed.json";

export async function onRequestGet(context: Context): Promise<Response> {
  const stored = await context.env.R2.get(CATALOG_OBJECT_KEY);
  if (!stored) return new Response(null, { status: 404 });
  const headers = new Headers({ "Cache-Control": "public, max-age=3600" });
  stored.writeHttpMetadata(headers);
  headers.set("Content-Type", stored.httpMetadata?.contentType || "application/json; charset=utf-8");
  return new Response(stored.body, { headers });
}
