import { del } from "@vercel/blob";
import { getRedis, KEY_MENU, KEY_MENU_PREV } from "../lib/redis.js";
import { requireAdmin } from "../lib/auth.js";
import { validateSite } from "../lib/validate.js";
import { send, sendError, readJson } from "../lib/http.js";

// Todas as fotos em uso: as dos produtos e as do carrossel.
const photosOf = (site) => new Set([
  ...(site?.products ?? []).map((p) => p.photo),
  ...(site?.content?.carousel ?? []).map((c) => c.url),
].filter(Boolean));
const isBlobUrl = (u) => { try { return new URL(u).hostname.endsWith(".blob.vercel-storage.com"); } catch { return false; } };

export default async function handler(req, res) {
  try {
    // ---------- Leitura pública: qualquer visitante recebe o cardápio ----------
    if (req.method === "GET") {
      const data = await getRedis().get(KEY_MENU);
      // Cache curto na CDN: aguenta picos de acesso e a edição aparece em poucos segundos.
      res.setHeader("Cache-Control", "public, s-maxage=5");
      return send(res, 200, { data: data ?? null });
    }

    // ---------- Gravação: só com sessão de administrador ----------
    if (req.method === "PUT") {
      res.setHeader("Cache-Control", "no-store");
      requireAdmin(req);
      const clean = validateSite(await readJson(req));
      const redis = getRedis();

      const previous = await redis.get(KEY_MENU);
      if (previous) await redis.set(KEY_MENU_PREV, previous); // 1 nível de backup
      await redis.set(KEY_MENU, clean);

      // Apaga do Blob as fotos que deixaram de ser usadas (não bloqueia o salvamento se falhar).
      try {
        const still = photosOf(clean);
        const orphans = [...photosOf(previous)].filter((u) => !still.has(u) && isBlobUrl(u));
        if (orphans.length) await del(orphans);
      } catch (e) {
        console.warn("Não foi possível limpar fotos antigas:", e?.message);
      }
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, PUT");
    return send(res, 405, { error: "Método não permitido." });
  } catch (e) {
    return sendError(res, e);
  }
}
