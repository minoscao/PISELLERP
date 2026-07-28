import {
  type PersistEnv,
  deletePersistState,
  getPersistState,
  putPersistState,
} from "../_shared/persistStorage";

type Context = { request: Request; env: PersistEnv };

export async function onRequestGet(context: Context): Promise<Response> {
  const stored = await getPersistState(context.env);
  if (!stored) return new Response(null, { status: 404 });
  const headers = new Headers({ "Cache-Control": "no-store" });
  stored.writeHttpMetadata(headers);
  headers.set("Content-Type", stored.httpMetadata?.contentType || "application/json; charset=utf-8");
  return new Response(stored.body, { headers });
}

export async function onRequestPut(context: Context): Promise<Response> {
  await putPersistState(context.request, context.env);
  return new Response(null, { status: 204 });
}

export const onRequestPost = onRequestPut;

export async function onRequestDelete(context: Context): Promise<Response> {
  await deletePersistState(context.env);
  return new Response(null, { status: 204 });
}
