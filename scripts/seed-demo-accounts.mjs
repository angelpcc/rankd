/**
 * RANKD · Cuentas demo para revisión visual (una por tipo de cuenta real).
 *
 * POR QUÉ: al trabajar en rediseños/revisiones, Claude Code no tenía sesión
 * iniciada y no podía navegar las pantallas tras login para verificar sus
 * cambios con captura real. Estas cuentas fijas lo resuelven.
 *
 * USO (una sola vez, y cada vez que quieras rellenar datos que falten):
 *   1. Ten el .env con VITE_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *      (el service_role se salta RLS — nunca lo subas al repo).
 *   2. node scripts/seed-demo-accounts.mjs
 *
 * Es IDEMPOTENTE: si una cuenta ya existe, no la duplica; reintenta rellenar
 * los datos que falten. Los pasos sobre tablas de migraciones aún no aplicadas
 * se saltan con un aviso, no rompen el resto.
 *
 * Credenciales y flujo de acceso: ver ACCESO_DEMO.md.
 * ⚠️  Borrar estas cuentas (y ACCESO_DEMO.md) antes del lanzamiento público.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── .env mínimo (sin dependencia de dotenv) ──
function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* sin .env: se usan las variables del entorno */ }
}
loadEnv();

const URL_ = process.env.VITE_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('Falta VITE_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (mira .env / .env.example).');
  process.exit(1);
}
const db = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = 'Rankd-demo-2026';
const iso = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

// ── Tipos de cuenta REALES hoy (comprobado en src/pages/auth/page.tsx:
//    MAIN_TYPES / ORG_SUBTYPES, y src/lib/supabase.ts UserType) ──
//    fighter (competitor | hobby) · brand · promoter · gym · manager
//    coach: no se registra directo; se crea aquí con user_type='coach' (en
//    producción se llega aceptando una invitación de gimnasio).
const ACCOUNTS = [
  {
    email: 'demo.fighter@rankd.test', label: 'Fighter — competidor',
    user_type: 'fighter', athlete_mode: 'competitor',
    profile: {
      full_name: 'Marco "El Toro" Ruiz',
      bio: 'Peso ligero. 6 años compitiendo. Buscando combate y patrocinio para 2026.',
      location: 'Madrid, España', country: 'España',
      instagram: '@marco_eltoro', tiktok: '@eltoro', youtube: '', twitter: '',
    },
  },
  {
    email: 'demo.hobby@rankd.test', label: 'Fighter — aficionado (hobby)',
    user_type: 'fighter', athlete_mode: 'hobby',
    profile: {
      full_name: 'Lucía Ferrer',
      bio: 'Entreno boxeo 4 días por semana. Sin intención de competir, solo constancia.',
      location: 'Valencia, España', country: 'España',
    },
  },
  {
    email: 'demo.brand@rankd.test', label: 'Marca (brand)',
    user_type: 'brand',
    profile: { full_name: 'Nébula Combat', location: 'Barcelona, España', website: 'https://example.com' },
  },
  {
    email: 'demo.promotora@rankd.test', label: 'Promotora',
    user_type: 'promoter',
    profile: { full_name: 'Ring Norte Promotions', location: 'Bilbao, España' },
  },
  {
    email: 'demo.gym@rankd.test', label: 'Gimnasio',
    user_type: 'gym',
    profile: { full_name: 'Club Boxeo Atlas', location: 'Sevilla, España' },
  },
  {
    email: 'demo.manager@rankd.test', label: 'Manager',
    user_type: 'manager',
    profile: { full_name: 'Ana Cobo Management', location: 'Madrid, España' },
  },
  {
    email: 'demo.coach@rankd.test', label: 'Entrenador (coach)',
    user_type: 'coach',
    profile: { full_name: 'Sergio Vidal', bio: 'Entrenador principal en Club Boxeo Atlas.', location: 'Sevilla, España' },
  },
];

async function step(label, fn) {
  try { await fn(); console.log(`   ✓ ${label}`); }
  catch (e) { console.log(`   – ${label} — saltado (${e?.message || e})`); }
}

/** Crea el usuario de auth si no existe; devuelve su id. Idempotente. */
async function ensureUser(email, meta) {
  // listUsers pagina de 50; con pocas cuentas demo basta la primera página.
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (found) {
    await db.auth.admin.updateUserById(found.id, { password: PASSWORD, user_metadata: meta });
    return { id: found.id, created: false };
  }
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: meta,
  });
  if (error) throw error;
  return { id: data.user.id, created: true };
}

const ids = {};

async function run() {
  console.log('RANKD · seed de cuentas demo\n');

  for (const acc of ACCOUNTS) {
    const meta = { full_name: acc.profile.full_name, user_type: acc.user_type, athlete_mode: acc.athlete_mode ?? null };
    const { id, created } = await ensureUser(acc.email, meta);
    ids[acc.user_type + (acc.athlete_mode ? `:${acc.athlete_mode}` : '')] = id;
    console.log(`${created ? '＋ creada ' : '· existe  '} ${acc.label.padEnd(28)} ${acc.email}`);

    // El perfil lo crea un trigger a partir de user_metadata; aquí nos
    // aseguramos de que quede con los valores correctos.
    await step('profiles', async () => {
      const { error } = await db.from('profiles').update({
        user_type: acc.user_type,
        athlete_mode: acc.athlete_mode ?? null,
        full_name: acc.profile.full_name,
        bio: acc.profile.bio ?? null,
        location: acc.profile.location ?? null,
        country: acc.profile.country ?? null,
        website: acc.profile.website ?? null,
        instagram: acc.profile.instagram ?? null,
        tiktok: acc.profile.tiktok ?? null,
        youtube: acc.profile.youtube ?? null,
        twitter: acc.profile.twitter ?? null,
        accepted_terms_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    });
  }

  const fighterId = ids['fighter:competitor'];
  const hobbyId = ids['fighter:hobby'];
  const brandId = ids['brand'];
  const promoterId = ids['promoter'];
  const gymId = ids['gym'];
  const managerId = ids['manager'];
  const coachId = ids['coach'];

  // ── Fighter competidor: récord + peso + entrenos + plan ──
  console.log('\nDatos · Fighter competidor');
  await step('fighters (récord, disciplina, público)', async () => {
    const payload = {
      profile_id: fighterId, nickname: 'El Toro', discipline: 'boxing', weight_class: 'Ligero',
      age: 27, nationality: 'España', wins: 14, losses: 2, draws: 0, kos: 9,
      experience_level: 'professional', gym: 'Club Boxeo Atlas', coach: 'Sergio Vidal',
      looking_for: ['Combates', 'Patrocinio'], is_available: true, is_public: true,
      updated_at: new Date().toISOString(),
    };
    const { data: ex } = await db.from('fighters').select('id').eq('profile_id', fighterId).maybeSingle();
    const { error } = ex
      ? await db.from('fighters').update(payload).eq('id', ex.id)
      : await db.from('fighters').insert(payload);
    if (error) throw error;
  });
  await step('weight_entries (últimas 6 semanas)', async () => {
    const rows = [0, 7, 14, 21, 28, 35, 42].map((d, i) => ({
      fighter_profile_id: fighterId, entry_date: iso(d), weight_kg: 66.2 + i * 0.35,
    }));
    const { error } = await db.from('weight_entries').upsert(rows, { onConflict: 'fighter_profile_id,entry_date' });
    if (error) throw error;
  });
  await step('nutrition_goals (objetivo de peso + pesaje)', async () => {
    const { error } = await db.from('nutrition_goals').upsert({
      fighter_profile_id: fighterId, target_weight_kg: 63.5, daily_water_goal_ml: 3000,
      weight_class_label: 'Ligero (-63,5 kg)', weigh_in_date: iso(-21), updated_at: new Date().toISOString(),
    }, { onConflict: 'fighter_profile_id' });
    if (error) throw error;
  });
  await step('activity_sessions (correr + saco)', async () => {
    const rows = [
      { fighter_profile_id: fighterId, session_date: iso(1), kind: 'correr', duration_min: 40, note: 'Rodaje suave' },
      { fighter_profile_id: fighterId, session_date: iso(3), kind: 'boxeo', duration_min: 45, rounds: 8, note: 'Saco + sombra' },
      { fighter_profile_id: fighterId, session_date: iso(6), kind: 'correr', duration_min: 30, note: 'Series' },
    ];
    const { error } = await db.from('activity_sessions').insert(rows);
    if (error) throw error;
  });
  await step('strength_sets (2 sesiones)', async () => {
    const mk = (d, ex, label, group, sets) => sets.map((s, i) => ({
      fighter_profile_id: fighterId, exercise: ex, exercise_label: label, session_date: iso(d),
      set_number: i + 1, reps: s.reps, weight_kg: s.kg, muscle_group: group,
    }));
    const rows = [
      ...mk(2, 'sentadilla', 'Sentadilla', 'legs', [{ reps: 5, kg: 90 }, { reps: 5, kg: 100 }, { reps: 5, kg: 105 }]),
      ...mk(2, 'press banca', 'Press banca', 'chest', [{ reps: 5, kg: 70 }, { reps: 5, kg: 75 }, { reps: 5, kg: 77.5 }]),
      ...mk(5, 'peso muerto', 'Peso muerto', 'back', [{ reps: 3, kg: 120 }, { reps: 3, kg: 130 }, { reps: 3, kg: 135 }]),
    ];
    const { error } = await db.from('strength_sets').insert(rows);
    if (error) throw error;
  });
  await step('day_plan_items (plan de hoy y mañana)', async () => {
    const rows = [
      { fighter_profile_id: fighterId, plan_date: iso(0), kind: 'strength', source: 'manual', payload: { groups: ['legs', 'core'], exercises: 'Sentadilla 4x5 · Plancha 3x45s' } },
      { fighter_profile_id: fighterId, plan_date: iso(-1), kind: 'activity', source: 'manual', payload: { kind: 'correr', duration_min: 35 } },
    ];
    const { error } = await db.from('day_plan_items').insert(rows);
    if (error) throw error;
  });

  // ── Fighter hobby: algo de constancia, nada de competición ──
  console.log('\nDatos · Fighter hobby');
  await step('fighters (privado, sin récord)', async () => {
    const payload = {
      profile_id: hobbyId, nickname: '', discipline: 'boxing', weight_class: null,
      age: 31, nationality: 'España', wins: 0, losses: 0, draws: 0, kos: 0,
      experience_level: 'amateur', gym: 'BoxVLC', coach: '', looking_for: [],
      is_available: false, is_public: false, updated_at: new Date().toISOString(),
    };
    const { data: ex } = await db.from('fighters').select('id').eq('profile_id', hobbyId).maybeSingle();
    const { error } = ex
      ? await db.from('fighters').update(payload).eq('id', ex.id)
      : await db.from('fighters').insert(payload);
    if (error) throw error;
  });
  await step('activity_sessions (rutina semanal)', async () => {
    const rows = [
      { fighter_profile_id: hobbyId, session_date: iso(1), kind: 'boxeo', duration_min: 60, rounds: 6 },
      { fighter_profile_id: hobbyId, session_date: iso(2), kind: 'correr', duration_min: 25 },
      { fighter_profile_id: hobbyId, session_date: iso(4), kind: 'cuerda', duration_min: 15 },
    ];
    const { error } = await db.from('activity_sessions').insert(rows);
    if (error) throw error;
  });
  await step('weight_entries', async () => {
    const rows = [0, 10, 20].map((d, i) => ({ fighter_profile_id: hobbyId, entry_date: iso(d), weight_kg: 62 - i * 0.4 }));
    const { error } = await db.from('weight_entries').upsert(rows, { onConflict: 'fighter_profile_id,entry_date' });
    if (error) throw error;
  });

  // ── Organizaciones (brand / promoter / gym / manager) ──
  console.log('\nDatos · Organizaciones');
  const org = async (profileId, name, type, description) => step(`organizations (${type})`, async () => {
    const payload = { profile_id: profileId, org_name: name, org_type: type, description, is_public: type !== 'manager', updated_at: new Date().toISOString() };
    const { data: ex } = await db.from('organizations').select('id').eq('profile_id', profileId).maybeSingle();
    const { error } = ex
      ? await db.from('organizations').update(payload).eq('id', ex.id)
      : await db.from('organizations').insert(payload);
    if (error) throw error;
  });
  await org(brandId, 'Nébula Combat', 'brand', 'Guantes y protecciones de gama media para boxeo y kickboxing. Fabricación europea.');
  await org(promoterId, 'Ring Norte Promotions', 'promoter', 'Veladas de boxeo profesional y amateur en el norte de España. 4-6 eventos al año.');
  await org(gymId, 'Club Boxeo Atlas', 'gym', 'Club de boxeo en Sevilla. Competición y salud. 120 socios, 3 entrenadores.');
  await org(managerId, 'Ana Cobo Management', 'manager', 'Representación de peleadores de boxeo y MMA. Negociación de contratos y agenda.');

  await step('brands (ficha pública de la marca)', async () => {
    const payload = {
      user_id: brandId, name: 'Nébula Combat', email: 'hola@nebulacombat.test',
      website: 'https://example.com', category: 'Equipamiento', type: 'product',
      description: 'Guantes, vendas y espinilleras de gama media. Envío a toda la UE.',
      status: 'approved', is_public: true, updated_at: new Date().toISOString(),
    };
    const { data: ex } = await db.from('brands').select('id').eq('user_id', brandId).maybeSingle();
    const { error } = ex
      ? await db.from('brands').update(payload).eq('id', ex.id)
      : await db.from('brands').insert(payload);
    if (error) throw error;
  });
  await step('brand_products (2)', async () => {
    const { data: b } = await db.from('brands').select('id').eq('user_id', brandId).maybeSingle();
    if (!b) throw new Error('sin fila en brands');
    const rows = [
      { user_id: brandId, brand_profile_id: b.id, name: 'Guante Nébula Pro 12oz', category: 'Guantes', price: '69,90 €', external_link: 'https://example.com/pro12' },
      { user_id: brandId, brand_profile_id: b.id, name: 'Vendas elásticas 4,5 m (par)', category: 'Vendas', price: '9,90 €', external_link: 'https://example.com/vendas' },
    ];
    const { error } = await db.from('brand_products').insert(rows);
    if (error) throw error;
  });

  // ── Gimnasio: roster con los peleadores demo ──
  console.log('\nDatos · Gimnasio y entrenador');
  await step('gym_roster (2 peleadores)', async () => {
    const rows = [
      { org_profile_id: gymId, fighter_profile_id: fighterId, display_name: 'Marco Ruiz', status: 'active', shares_activity: true },
      { org_profile_id: gymId, fighter_profile_id: hobbyId, display_name: 'Lucía Ferrer', status: 'active', shares_activity: false },
    ];
    const { error } = await db.from('gym_roster').upsert(rows, { onConflict: 'org_profile_id,fighter_profile_id' });
    if (error) throw error;
  });
  await step('gym_staff (entrenador ↔ gimnasio)', async () => {
    const { error } = await db.from('gym_staff').upsert(
      { org_profile_id: gymId, coach_profile_id: coachId, role: 'head_coach', status: 'active' },
      { onConflict: 'org_profile_id,coach_profile_id' },
    );
    if (error) throw error;
  });
  await step('club_sessions (plan de la semana)', async () => {
    const rows = [
      { org_profile_id: gymId, coach_profile_id: coachId, session_date: iso(-1), part_of_day: 'evening', session_type: 'tecnica', title: 'Técnica de directo y jab', group_label: 'Competición' },
      { org_profile_id: gymId, coach_profile_id: coachId, session_date: iso(-2), part_of_day: 'morning', session_type: 'fisico', title: 'Fuerza tren inferior', group_label: 'Todos' },
    ];
    const { error } = await db.from('club_sessions').insert(rows);
    if (error) throw error;
  });

  console.log('\nListo. Contraseña de todas las cuentas:', PASSWORD);
  console.log('Entra por  /vista-previa-rk28  y luego haz login. Detalle en ACCESO_DEMO.md.');
}

run().catch((e) => { console.error('\nError no recuperable:', e); process.exit(1); });
