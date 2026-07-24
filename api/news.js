// Función serverless de Vercel — lee RSS de deportes de combate y los sirve limpios.
// Se ejecuta en el servidor de Vercel (no hay CORS). Múltiples fuentes con respaldo.

const FEEDS = [
  // ── Español ──
  { name: 'Marca', url: 'https://e00-marca.uecdn.es/rss/mas-deportes/boxeo.xml', category: 'Boxeo', lang: 'es' },
  { name: 'AS', url: 'https://as.com/rss/masdeporte/boxeo.xml', category: 'Boxeo', lang: 'es' },
  { name: 'Sportskeeda MMA', url: 'https://www.sportskeeda.com/feed/mma', category: 'MMA', lang: 'en' },
  // ── MMA ──
  { name: 'Cageside Press', url: 'https://cagesidepress.com/feed/', category: 'MMA', lang: 'en' },
  { name: 'MyMMANews', url: 'https://www.mymmanews.com/feed/', category: 'MMA', lang: 'en' },
  { name: 'BJPenn', url: 'https://www.bjpenn.com/feed/', category: 'MMA', lang: 'en' },
  { name: 'MMA Fighting', url: 'https://www.mmafighting.com/rss/current', category: 'MMA', lang: 'en' },
  { name: 'Sherdog', url: 'https://www.sherdog.com/rss/news.xml', category: 'MMA', lang: 'en' },
  // ── Boxeo ──
  { name: 'Boxing News', url: 'https://www.boxingnewsonline.net/feed/', category: 'Boxeo', lang: 'en' },
  { name: 'Boxing Insider', url: 'https://www.boxinginsider.com/feed/', category: 'Boxeo', lang: 'en' },
  { name: 'World Boxing News', url: 'https://www.worldboxingnews.net/feed/', category: 'Boxeo', lang: 'en' },
  { name: 'Bad Left Hook', url: 'https://www.badlefthook.com/rss/current', category: 'Boxeo', lang: 'en' },
];

// Cuántas noticias servimos y cuántas puede aportar como máximo una misma fuente.
// El tope por fuente evita que un medio que publica 30 veces al día copie la portada.
const MAX_ITEMS = 24;
const MAX_PER_SOURCE = 4;
const MIN_WITH_IMAGE = 9;

let cache = { data: null, ts: 0 };
const CACHE_MS = 15 * 60 * 1000;

function decode(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...').replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

function extractLink(block) {
  // RSS estándar: <link>url</link>
  let m = block.match(/<link>([\s\S]*?)<\/link>/i);
  if (m && m[1].trim().startsWith('http')) return decode(m[1]);
  // Atom: <link href="url"/>
  m = block.match(/<link[^>]*href="([^"]+)"/i);
  if (m) return m[1];
  // Guid como fallback
  m = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  if (m && m[1].trim().startsWith('http')) return decode(m[1]);
  return '';
}

function extractImage(block) {
  let m = block.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
  if (m) return m[1];
  m = block.match(/<media:content[^>]*url="([^"]+)"/i);
  if (m && /\.(jpg|jpeg|png|webp|gif)/i.test(m[1])) return m[1];
  m = block.match(/<media:content[^>]*url="([^"]+)"[^>]*medium="image"/i);
  if (m) return m[1];
  m = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i);
  if (m) return m[1];
  // Buscar en el contenido HTML
  const content = extractTag(block, 'content:encoded') || extractTag(block, 'description') || '';
  m = content.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (m) return m[1];
  // Buscar cualquier URL de imagen en el bloque
  m = block.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/i);
  if (m) return m[0];
  return null;
}

async function parseFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    // Soporta <item> (RSS) y <entry> (Atom)
    const isAtom = xml.includes('<entry');
    const chunks = isAtom ? xml.split(/<entry[>\s]/).slice(1) : xml.split(/<item[>\s]/).slice(1);
    return chunks.slice(0, 8).map((block) => {
      const title = decode(extractTag(block, 'title'));
      const link = extractLink(block);
      const pubDate = (extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated')).trim();
      let desc = decode(extractTag(block, 'description') || extractTag(block, 'summary'));
      if (desc.length > 200) desc = desc.slice(0, 197) + '...';
      return {
        title, link, description: desc, image: extractImage(block), pubDate,
        source: feed.name, category: feed.category, lang: feed.lang || 'en',
      };
    }).filter((it) => it.title && it.link && it.link.startsWith('http'));
  } catch {
    return [];
  }
}


// Extrae la imagen de portada (og:image) de la página de la noticia.
// Es la imagen que sale al compartir el enlace en redes: siempre relevante.
async function fetchOgImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    // Solo leemos el principio del HTML: las metas están en el <head>
    const html = (await res.text()).slice(0, 60000);
    let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (m) return m[1];
    m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (m) return m[1];
    m = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

// Quita duplicados: el mismo titular publicado por dos medios, o el mismo enlace.
function dedupe(items) {
  const seenLinks = new Set();
  const seenTitles = new Set();
  return items.filter((it) => {
    const key = it.link.split('?')[0];
    const titleKey = it.title.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, '').slice(0, 60);
    if (seenLinks.has(key) || seenTitles.has(titleKey)) return false;
    seenLinks.add(key);
    seenTitles.add(titleKey);
    return true;
  });
}

// Reparte las noticias por fuente en vez de dejar bloques del mismo medio seguidos.
// Va cogiendo una de cada fuente por vuelta, respetando el orden cronológico dentro de cada una.
function interleave(items) {
  const bySource = new Map();
  items.forEach((it) => {
    const list = bySource.get(it.source) || [];
    if (list.length < MAX_PER_SOURCE) { list.push(it); bySource.set(it.source, list); }
  });
  const queues = [...bySource.values()];
  const out = [];
  let round = 0;
  while (out.length < MAX_ITEMS) {
    let added = false;
    for (const q of queues) {
      if (q[round]) { out.push(q[round]); added = true; }
      if (out.length >= MAX_ITEMS) break;
    }
    if (!added) break;
    round++;
  }
  return out;
}

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');

  if (cache.data && cache.data.length > 0 && Date.now() - cache.ts < CACHE_MS) {
    return res.status(200).json({ items: cache.data, updatedAt: new Date(cache.ts).toISOString(), cached: true });
  }

  const results = await Promise.all(FEEDS.map(parseFeed));
  let items = dedupe(results.flat());

  // Más recientes primero
  items.sort((a, b) => {
    const da = new Date(a.pubDate).getTime() || 0;
    const db = new Date(b.pubDate).getTime() || 0;
    return db - da;
  });

  items = interleave(items);

  // Para las que no traen imagen en el RSS, la sacamos de la propia noticia
  const needImage = items.filter((it) => !it.image);
  if (needImage.length > 0) {
    const found = await Promise.all(needImage.map((it) => fetchOgImage(it.link)));
    needImage.forEach((it, i) => { if (found[i]) it.image = found[i]; });
  }

  // Preferimos noticias con foto real. Pero si quedan muy pocas, mejor mostrar
  // el resto sin imagen (la portada tiene marcador de agua propio) que una página vacía.
  const withImage = items.filter((it) => it.image);
  items = withImage.length >= MIN_WITH_IMAGE
    ? withImage
    : [...withImage, ...items.filter((it) => !it.image)];

  const ts = Date.now();
  if (items.length > 0) cache = { data: items, ts };
  return res.status(200).json({ items, updatedAt: new Date(ts).toISOString(), cached: false });
}
