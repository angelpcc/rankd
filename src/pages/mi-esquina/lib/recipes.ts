// ════════════════════════════════════════════════════════════════
// RANKD · Biblioteca de comidas del Asesor de comida
//
// Catálogo FIJO en el cliente, no en la base: así el asesor funciona sin
// depender de ninguna migración y sin una consulta más al abrir la pantalla.
// (`common_foods`, la migración 0039, es otra cosa: alimentos sueltos para
// registrar el diario. Esto son platos montados con su preparación.)
//
// Cada plato lleva lo que el asesor necesita para decidir:
//   · `slot`        en qué momento del día encaja
//   · `minutes`     cuánto se tarda en tenerlo listo
//   · `complexity`  'facil' = sartén y poco más; 'medio' = varios pasos
//   · `pantry`      ingredientes en forma de etiqueta, para cruzarlos con lo
//                   que el usuario dice que tiene en casa
//   · macros POR RACIÓN, que el generador escala para cuadrar las calorías
//
// Los valores nutricionales son de referencia y aproximados, en la misma línea
// que el resto de Nutrición ("todo es orientativo").
// ════════════════════════════════════════════════════════════════

export type MealSlot = 'desayuno' | 'comida' | 'cena' | 'snack';
export type Complexity = 'facil' | 'medio';

/** Etiquetas de despensa. El usuario marca las que tiene. */
export type Pantry =
  | 'huevo' | 'pollo' | 'ternera' | 'cerdo' | 'pescado' | 'atun' | 'marisco'
  | 'lacteo' | 'queso' | 'yogur' | 'legumbre' | 'tofu'
  | 'arroz' | 'pasta' | 'pan' | 'patata' | 'avena' | 'quinoa'
  | 'verdura' | 'ensalada' | 'tomate' | 'fruta' | 'platano' | 'aguacate'
  | 'frutos_secos' | 'aceite' | 'conserva';

export interface Recipe {
  id: string;
  /** Nombre en español; `nameEn` para la interfaz en inglés. */
  name: string;
  nameEn: string;
  slot: MealSlot;
  minutes: number;
  complexity: Complexity;
  pantry: Pantry[];
  /** Por ración. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Cómo se hace, en dos o tres frases. Sin foto: se lee y se cocina. */
  how: string;
  howEn: string;
  /** Sin carne ni pescado. Filtra el modo vegetariano. */
  veg?: boolean;
}

// ── DESAYUNOS ──────────────────────────────────────────────────
const BREAKFAST: Recipe[] = [
  {
    id: 'des_avena_platano', name: 'Avena con plátano y crema de cacahuete',
    nameEn: 'Oats with banana and peanut butter',
    slot: 'desayuno', minutes: 7, complexity: 'facil', veg: true,
    pantry: ['avena', 'platano', 'lacteo', 'frutos_secos'],
    kcal: 480, protein: 18, carbs: 62, fat: 17,
    how: 'Calienta 60 g de avena con 250 ml de leche o bebida vegetal 3 minutos, removiendo. Fuera del fuego añade el plátano en rodajas y una cucharada de crema de cacahuete.',
    howEn: 'Heat 60 g oats with 250 ml milk for 3 minutes, stirring. Off the heat add sliced banana and a spoon of peanut butter.',
  },
  {
    id: 'des_tortilla_avena', name: 'Tortitas de avena y huevo',
    nameEn: 'Oat and egg pancakes',
    slot: 'desayuno', minutes: 12, complexity: 'facil', veg: true,
    pantry: ['avena', 'huevo', 'platano'],
    kcal: 430, protein: 26, carbs: 48, fat: 14,
    how: 'Tritura 50 g de avena con 2 huevos y medio plátano hasta que quede una masa lisa. Cuaja tres tortitas en sartén antiadherente a fuego medio, un minuto por cada lado.',
    howEn: 'Blend 50 g oats with 2 eggs and half a banana until smooth. Cook three pancakes in a non-stick pan over medium heat, a minute per side.',
  },
  {
    id: 'des_huevos_revueltos', name: 'Huevos revueltos con pan y tomate',
    nameEn: 'Scrambled eggs with bread and tomato',
    slot: 'desayuno', minutes: 8, complexity: 'facil', veg: true,
    pantry: ['huevo', 'pan', 'tomate', 'aceite'],
    kcal: 420, protein: 24, carbs: 34, fat: 20,
    how: 'Bate 3 huevos y cuájalos a fuego bajo sin parar de remover, que queden cremosos. Sirve sobre dos rebanadas de pan tostado con tomate rallado y un hilo de aceite.',
    howEn: 'Beat 3 eggs and scramble over low heat, stirring constantly so they stay creamy. Serve on two slices of toast with grated tomato and a drizzle of olive oil.',
  },
  {
    id: 'des_yogur_bowl', name: 'Bol de yogur, fruta y nueces',
    nameEn: 'Yoghurt bowl with fruit and nuts',
    slot: 'desayuno', minutes: 4, complexity: 'facil', veg: true,
    pantry: ['yogur', 'fruta', 'frutos_secos', 'avena'],
    kcal: 390, protein: 24, carbs: 42, fat: 14,
    how: 'Pon 250 g de yogur griego en un bol. Añade fruta troceada, un puñado de nueces y dos cucharadas de avena por encima. Sin cocinar nada.',
    howEn: 'Put 250 g Greek yoghurt in a bowl. Top with chopped fruit, a handful of walnuts and two spoons of oats. No cooking at all.',
  },
  {
    id: 'des_tostada_aguacate', name: 'Tostada de aguacate y huevo',
    nameEn: 'Avocado and egg toast',
    slot: 'desayuno', minutes: 9, complexity: 'facil', veg: true,
    pantry: ['pan', 'aguacate', 'huevo', 'aceite'],
    kcal: 450, protein: 20, carbs: 36, fat: 25,
    how: 'Tuesta dos rebanadas y aplasta encima medio aguacate con sal y pimienta. Corona con un huevo a la plancha o escalfado.',
    howEn: 'Toast two slices and mash half an avocado on top with salt and pepper. Finish with a fried or poached egg.',
  },
  {
    id: 'des_batido_recu', name: 'Batido de recuperación',
    nameEn: 'Recovery shake',
    slot: 'desayuno', minutes: 3, complexity: 'facil', veg: true,
    pantry: ['lacteo', 'platano', 'avena', 'frutos_secos'],
    kcal: 460, protein: 28, carbs: 58, fat: 13,
    how: 'Bate 300 ml de leche con un plátano, 40 g de avena y una cucharada de crema de frutos secos. Para las mañanas en las que no hay tiempo de sentarse.',
    howEn: 'Blend 300 ml milk with a banana, 40 g oats and a spoon of nut butter. For mornings with no time to sit down.',
  },
  {
    id: 'des_requeson_tostadas', name: 'Requesón con tostadas y miel',
    nameEn: 'Cottage cheese on toast with honey',
    slot: 'desayuno', minutes: 5, complexity: 'facil', veg: true,
    pantry: ['queso', 'pan', 'fruta'],
    kcal: 400, protein: 27, carbs: 45, fat: 11,
    how: 'Reparte 200 g de requesón sobre dos tostadas, añade fruta troceada y un hilo de miel. Cinco minutos de reloj.',
    howEn: 'Spread 200 g cottage cheese over two slices of toast, add chopped fruit and a drizzle of honey. Five minutes flat.',
  },
  {
    id: 'des_tortilla_patata', name: 'Tortilla de patata rápida',
    nameEn: 'Quick potato omelette',
    slot: 'desayuno', minutes: 20, complexity: 'medio', veg: true,
    pantry: ['huevo', 'patata', 'aceite'],
    kcal: 520, protein: 22, carbs: 44, fat: 28,
    how: 'Corta la patata en láminas finas y hazla tapada a fuego medio con un poco de aceite hasta que esté blanda, unos 12 minutos. Mézclala con 3 huevos batidos y cuaja la tortilla 2 minutos por cada lado.',
    howEn: 'Slice the potato thin and cook it covered over medium heat with a little oil until soft, about 12 minutes. Mix with 3 beaten eggs and set the omelette 2 minutes per side.',
  },
];

// ── COMIDAS ────────────────────────────────────────────────────
const LUNCH: Recipe[] = [
  {
    id: 'com_pollo_arroz', name: 'Pollo a la plancha con arroz y verduras',
    nameEn: 'Grilled chicken with rice and vegetables',
    slot: 'comida', minutes: 25, complexity: 'facil',
    pantry: ['pollo', 'arroz', 'verdura', 'aceite'],
    kcal: 620, protein: 48, carbs: 68, fat: 15,
    how: 'Pon el arroz a cocer (unos 15 minutos). Mientras, haz la pechuga a la plancha con sal y pimienta, 4 minutos por lado, y saltea la verdura. Junta todo en el plato.',
    howEn: 'Start the rice (about 15 minutes). Meanwhile grill the chicken breast with salt and pepper, 4 minutes a side, and sauté the vegetables. Bring it all together on the plate.',
  },
  {
    id: 'com_lentejas', name: 'Lentejas con verduras',
    nameEn: 'Lentil stew with vegetables',
    slot: 'comida', minutes: 30, complexity: 'medio', veg: true,
    pantry: ['legumbre', 'verdura', 'tomate', 'aceite'],
    kcal: 560, protein: 28, carbs: 72, fat: 14,
    how: 'Sofríe cebolla, zanahoria y pimiento 8 minutos. Añade tomate triturado, las lentejas cocidas y agua hasta cubrir. Deja que hierva 15 minutos a fuego suave.',
    howEn: 'Fry onion, carrot and pepper for 8 minutes. Add crushed tomato, the cooked lentils and water to cover. Simmer gently for 15 minutes.',
  },
  {
    id: 'com_pasta_atun', name: 'Pasta con atún y tomate',
    nameEn: 'Tuna and tomato pasta',
    slot: 'comida', minutes: 18, complexity: 'facil',
    pantry: ['pasta', 'atun', 'tomate', 'aceite'],
    kcal: 640, protein: 38, carbs: 82, fat: 16,
    how: 'Cuece 100 g de pasta. En otra sartén calienta tomate triturado con un diente de ajo 5 minutos y añade dos latas de atún escurrido. Mezcla con la pasta.',
    howEn: 'Boil 100 g pasta. In another pan heat crushed tomato with a garlic clove for 5 minutes and stir in two drained tins of tuna. Toss with the pasta.',
  },
  {
    id: 'com_salmon_patata', name: 'Salmón al horno con patata',
    nameEn: 'Baked salmon with potato',
    slot: 'comida', minutes: 35, complexity: 'medio',
    pantry: ['pescado', 'patata', 'verdura', 'aceite'],
    kcal: 660, protein: 42, carbs: 48, fat: 30,
    how: 'Horno a 200 °C. Corta la patata en gajos, aliña y hornea 25 minutos. Añade el lomo de salmón los últimos 12 minutos con limón y pimienta.',
    howEn: 'Oven at 200 °C. Cut the potato into wedges, season and bake for 25 minutes. Add the salmon fillet for the last 12 minutes with lemon and pepper.',
  },
  {
    id: 'com_ensalada_pollo', name: 'Ensalada completa de pollo',
    nameEn: 'Loaded chicken salad',
    slot: 'comida', minutes: 15, complexity: 'facil',
    pantry: ['pollo', 'ensalada', 'tomate', 'aguacate', 'aceite'],
    kcal: 520, protein: 44, carbs: 24, fat: 28,
    how: 'Haz la pechuga a la plancha y córtala en tiras. Móntala sobre hojas verdes con tomate, aguacate y un buen chorro de aceite de oliva.',
    howEn: 'Grill the chicken breast and slice it. Serve over greens with tomato, avocado and a generous drizzle of olive oil.',
  },
  {
    id: 'com_arroz_ternera', name: 'Salteado de ternera con arroz',
    nameEn: 'Beef stir-fry with rice',
    slot: 'comida', minutes: 22, complexity: 'facil',
    pantry: ['ternera', 'arroz', 'verdura', 'aceite'],
    kcal: 700, protein: 46, carbs: 74, fat: 22,
    how: 'Cuece el arroz. Saltea la ternera en tiras a fuego fuerte 3 minutos, sácala, y en la misma sartén haz la verdura 5 minutos. Junta todo con un poco de salsa de soja.',
    howEn: 'Cook the rice. Stir-fry the sliced beef over high heat for 3 minutes, take it out, and cook the vegetables in the same pan for 5 minutes. Combine with a splash of soy sauce.',
  },
  {
    id: 'com_garbanzos', name: 'Garbanzos con espinacas',
    nameEn: 'Chickpeas with spinach',
    slot: 'comida', minutes: 20, complexity: 'facil', veg: true,
    pantry: ['legumbre', 'verdura', 'aceite', 'conserva'],
    kcal: 540, protein: 24, carbs: 66, fat: 18,
    how: 'Dora un diente de ajo, añade las espinacas hasta que bajen y luego los garbanzos cocidos y escurridos. Sofríe 5 minutos con pimentón.',
    howEn: 'Brown a garlic clove, add the spinach until it wilts, then the drained cooked chickpeas. Fry for 5 minutes with paprika.',
  },
  {
    id: 'com_pollo_quinoa', name: 'Bol de quinoa, pollo y verdura asada',
    nameEn: 'Quinoa, chicken and roasted veg bowl',
    slot: 'comida', minutes: 32, complexity: 'medio',
    pantry: ['quinoa', 'pollo', 'verdura', 'aceite'],
    kcal: 610, protein: 45, carbs: 60, fat: 18,
    how: 'Asa la verdura troceada 25 minutos a 200 °C. Cuece la quinoa 15 minutos. Haz el pollo a la plancha y monta el bol con las tres cosas.',
    howEn: 'Roast the chopped vegetables for 25 minutes at 200 °C. Cook the quinoa for 15 minutes. Grill the chicken and build the bowl with all three.',
  },
  {
    id: 'com_lomo_patata', name: 'Lomo de cerdo con patata y pimientos',
    nameEn: 'Pork loin with potato and peppers',
    slot: 'comida', minutes: 28, complexity: 'facil',
    pantry: ['cerdo', 'patata', 'verdura', 'aceite'],
    kcal: 680, protein: 46, carbs: 56, fat: 26,
    how: 'Cuece o asa la patata. Haz los filetes de lomo a la plancha 3 minutos por lado y, aparte, los pimientos a fuego lento hasta que estén blandos.',
    howEn: 'Boil or roast the potato. Grill the pork steaks 3 minutes a side and, separately, cook the peppers slowly until soft.',
  },
  {
    id: 'com_tofu_salteado', name: 'Tofu salteado con arroz y verduras',
    nameEn: 'Stir-fried tofu with rice and vegetables',
    slot: 'comida', minutes: 24, complexity: 'facil', veg: true,
    pantry: ['tofu', 'arroz', 'verdura', 'aceite'],
    kcal: 570, protein: 30, carbs: 70, fat: 18,
    how: 'Escurre bien el tofu, córtalo en dados y dóralo por todas las caras. Saltea la verdura, junta con el arroz cocido y termina con soja y sésamo.',
    howEn: 'Drain the tofu well, cube it and brown it on all sides. Stir-fry the vegetables, add the cooked rice and finish with soy and sesame.',
  },
  {
    id: 'com_merluza_verduras', name: 'Merluza a la plancha con verduras',
    nameEn: 'Grilled hake with vegetables',
    slot: 'comida', minutes: 20, complexity: 'facil',
    pantry: ['pescado', 'verdura', 'patata', 'aceite'],
    kcal: 500, protein: 42, carbs: 40, fat: 16,
    how: 'Haz la merluza a la plancha 3 minutos por lado con ajo y perejil. Acompáñala de verdura al vapor y patata cocida.',
    howEn: 'Grill the hake 3 minutes a side with garlic and parsley. Serve with steamed vegetables and boiled potato.',
  },
  {
    id: 'com_pasta_pollo_pesto', name: 'Pasta con pollo y pesto',
    nameEn: 'Chicken pesto pasta',
    slot: 'comida', minutes: 20, complexity: 'facil',
    pantry: ['pasta', 'pollo', 'queso', 'aceite'],
    kcal: 720, protein: 46, carbs: 78, fat: 26,
    how: 'Cuece la pasta. Mientras, dora el pollo en dados. Mezcla los dos con dos cucharadas de pesto y un poco del agua de la cocción.',
    howEn: 'Cook the pasta. Meanwhile brown the diced chicken. Toss both with two spoons of pesto and a little pasta water.',
  },
];

// ── CENAS ──────────────────────────────────────────────────────
const DINNER: Recipe[] = [
  {
    id: 'cen_tortilla_verduras', name: 'Tortilla de verduras',
    nameEn: 'Vegetable omelette',
    slot: 'cena', minutes: 14, complexity: 'facil', veg: true,
    pantry: ['huevo', 'verdura', 'aceite'],
    kcal: 380, protein: 26, carbs: 14, fat: 25,
    how: 'Saltea calabacín y cebolla 6 minutos. Añade 3 huevos batidos y cuaja la tortilla a fuego medio-bajo, 2 minutos por cada lado.',
    howEn: 'Sauté courgette and onion for 6 minutes. Add 3 beaten eggs and set the omelette over medium-low heat, 2 minutes a side.',
  },
  {
    id: 'cen_pollo_ensalada', name: 'Pechuga con ensalada y aguacate',
    nameEn: 'Chicken breast with salad and avocado',
    slot: 'cena', minutes: 15, complexity: 'facil',
    pantry: ['pollo', 'ensalada', 'aguacate', 'tomate'],
    kcal: 470, protein: 45, carbs: 18, fat: 24,
    how: 'Pechuga a la plancha con especias, 4 minutos por lado. Al lado, hojas verdes con tomate, aguacate, aceite y vinagre.',
    howEn: 'Grill the chicken breast with spices, 4 minutes a side. Alongside, greens with tomato, avocado, oil and vinegar.',
  },
  {
    id: 'cen_crema_verduras', name: 'Crema de verduras con huevo duro',
    nameEn: 'Vegetable soup with boiled egg',
    slot: 'cena', minutes: 25, complexity: 'facil', veg: true,
    pantry: ['verdura', 'patata', 'huevo', 'aceite'],
    kcal: 360, protein: 20, carbs: 34, fat: 15,
    how: 'Cuece verdura variada con una patata 18 minutos y tritura. Sirve con dos huevos duros troceados por encima y un hilo de aceite.',
    howEn: 'Boil mixed vegetables with a potato for 18 minutes and blend. Serve with two chopped boiled eggs on top and a drizzle of oil.',
  },
  {
    id: 'cen_salmon_ensalada', name: 'Salmón a la plancha con ensalada',
    nameEn: 'Pan-seared salmon with salad',
    slot: 'cena', minutes: 16, complexity: 'facil',
    pantry: ['pescado', 'ensalada', 'aceite', 'tomate'],
    kcal: 520, protein: 40, carbs: 12, fat: 34,
    how: 'Sella el salmón por el lado de la piel 4 minutos y 2 por el otro. Acompaña con ensalada aliñada. Nada más.',
    howEn: 'Sear the salmon skin-side down for 4 minutes and 2 on the other side. Serve with dressed salad. Nothing else.',
  },
  {
    id: 'cen_revuelto_gambas', name: 'Revuelto de gambas y espárragos',
    nameEn: 'Prawn and asparagus scramble',
    slot: 'cena', minutes: 12, complexity: 'facil',
    pantry: ['marisco', 'huevo', 'verdura', 'aceite'],
    kcal: 400, protein: 34, carbs: 10, fat: 26,
    how: 'Saltea los espárragos troceados 4 minutos, añade las gambas 2 minutos más y termina con 3 huevos batidos removiendo hasta que cuajen.',
    howEn: 'Sauté the chopped asparagus for 4 minutes, add the prawns for 2 more and finish with 3 beaten eggs, stirring until just set.',
  },
  {
    id: 'cen_pavo_verduras', name: 'Pavo salteado con verduras',
    nameEn: 'Turkey stir-fry with vegetables',
    slot: 'cena', minutes: 18, complexity: 'facil',
    pantry: ['pollo', 'verdura', 'aceite'],
    kcal: 430, protein: 46, carbs: 20, fat: 17,
    how: 'Corta el pavo en tiras y saltéalo a fuego fuerte 4 minutos. Añade brócoli y pimiento y sigue 6 minutos con un poco de soja.',
    howEn: 'Slice the turkey and stir-fry over high heat for 4 minutes. Add broccoli and pepper and continue for 6 minutes with a splash of soy.',
  },
  {
    id: 'cen_atun_ensalada', name: 'Ensalada de atún y garbanzos',
    nameEn: 'Tuna and chickpea salad',
    slot: 'cena', minutes: 8, complexity: 'facil',
    pantry: ['atun', 'legumbre', 'tomate', 'ensalada', 'aceite'],
    kcal: 460, protein: 36, carbs: 38, fat: 18,
    how: 'Mezcla garbanzos cocidos, dos latas de atún, tomate y cebolla. Aliña con aceite, vinagre y orégano. Sin encender el fuego.',
    howEn: 'Mix cooked chickpeas, two tins of tuna, tomato and onion. Dress with oil, vinegar and oregano. Without turning on the hob.',
  },
  {
    id: 'cen_wok_tofu', name: 'Wok de tofu y verduras',
    nameEn: 'Tofu and vegetable wok',
    slot: 'cena', minutes: 16, complexity: 'facil', veg: true,
    pantry: ['tofu', 'verdura', 'aceite'],
    kcal: 390, protein: 28, carbs: 22, fat: 22,
    how: 'Dora el tofu en dados hasta que quede crujiente por fuera. Saca, saltea la verdura 6 minutos y devuélvelo a la sartén con soja y jengibre.',
    howEn: 'Brown the cubed tofu until crisp outside. Remove, stir-fry the vegetables for 6 minutes and return the tofu with soy and ginger.',
  },
  {
    id: 'cen_hamburguesa_casera', name: 'Hamburguesa casera con ensalada',
    nameEn: 'Homemade burger with salad',
    slot: 'cena', minutes: 18, complexity: 'medio',
    pantry: ['ternera', 'pan', 'ensalada', 'tomate'],
    kcal: 600, protein: 42, carbs: 40, fat: 30,
    how: 'Salpimenta 180 g de carne picada y forma la hamburguesa sin apretarla. Hazla 3 minutos por lado. Monta con pan, tomate y hojas verdes.',
    howEn: 'Season 180 g of minced beef and shape the patty without pressing it. Cook 3 minutes a side. Build with bread, tomato and greens.',
  },
  {
    id: 'cen_sopa_pollo', name: 'Sopa de pollo y fideos',
    nameEn: 'Chicken noodle soup',
    slot: 'cena', minutes: 22, complexity: 'facil',
    pantry: ['pollo', 'pasta', 'verdura'],
    kcal: 420, protein: 34, carbs: 48, fat: 9,
    how: 'Hierve caldo con zanahoria y puerro 10 minutos. Añade el pollo en tiras y los fideos y cuece 8 minutos más.',
    howEn: 'Simmer stock with carrot and leek for 10 minutes. Add the sliced chicken and the noodles and cook for 8 minutes more.',
  },
  {
    id: 'cen_pizza_masa_fina', name: 'Pizza rápida de base fina',
    nameEn: 'Quick thin-crust pizza',
    slot: 'cena', minutes: 20, complexity: 'facil', veg: true,
    pantry: ['pan', 'tomate', 'queso', 'verdura'],
    kcal: 560, protein: 28, carbs: 62, fat: 22,
    how: 'Sobre una base fina o un pan plano, extiende tomate, queso y la verdura que tengas. Horno a 220 °C, 10 minutos, hasta que burbujee.',
    howEn: 'On a thin base or flatbread spread tomato, cheese and whatever vegetables you have. Oven at 220 °C for 10 minutes, until bubbling.',
  },
  {
    id: 'cen_bacalao_pisto', name: 'Bacalao con pisto',
    nameEn: 'Cod with ratatouille',
    slot: 'cena', minutes: 30, complexity: 'medio',
    pantry: ['pescado', 'verdura', 'tomate', 'aceite'],
    kcal: 480, protein: 40, carbs: 26, fat: 24,
    how: 'Haz el pisto con cebolla, calabacín, pimiento y tomate a fuego lento 20 minutos. Coloca encima el lomo de bacalao y tapa 6 minutos.',
    howEn: 'Cook the ratatouille with onion, courgette, pepper and tomato over low heat for 20 minutes. Place the cod on top and cover for 6 minutes.',
  },
];

// ── SNACKS ─────────────────────────────────────────────────────
const SNACK: Recipe[] = [
  {
    id: 'snk_yogur_nueces', name: 'Yogur griego con nueces',
    nameEn: 'Greek yoghurt with walnuts',
    slot: 'snack', minutes: 2, complexity: 'facil', veg: true,
    pantry: ['yogur', 'frutos_secos'],
    kcal: 260, protein: 18, carbs: 14, fat: 14,
    how: 'Un yogur griego natural y un puñado de nueces. Dos minutos, cero fuego.',
    howEn: 'A plain Greek yoghurt and a handful of walnuts. Two minutes, no cooking.',
  },
  {
    id: 'snk_tostada_atun', name: 'Tostada de atún y tomate',
    nameEn: 'Tuna and tomato toast',
    slot: 'snack', minutes: 5, complexity: 'facil',
    pantry: ['pan', 'atun', 'tomate'],
    kcal: 280, protein: 24, carbs: 28, fat: 7,
    how: 'Tuesta una rebanada, unta tomate y reparte una lata de atún escurrido. Pimienta por encima.',
    howEn: 'Toast a slice, spread tomato and top with a drained tin of tuna. Pepper on top.',
  },
  {
    id: 'snk_fruta_frutos', name: 'Fruta con frutos secos',
    nameEn: 'Fruit with nuts',
    slot: 'snack', minutes: 2, complexity: 'facil', veg: true,
    pantry: ['fruta', 'frutos_secos'],
    kcal: 240, protein: 6, carbs: 30, fat: 12,
    how: 'Una pieza de fruta y 25 g de almendras o nueces. Lo que se lleva en la mochila.',
    howEn: 'A piece of fruit and 25 g of almonds or walnuts. The one you take in your bag.',
  },
  {
    id: 'snk_huevos_duros', name: 'Huevos duros con sal',
    nameEn: 'Boiled eggs with salt',
    slot: 'snack', minutes: 12, complexity: 'facil', veg: true,
    pantry: ['huevo'],
    kcal: 220, protein: 19, carbs: 2, fat: 15,
    how: 'Tres huevos, 10 minutos de agua hirviendo, agua fría y sal. Se hacen de golpe para toda la semana.',
    howEn: 'Three eggs, 10 minutes in boiling water, cold water and salt. Make a batch for the whole week.',
  },
  {
    id: 'snk_batido_proteico', name: 'Batido de proteína y plátano',
    nameEn: 'Protein and banana shake',
    slot: 'snack', minutes: 3, complexity: 'facil', veg: true,
    pantry: ['lacteo', 'platano'],
    kcal: 300, protein: 30, carbs: 34, fat: 5,
    how: 'Bate 300 ml de leche o bebida vegetal con un plátano y un cacito de proteína. El de después de entrenar.',
    howEn: 'Blend 300 ml milk or plant drink with a banana and a scoop of protein. The post-training one.',
  },
  {
    id: 'snk_requeson_fruta', name: 'Requesón con fruta',
    nameEn: 'Cottage cheese with fruit',
    slot: 'snack', minutes: 3, complexity: 'facil', veg: true,
    pantry: ['queso', 'fruta'],
    kcal: 230, protein: 22, carbs: 20, fat: 6,
    how: '150 g de requesón con fruta troceada. Mucha proteína y poca grasa, para la tarde.',
    howEn: '150 g of cottage cheese with chopped fruit. Plenty of protein, little fat, for the afternoon.',
  },
  {
    id: 'snk_hummus_crudites', name: 'Hummus con crudités',
    nameEn: 'Hummus with crudités',
    slot: 'snack', minutes: 6, complexity: 'facil', veg: true,
    pantry: ['legumbre', 'verdura', 'aceite'],
    kcal: 250, protein: 10, carbs: 26, fat: 12,
    how: 'Tritura garbanzos cocidos con aceite, limón y comino. Moja bastones de zanahoria y pimiento.',
    howEn: 'Blend cooked chickpeas with oil, lemon and cumin. Dip carrot and pepper sticks.',
  },
  {
    id: 'snk_tostada_aguacate', name: 'Tostada de aguacate',
    nameEn: 'Avocado toast',
    slot: 'snack', minutes: 4, complexity: 'facil', veg: true,
    pantry: ['pan', 'aguacate'],
    kcal: 270, protein: 7, carbs: 28, fat: 15,
    how: 'Aplasta medio aguacate sobre una tostada con sal, limón y pimienta.',
    howEn: 'Mash half an avocado onto a slice of toast with salt, lemon and pepper.',
  },
];

export const RECIPES: Recipe[] = [...BREAKFAST, ...LUNCH, ...DINNER, ...SNACK];

export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/** Todas las etiquetas de despensa que aparecen en el catálogo, agrupadas. */
export const PANTRY_GROUPS: { id: string; labelKey: string; items: Pantry[] }[] = [
  { id: 'proteina', labelKey: 'mc_mp_pantry_protein', items: ['huevo', 'pollo', 'ternera', 'cerdo', 'pescado', 'atun', 'marisco', 'tofu', 'legumbre'] },
  { id: 'lacteos', labelKey: 'mc_mp_pantry_dairy', items: ['lacteo', 'yogur', 'queso'] },
  { id: 'hidratos', labelKey: 'mc_mp_pantry_carbs', items: ['arroz', 'pasta', 'pan', 'patata', 'avena', 'quinoa'] },
  { id: 'fresco', labelKey: 'mc_mp_pantry_fresh', items: ['verdura', 'ensalada', 'tomate', 'fruta', 'platano', 'aguacate'] },
  { id: 'despensa', labelKey: 'mc_mp_pantry_staples', items: ['aceite', 'frutos_secos', 'conserva'] },
];

/** Nombre del plato en el idioma de la interfaz. */
export function recipeName(r: Recipe, lang: string): string {
  return lang.startsWith('en') ? r.nameEn : r.name;
}

/** Preparación en el idioma de la interfaz. */
export function recipeHow(r: Recipe, lang: string): string {
  return lang.startsWith('en') ? r.howEn : r.how;
}
