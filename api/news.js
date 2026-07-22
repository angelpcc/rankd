// Función serverless de Vercel — lee RSS de deportes de combate y los sirve limpios.
// Se ejecuta en el servidor de Vercel (no hay CORS). Múltiples fuentes con respaldo.

const FEEDS = [
  { name: 'MMA Fighting', url: 'https://www.mmafighting.com/rss/current', category: 'MMA' },
  { name: 'Bad Left Hook', url: 'https://www.badlefthook.com/rss/current', category: 'Boxeo' },
  { name: 'MMA Mania', url: 'https://www.mmamania.com/rss/current', category: 'MMA' },
  { name: 'Bloody Elbow', url: 'https://www.bloodyelbow.com/rss/current', category: 'MMA' },
  { name: 'Cageside Press', url: 'https://cagesidepress.com/feed/', category: 'MMA' },
  { name: 'Sherdog', url: 'https://www.sherdog.com/rss/news.xml', category: 'MMA' },
];

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
      if (desc.length > 180) desc = desc.slice(0, 177) + '...';
      return { title, link, description: desc, image: extractImage(block), pubDate, source: feed.name, category: feed.category };
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

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');

  if (cache.data && cache.data.length > 0 && Date.now() - cache.ts < CACHE_MS) {
    return res.status(200).json({ items: cache.data, cached: true });
  }

  const results = await Promise.all(FEEDS.map(parseFeed));
  let items = results.flat();

  // Intercalar fuentes para variedad (no todas de la misma web seguidas)
  items.sort((a, b) => {
    const da = new Date(a.pubDate).getTime() || 0;
    const db = new Date(b.pubDate).getTime() || 0;
    return db - da;
  });

  items = items.slice(0, 16);

  // Para las que no traen imagen en el RSS, la sacamos de la propia noticia
  const needImage = items.filter((it) => !it.image);
  if (needImage.length > 0) {
    const found = await Promise.all(needImage.map((it) => fetchOgImage(it.link)));
    needImage.forEach((it, i) => { if (found[i]) it.image = found[i]; });
  }

  // Solo mostramos noticias con foto si hay suficientes; si no, completamos
  const withImg = items.filter((it) => it.image);
  const withoutImg = items.filter((it) => !it.image);
  items = withImg.length >= 6 ? withImg : [...withImg, ...withoutImg];

  if (items.length > 0) cache = { data: items, ts: Date.now() };
  return res.status(200).json({ items, cached: false });
}