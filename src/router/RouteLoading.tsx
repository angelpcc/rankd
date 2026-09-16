import { SkeletonBox } from '../components/base/Skeleton';

/**
 * Lo que se ve mientras se descarga el trozo de una página.
 *
 * Es lo PRIMERO que ve el usuario al entrar, así que en vez de un spinner
 * suelto se pinta la silueta de una pantalla —cabecera, un bloque grande, dos
 * tarjetas—: la página no aparece de golpe sobre un vacío, y el salto al
 * cargarla es mucho menor porque la forma ya estaba ahí.
 *
 * Vive en su propio fichero y no dentro de `config.tsx` porque aquel es un
 * fichero de RUTAS: un componente ahí dentro rompe el refresco en caliente de
 * Vite, que al tocar las rutas recargaba la página entera.
 */
export default function RouteLoading() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] px-5 py-8" role="status" aria-busy="true">
      <div className="max-w-4xl mx-auto space-y-5">
        <SkeletonBox height={12} width={110} />
        <SkeletonBox height={34} width="62%" />
        <SkeletonBox height={180} radius={20} style={{ marginTop: 24 }} />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBox height={90} radius={16} />
          <SkeletonBox height={90} radius={16} />
        </div>
      </div>
    </div>
  );
}
