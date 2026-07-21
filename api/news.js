// Función serverless de Vercel — lee RSS de deportes de combate y los sirve limpios.
// Se ejecuta en el servidor de Vercel, por eso no hay problemas de CORS.

const FEEDS = [
  { name: 'NotiFight', url: 'https://notifight.com/feed/', category: 'Boxeo' },
];

// Cache en memoria (dura mientras la función esté "caliente")
let cache = { data: null, ts: 0 };
const CACHE_MS = 15 * 60 * 1000; // 15 minutos

function decode(str = '') {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

function extractImage(block) {
  // Buscar imagen en varios formatos comunes de RSS
  let m = block.match(/<media:content[^>]*url="([^"]+)"/i);
  if (m) return m[1];
  m = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i);
  if (m) return m[1];
  m = block.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
  if (m) return m[1];
  const content = extractTag(block, 'content:encoded') || extractTag(block, 'description');
  m = content.match(/<img[^>]*src="([^"]+)"/i);
  if (m) return m[1];
  return null;
}

async function parseFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RankdBot/1.0)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split(/<item[>\s]/).slice(1);
    return items.slice(0, 10).map((block) => {
      const title = decode(extractTag(block, 'title'));
      const link = decode(extractTag(block, 'link')).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const pubDate = extractTag(block, 'pubDate').trim();
      let desc = decode(extractTag(block, 'description'));
      if (desc.length > 180) desc = desc.slice(0, 177) + '...';
      return {
        title,
        link,
        description: desc,
        image: extractImage(block),
        pubDate,
        source: feed.name,
        category: feed.category,
      };
    }).filter((it) => it.title && it.link);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');

  // Servir cache si es reciente
  if (cache.data && Date.now() - cache.ts < CACHE_MS) {
    return res.status(200).json({ items: cache.data, cached: true });
  }

  const results = await Promise.all(FEEDS.map(parseFeed));
  let items = results.flat();

  // Ordenar por fecha (más reciente primero)
  items.sort((a, b) => {
    const da = new Date(a.pubDate).getTime() || 0;
    const db = new Date(b.pubDate).getTime() || 0;
    return db - da;
  });

  items = items.slice(0, 12);

  cache = { data: items, ts: Date.now() };
  return res.status(200).json({ items, cached: false });
}