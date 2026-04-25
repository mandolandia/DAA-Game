/**
 * Cliente HTTP para hablar con el plugin de dev server (vite.config.ts).
 * GET / PUT a /api/content/<path>, listado vía /api/list/<dir>.
 */

export async function readJSON<T>(relPath: string): Promise<T> {
  const r = await fetch(`/api/content/${relPath}`);
  if (!r.ok) throw new Error(`GET ${relPath}: ${r.status}`);
  return r.json();
}

export async function writeJSON(relPath: string, data: unknown): Promise<void> {
  const r = await fetch(`/api/content/${relPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2),
  });
  if (!r.ok) throw new Error(`PUT ${relPath}: ${r.status}`);
}

export async function writeBlob(relPath: string, data: Blob | ArrayBuffer): Promise<void> {
  const body = data instanceof Blob ? data : new Blob([data]);
  const r = await fetch(`/api/content/${relPath}`, {
    method: "PUT",
    body,
  });
  if (!r.ok) throw new Error(`PUT ${relPath}: ${r.status}`);
}

export async function list(relDir: string): Promise<string[]> {
  const r = await fetch(`/api/list/${relDir}`);
  if (!r.ok) throw new Error(`LIST ${relDir}: ${r.status}`);
  return r.json();
}
