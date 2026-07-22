// Busca automáticamente el récord de un peleador en fuentes públicas.
// Devuelve coincidencias encontradas + enlaces de búsqueda para revisión manual.

export const config = { maxDuration: 15 };

function slug(str) {
  return encodeURIComponent((str || '').trim());
}

// Busca en Sherdog (fuente accesible, buena para MMA)
async function searchSherdog(name) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const url = `https://www.sherdog.com/stats/fightfinder?SearchTxt=${slug(name)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const html = await res.text();
    const results = [];
    // Filas de la tabla de resultados: /fighter/Nombre-12345
    const re = /<a href="(\/fighter\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let m;
    const seen = new Set();
    while ((m = re.exec(html)) !== null && results.length < 5) {
      const path = m[1];
      const fname = m[2].trim();
      if (seen.has(path) || !fname) continue;
      seen.add(path);
      results.push({ name: fname, url: `https://www.sherdog.com${path}`, source: 'Sherdog' });
    }
    return results;
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const name = (req.query?.name || '').toString().trim();
  const discipline = (req.query?.discipline || '').toString().trim();

  if (!name) {
    return res.status(400).json({ error: 'Falta el nombre del peleador' });
  }

  // Búsqueda automática donde es posible
  const matches = await searchSherdog(name);

  // Enlaces de búsqueda para las fuentes que no permiten consulta automática
  const searchLinks = [
    { source: 'BoxRec', url: `https://boxrec.com/en/search?pf_search%5Bfirst_name%5D=&pf_search%5Blast_name%5D=${slug(name)}`, note: 'Referencia mundial en boxeo' },
    { source: 'Tapology', url: `https://www.tapology.com/search?term=${slug(name)}&search=Submit&mainSearchFilter=fighters`, note: 'MMA, kickboxing y muay thai' },
    { source: 'Sherdog', url: `https://www.sherdog.com/stats/fightfinder?SearchTxt=${slug(name)}`, note: 'Base de datos de MMA' },
    { source: 'Google', url: `https://www.google.com/search?q=${slug(name + ' ' + (discipline || '') + ' record')}`, note: 'Búsqueda general' },
  ];

  return res.status(200).json({
    name,
    discipline,
    matches,
    matchCount: matches.length,
    searchLinks,
    // Si no hay coincidencias automáticas, requiere revisión manual
    needsManualReview: matches.length === 0,
  });
}