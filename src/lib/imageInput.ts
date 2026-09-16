// ════════════════════════════════════════════════════════════════
// RANKD · Preparar una foto antes de mandarla a la IA
//
// ── POR QUÉ HACE FALTA ──
//
// Una foto de un móvil de hoy son 4000×3000 y tres o cuatro megas. Mandarla tal
// cual tiene tres problemas, y los tres los paga el usuario:
//
//   1. El límite del servidor son 5 MB. Una foto vertical en buena luz lo pasa,
//      y lo único que ve el usuario es "la foto debe pesar menos de 5MB" —
//      sobre una foto que acaba de hacer con la cámara de la app.
//   2. Cuesta dinero. Una imagen se cobra por píxeles, y por encima de 1568 px
//      de lado largo la propia API la reduce antes de mirarla: los megas de más
//      no mejoran nada, solo se pagan.
//   3. Tarda. Subir cuatro megas por datos móviles en un gimnasio es la
//      diferencia entre que funcione y que se quede colgado.
//
// Así que se reduce aquí, en el navegador, antes de que salga nada por la red.
//
// ── CUÁNTO CUESTA UNA FOTO, Y POR QUÉ 1100 Y NO 1568 ──
//
// La API cobra las imágenes por PÍXELES: unos (ancho × alto) / 750 tokens.
// Medido, con una foto de móvil en 4:3:
//
//     1568 px de lado largo  →  2459 tokens
//     1100 px                →  1210 tokens
//      900 px                →   810 tokens
//
// Para ponerlo en contexto: UNA foto a 1568 cuesta más que una conversación
// entera de Consulta. Y la foto es lo que más se usa —cada comida—, así que es
// de lejos donde se va el saldo.
//
// 1568 es el tope por encima del cual la API reduce por su cuenta, pero no es
// una recomendación: es un techo. Para lo que se manda aquí —un plato, una hoja
// de plan, la pantalla de una cinta— 1100 px se lee igual de bien y cuesta la
// mitad. Quien necesite más resolución (fotografiar un documento con letra
// pequeña) la pide expresamente: ver `maxLado`.
//
// ── POR QUÉ JPEG ──
//
// Un PNG de una foto pesa varias veces más que el mismo JPEG sin verse mejor.
// Para un texto fotografiado —que es el caso: la hoja del plan, la pantalla de
// la cinta— calidad 0.82 se lee perfectamente.
// ════════════════════════════════════════════════════════════════

/** Lado largo por defecto. Ver arriba: la mitad de coste que 1568. */
const MAX_LADO = 1100;
/**
 * Para fotos de DOCUMENTOS con letra pequeña.
 *
 * Más caro, pero leer mal una tabla de cardio y meter la inclinación en la
 * columna de la velocidad sale peor que pagar unos tokens de más. Aun así se
 * queda por debajo del tope: los PDF, que es el caso bueno, no pasan por aquí.
 */
export const LADO_DOCUMENTO = 1400;
const CALIDAD = 0.82;

export interface ImagenLista {
  /** base64 SIN el prefijo `data:…;base64,`, que es lo que espera la API. */
  base64: string;
  /** Tipo real de lo que va dentro de `base64`. */
  mediaType: string;
  /** Para pintar la miniatura sin volver a leer el fichero. Vacío en un PDF. */
  previewUrl: string;
  /** Tamaño aproximado ya reducido, en bytes. Para avisar si algo va mal. */
  bytes: number;
  /** Un PDF no se encoge ni se previsualiza: viaja tal cual. */
  esPdf?: boolean;
  /** Nombre del archivo, para poder decir CUÁL has adjuntado. */
  nombre?: string;
}

export const TIPO_PDF = 'application/pdf';

// ── CUÁNTO CABE DE VERDAD EN UNA PETICIÓN ──
//
// La IA corre en una función sin servidor de Vercel, y Vercel corta el cuerpo
// de la petición ANTES de que la función llegue a existir. Medido contra el
// servidor real: 4 MB pasan, 4,5 MB devuelven `FUNCTION_PAYLOAD_TOO_LARGE` en
// texto plano, que el cliente no sabe leer y acababa en un aviso que ponía
// literalmente "error".
//
// Las fotos se encogen y nunca llegan ahí. Un PDF viaja entero, así que es el
// único que puede pasarse — y pasarse significaba adjuntar un fichero que la
// app te dejaba elegir y no podía mandar jamás.
//
// 3,2 MB de base64 deja 1,3 MB de margen para todo lo demás (la conversación,
// el plan, la agenda, la lista de ejercicios), que junto no llega a 100 KB.
// El margen es grande a propósito: quedarse corto aquí no cuesta nada y
// pasarse rompe el mensaje entero.
export const MAX_ADJUNTOS_B64 = 3_200_000;

/**
 * Tamaño máximo de UN fichero, en bytes.
 *
 * base64 engorda 4/3, así que el fichero puede ocupar tres cuartas partes del
 * presupuesto. Salen ~2,4 MB, que para una hoja de rutina o una tabla de
 * cardio sobra: los que se pasan son los que llevan fotos dentro.
 */
export const MAX_ADJUNTO_BYTES = Math.floor((MAX_ADJUNTOS_B64 * 3) / 4);

/** Para enseñarlo en un aviso: "2,4 MB". */
export const mbDe = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');

/** Lo mínimo que hace falta saber de un mensaje para pesarlo. */
interface MensajeConAdjunto {
  image?: { base64: string; mediaType: string };
}

/**
 * Quita los adjuntos VIEJOS hasta que la petición quepa.
 *
 * ── EL CASO QUE ROMPÍA ──
 *
 * Los adjuntos de turnos anteriores siguen viajando, y con razón: si en el
 * turno 1 mandas la hoja del plan y en el 3 dices "cámbiame el martes", sin
 * ella el modelo ya no sabe de qué martes le hablas.
 *
 * Pero eso hace que la petición CREZCA sola. Dos PDF que caben de uno en uno
 * no caben juntos, y el mensaje que reventaba era uno en el que no habías
 * adjuntado nada: escribías "y el jueves?" y fallaba, sin ninguna pista de
 * por qué.
 *
 * Se recorre de atrás hacia delante —lo reciente es de lo que se está
 * hablando— y se van dejando adjuntos mientras quepan. El texto NUNCA se
 * toca: perder la foto de hace cuatro turnos es asumible, perder lo que se
 * dijo no.
 */
export function limitarAdjuntos<T extends MensajeConAdjunto>(mensajes: T[]): T[] {
  let gastado = 0;
  const alReves = [...mensajes].reverse().map((m) => {
    const n = m.image?.base64?.length || 0;
    if (!n) return m;
    if (gastado + n > MAX_ADJUNTOS_B64) {
      // Se cae el adjunto, se queda el mensaje.
      const { image: _fuera, ...resto } = m;
      void _fuera;
      return resto as T;
    }
    gastado += n;
    return m;
  });
  return alReves.reverse();
}

/** Lee un archivo a base64 sin el prefijo. Salida directa, sin tocar nada. */
function leerBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Reduce la foto si hace falta y la devuelve lista para mandar.
 *
 * Si algo del camino del canvas falla —navegador raro, imagen que no decodifica,
 * memoria— NO se rinde: cae a mandar el fichero original. Peor que reducida,
 * pero muchísimo mejor que no poder mandar la foto.
 */
export async function prepararImagen(file: File, maxLado = MAX_LADO): Promise<ImagenLista | null> {
  const original = async (): Promise<ImagenLista | null> => {
    try {
      return {
        base64: await leerBase64(file),
        mediaType: file.type || 'image/jpeg',
        previewUrl: URL.createObjectURL(file),
        bytes: file.size,
        nombre: file.name,
      };
    } catch { return null; }
  };

  // ── Un PDF va TAL CUAL ──
  //
  // Nada de convertirlo a imagen ni de encogerlo: en un PDF el texto y la
  // estructura de la tabla llegan enteros, y eso es justo lo que se importa
  // aquí (tablas de cardio, hojas de rutina). Pasarlo por el canvas lo
  // convertiría en una foto de un papel, que es de donde venimos.
  if (file.type === TIPO_PDF) {
    try {
      return {
        base64: await leerBase64(file),
        mediaType: TIPO_PDF,
        previewUrl: '',
        bytes: file.size,
        esPdf: true,
        nombre: file.name,
      };
    } catch { return null; }
  }

  try {
    const bitmap = await createImageBitmap(file);
    const lado = Math.max(bitmap.width, bitmap.height);
    // Ya es pequeña: reencodificarla solo la degradaría sin ahorrar nada.
    if (lado <= maxLado && file.size < 1_500_000) { bitmap.close(); return original(); }

    const escala = Math.min(1, maxLado / lado);
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return original(); }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', CALIDAD));
    if (!blob) return original();

    return {
      base64: await leerBase64(blob),
      mediaType: 'image/jpeg',
      previewUrl: URL.createObjectURL(blob),
      bytes: blob.size,
    };
  } catch {
    return original();
  }
}

/** Tipos que aceptamos en los selectores de archivo. */
export const ACEPTA_DOCUMENTO = 'image/*,application/pdf';
