import { type PersistEnv, getPersistBackup, isSafeBackupName } from "../../../_shared/persistStorage";

type Context = { env: PersistEnv; params: { name?: string } };

export async function onRequestGet(context: Context): Promise<Response> {
  const name = context.params.name || "";
  if (!isSafeBackupName(name)) return new Response("invalid backup name", { status: 400 });
  const stored = await getPersistBackup(name, context.env);
  if (!stored) return new Response(null, { status: 404 });
  const headers = new Headers({ "Cache-Control": "no-store" });
  stored.writeHttpMetadata(headers);
  headers.set("Content-Type", stored.httpMetadata?.contentType || "application/json; charset=utf-8");
  return new Response(stored.body, { headers });
}
