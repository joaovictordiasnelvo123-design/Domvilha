// Validação do cardápio no SERVIDOR. Nunca confie só na validação do navegador.

export class ValidationError extends Error {}
const fail = (msg) => { throw new ValidationError(msg); };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9_]{1,40}$/;
const URL_RE = /^https:\/\/[^\s"'<>\\]{1,500}$/;
const COLOR_RE = /^(var\(--[a-z0-9-]{1,30}\)|#[0-9a-fA-F]{3,8})$/;
const MAX_JSON_CHARS = 600_000;
const MAX_CAROUSEL = 12;
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function str(v, label, { max = 200, required = false } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) fail(`${label}: campo obrigatório.`);
    return "";
  }
  if (typeof v !== "string") fail(`${label}: texto inválido.`);
  if (v.length > max) fail(`${label}: use no máximo ${max} caracteres.`);
  return v;
}

function num(v, label, { min = 0, max = 99999 } = {}) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) fail(`${label}: número inválido.`);
  return Math.round(v * 100) / 100;
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function validateContent(c) {
  if (!isObj(c)) fail("Conteúdo do site ausente.");
  const out = {};
  for (const [k, v] of Object.entries(c)) {
    if (!KEY_RE.test(k) || BLOCKED_KEYS.has(k) || k === "features" || k === "carousel") continue;
    if (typeof v === "string") {
      if (v.length > 1500) fail(`Conteúdo "${k}": texto muito longo.`);
      out[k] = v;
    }
  }
  out.brandName = str(out.brandName, "Nome do restaurante", { max: 80, required: true });
  const wa = String(out.whatsappNumber ?? "");
  if (!/^\d{10,14}$/.test(wa)) fail("WhatsApp: informe só números, com DDI e DDD (10 a 14 dígitos).");
  out.whatsappNumber = wa;

  const feats = c.features ?? [];
  if (!Array.isArray(feats) || feats.length > 12) fail("Diferenciais: no máximo 12 itens.");
  out.features = feats.map((f, i) => {
    if (!isObj(f)) fail(`Diferencial ${i + 1}: formato inválido.`);
    return {
      title: str(f.title, `Diferencial ${i + 1} (título)`, { max: 100 }),
      desc: str(f.desc, `Diferencial ${i + 1} (descrição)`, { max: 500 }),
    };
  });

  const car = c.carousel ?? [];
  if (!Array.isArray(car) || car.length > MAX_CAROUSEL) fail(`Carrossel: no máximo ${MAX_CAROUSEL} fotos.`);
  out.carousel = car.map((it, i) => {
    if (!isObj(it)) fail(`Carrossel, foto ${i + 1}: formato inválido.`);
    if (typeof it.url !== "string" || !URL_RE.test(it.url)) fail(`Carrossel, foto ${i + 1}: a foto precisa ser enviada pelo painel (link https).`);
    return { url: it.url, alt: str(it.alt, `Carrossel, foto ${i + 1} (descrição)`, { max: 200 }) };
  });
  return out;
}

function validateCategories(list) {
  if (!Array.isArray(list) || list.length > 30) fail("Categorias: no máximo 30.");
  const seen = new Set();
  return list.map((c, i) => {
    if (!isObj(c)) fail(`Categoria ${i + 1}: formato inválido.`);
    if (typeof c.id !== "string" || !ID_RE.test(c.id)) fail(`Categoria ${i + 1}: identificador inválido.`);
    if (seen.has(c.id)) fail(`Categoria "${c.id}" repetida.`);
    seen.add(c.id);
    const color = c.color ?? "var(--chili)";
    if (typeof color !== "string" || !COLOR_RE.test(color)) fail(`Categoria "${c.name}": cor inválida.`);
    return {
      id: c.id,
      name: str(c.name, `Categoria ${i + 1} (nome)`, { max: 60, required: true }),
      color,
    };
  });
}

function validateProducts(list, catIds) {
  if (!Array.isArray(list) || list.length > 300) fail("Produtos: no máximo 300.");
  const seen = new Set();
  return list.map((p, i) => {
    if (!isObj(p)) fail(`Produto ${i + 1}: formato inválido.`);
    const label = `Produto "${typeof p.name === "string" ? p.name : i + 1}"`;
    if (typeof p.id !== "string" || !ID_RE.test(p.id)) fail(`${label}: identificador inválido.`);
    if (seen.has(p.id)) fail(`${label}: identificador repetido.`);
    seen.add(p.id);
    if (!catIds.has(p.cat)) fail(`${label}: categoria inexistente.`);
    if (typeof p.available !== "boolean") fail(`${label}: disponibilidade inválida.`);

    let photo = null;
    if (p.photo) {
      if (typeof p.photo !== "string" || !URL_RE.test(p.photo)) {
        fail(`${label}: a foto precisa ser enviada pelo painel (link https).`);
      }
      photo = p.photo;
    }

    const addons = p.addons ?? [];
    if (!Array.isArray(addons) || addons.length > 20) fail(`${label}: no máximo 20 adicionais.`);

    return {
      id: p.id,
      cat: p.cat,
      name: str(p.name, `${label} (nome)`, { max: 120, required: true }),
      desc: str(p.desc, `${label} (descrição)`, { max: 1000 }),
      price: num(p.price, `${label} (preço)`),
      photo,
      available: p.available,
      badge: str(p.badge, `${label} (selo)`, { max: 60 }),
      spec: str(p.spec, `${label} (peso/nível)`, { max: 60 }),
      addons: addons.map((a, j) => {
        if (!isObj(a)) fail(`${label}: adicional ${j + 1} inválido.`);
        return {
          n: str(a.n, `${label} (adicional ${j + 1})`, { max: 80, required: true }),
          p: num(a.p, `${label} (preço do adicional ${j + 1})`, { max: 9999 }),
        };
      }),
    };
  });
}

export function validateSite(input) {
  if (!isObj(input)) fail("Dados inválidos.");
  if (JSON.stringify(input).length > MAX_JSON_CHARS) fail("O cardápio ficou grande demais para salvar.");
  const content = validateContent(input.content);
  const categories = validateCategories(input.categories);
  const products = validateProducts(input.products, new Set(categories.map((c) => c.id)));
  return { content, categories, products };
}

// ---- Upload de imagem ----
const IMG_TYPES = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/webp": { ext: "webp", magic: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" },
};
export const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;

export function parseImageDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(typeof dataUrl === "string" ? dataUrl : "");
  if (!m) fail("Envie uma imagem JPG, PNG ou WebP.");
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length > MAX_IMAGE_BYTES) fail("A imagem é grande demais (máximo 2,5 MB).");
  const spec = IMG_TYPES[m[1]];
  if (buffer.length < 16 || !spec.magic(buffer)) fail("O arquivo não parece ser uma imagem válida.");
  return { buffer, contentType: m[1], ext: spec.ext };
}
