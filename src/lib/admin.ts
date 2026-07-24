// Fuente única de verdad de quién es administrador de RANKD.
// Antes esta lista vivía duplicada dentro de admin/page.tsx; centralizarla
// permite que la navegación muestre el acceso al panel al mismo correo que
// luego deja entrar. Si algún día hay equipo, se amplía aquí y en ningún
// otro sitio.
export const ADMIN_EMAILS = ['angelpc2005@gmail.com'];

/** ¿Este email tiene acceso al panel de administración? */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
