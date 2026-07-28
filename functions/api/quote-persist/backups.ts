import { type PersistEnv, listPersistBackups } from "../../_shared/persistStorage";

type Context = { env: PersistEnv };

export async function onRequestGet(context: Context): Promise<Response> {
  const backups = await listPersistBackups(context.env);
  return Response.json({
    files: backups.map((item) => ({ name: item.name, mtime: item.created_at, size: item.byte_size })),
  }, { headers: { "Cache-Control": "no-store" } });
}
