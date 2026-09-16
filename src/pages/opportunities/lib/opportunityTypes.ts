// Qué clase de oportunidad es cada tipo.
//
// Vivía dentro de `OpportunityCard.tsx`, pero no pinta nada y lo usan tres
// sitios (la tarjeta, la destacada y la página). Una función exportada desde un
// fichero de componentes rompe además el refresco en caliente de Vite.
//
// La distinción no es cosmética: decide QUIÉN puede postularse. Un peleador se
// apunta a un combate o a un sparring; a un patrocinio se apunta una marca. Por
// eso están las dos listas y no una sola con un booleano.

/** Solo deportivas: aquí se postula un peleador. */
const FIGHTER_ONLY_TYPES = ['combate', 'sparring', 'contrato', 'campamento', 'entrenamiento', 'scouting'];

/** De marca: aquí NO se postula un peleador. */
const SPONSORSHIP_TYPES = ['patrocinio'];

export const isSponsorshipType = (type: string): boolean => SPONSORSHIP_TYPES.includes(type);
export const isFighterType = (type: string): boolean => FIGHTER_ONLY_TYPES.includes(type);
