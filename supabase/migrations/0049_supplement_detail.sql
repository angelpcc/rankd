-- ============================================================
-- RANKD · Nutrición · Explicación detallada de cada suplemento
--
-- La ficha tenía una sola línea ("Estimulante para energía y concentración") y
-- una lista de beneficios sueltos. Con eso no se decide nada: no dice QUÉ hace,
-- para quién tiene sentido ni qué esperar de verdad.
--
-- `detail` es un párrafo en lenguaje llano que explica el mecanismo, para quién
-- suele tener sentido y qué NO hace. Sigue sin dar dosis ni indicaciones
-- médicas: el disclaimer de la sección se mantiene.
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.common_supplements add column if not exists detail text;

update public.common_supplements set detail = v.detail
from (values
  ('Creatina monohidrato',
   'Tu cuerpo usa fosfocreatina para regenerar energía en los primeros segundos de un esfuerzo máximo. Suplementarla llena ese depósito, así que aguantas una o dos repeticiones más por serie y te recuperas antes entre ellas. Ese trabajo extra, sostenido durante meses, es lo que acaba dando músculo y fuerza: la creatina no construye nada por sí sola. Es el suplemento con más estudios detrás y de los más baratos. Retiene algo de agua dentro del músculo, así que la báscula puede subir uno o dos kilos las primeras semanas sin que sea grasa.'),
  ('Cafeína',
   'Bloquea la adenosina, la molécula que le dice al cerebro que estás cansado. No te da energía: te tapa el cansancio, y eso hace que el mismo esfuerzo se sienta más llevadero. Sirve para entrenar con más foco y para aguantar más en trabajos duros. La tolerancia sube rápido, así que el efecto se nota mucho menos si la tomas a diario. Si entrenas por la tarde, ten en cuenta que tarda entre cinco y seis horas en reducirse a la mitad y puede estropearte el sueño, que es justo lo que necesitas para recuperar.'),
  ('Beta-alanina',
   'Ayuda al músculo a fabricar carnosina, que amortigua la acidez que se acumula cuando aprietas entre uno y cuatro minutos. Es exactamente el rango de un asalto duro o de una serie larga de muchas repeticiones. No hace nada en series de tres repeticiones ni en carrera larga. Necesita semanas de toma continuada para llenar el depósito, así que no se nota el primer día. El hormigueo en cara y manos es normal e inofensivo, y se reduce repartiendo la dosis.'),
  ('Proteína de suero (whey)',
   'Es comida, no un fármaco: proteína de leche filtrada, con un perfil de aminoácidos completo y absorción rápida. Su única ventaja real sobre el pollo o los huevos es la comodidad, que no es poco cuando entrenas fuerte y te cuesta llegar a tu objetivo diario de proteína. Si ya lo alcanzas comiendo, no aporta nada extra. Suele sentar bien incluso a gente con algo de intolerancia a la lactosa, porque el filtrado deja poca.'),
  ('Proteína vegana',
   'Mezcla de proteínas vegetales, normalmente guisante y arroz, combinadas justo para cubrirse los aminoácidos que le faltan a cada una por separado. Cumple la misma función que la whey: ayudarte a llegar a tu proteína diaria cuando comer más resulta incómodo. Suele tener menos leucina por ración, así que las raciones tienden a ser algo mayores. Textura más terrosa y espesa que la de suero.'),
  ('Caseína',
   'La otra proteína de la leche. Forma un gel en el estómago y se digiere despacio, liberando aminoácidos durante varias horas. Por eso es habitual antes de dormir. Dicho esto, lo que de verdad importa es la proteína TOTAL del día: la ventaja de repartirla así es pequeña comparada con llegar al total. Sacia bastante, lo que ayuda si estás bajando peso.'),
  ('EAA',
   'Los nueve aminoácidos esenciales, los que el cuerpo no fabrica y tienen que venir de la comida. Tienen sentido si te cuesta llegar a tu proteína diaria o entrenas en ayunas. Si ya tomas suficiente proteína, no añaden nada: estarías pagando caro por algo que la comida ya te da completo.'),
  ('BCAA',
   'Solo tres de los nueve aminoácidos esenciales (leucina, isoleucina y valina). Fueron muy populares, pero con proteína suficiente en la dieta no aportan nada medible, porque para construir músculo hacen falta los nueve. Si vas a gastar en aminoácidos sueltos, los EAA tienen más sentido; y si comes bien, ninguno de los dos hace falta.'),
  ('Glutamina',
   'El aminoácido más abundante del cuerpo. Se vendió durante años para recuperación e inmunidad, pero en gente sana que come suficiente proteína los estudios no encuentran efecto sobre fuerza, masa ni recuperación. Donde sí tiene uso demostrado es en contextos clínicos, que no es tu caso si entrenas y comes bien.'),
  ('Citrulina malato',
   'Se convierte en arginina y sube el óxido nítrico, lo que ensancha los vasos y lleva más sangre al músculo. Se nota sobre todo como más congestión y algo menos de fatiga en series de repeticiones altas. El efecto sobre la fuerza máxima es pequeño. Se absorbe mejor que la arginina tomada directamente, que es la razón de que se use esta y no aquella.'),
  ('Pre-entreno (mezcla)',
   'No es un ingrediente, es un combinado: casi siempre cafeína como base, más beta-alanina, citrulina y algún estimulante extra. El problema es que rara vez sabes cuánto lleva de cada cosa, y muchas mezclas ponen dosis simbólicas de todo menos de la cafeína. Comprar los ingredientes por separado sale más barato y sabes qué tomas. Si usas uno, mira la etiqueta y cuenta la cafeína dentro de tu total del día.'),
  ('Carnitina',
   'Transporta ácidos grasos dentro de la mitocondria para quemarlos. De ahí la fama de quemagrasas, que no se sostiene: en gente sana el músculo ya tiene toda la que necesita y suplementarla no aumenta la grasa que quemas. Donde hay algo de evidencia es en recuperación y menos dolor muscular tras esfuerzos duros.'),
  ('Omega 3',
   'Ácidos grasos EPA y DHA, que vienen del pescado azul. La mayoría de dietas modernas se quedan cortas. Tienen efecto antiinflamatorio general y hay evidencia razonable en salud cardiovascular y articular. Para rendimiento el efecto directo es pequeño: esto es un suplemento de salud a largo plazo, no de fuerza. Si comes pescado azul dos o tres veces por semana probablemente ya vas cubierto.'),
  ('Vitamina D',
   'Funciona más como una hormona que como una vitamina, y participa en hueso, músculo e inmunidad. Se fabrica en la piel con el sol, así que en invierno, en latitudes altas o si entrenas siempre bajo techo es fácil quedarse bajo. Es de las pocas carencias frecuentes de verdad. Se puede medir con un análisis de sangre, y merece la pena hacerlo antes de suplementar a ciegas.'),
  ('Magnesio',
   'Interviene en cientos de reacciones, entre ellas la contracción muscular y el descanso. Sudar mucho y entrenar duro aumentan lo que gastas. Cuando falta, aparecen calambres, peor sueño y más fatiga. La forma importa: el citrato y el bisglicinato se absorben bien, mientras que el óxido, que es el más barato y común, se absorbe mal y suele soltar el intestino.'),
  ('Zinc',
   'Mineral que interviene en la inmunidad, la recuperación y la producción hormonal. Se pierde por el sudor, así que entrenar mucho aumenta las necesidades. Ojo con pasarse a largo plazo: el exceso de zinc bloquea la absorción de cobre.'),
  ('ZMA',
   'Zinc, magnesio y vitamina B6 juntos, pensado para tomar antes de dormir. La idea de que suba la testosterona solo se sostiene si partías con déficit de zinc o magnesio. Si los tenías bien, no cambia nada hormonalmente. Como forma cómoda de cubrir zinc y magnesio, funciona.'),
  ('Complejo B',
   'Las vitaminas del grupo B son las que convierten la comida en energía utilizable. No dan energía por sí mismas: si no te falta ninguna, tomarlas no hace nada, y el exceso se elimina por la orina. Tiene sentido sobre todo en dietas veganas, donde la B12 sí falta de verdad.'),
  ('Vitamina C',
   'Antioxidante y apoyo al sistema inmune. Detalle importante para quien entrena: tomar dosis altas justo alrededor del entrenamiento puede reducir parte de la adaptación, porque el estrés oxidativo del ejercicio es parte de la señal que hace que mejores. Si la tomas, mejor lejos de la sesión.'),
  ('Multivitamínico',
   'Red de seguridad para cubrir huecos de la dieta, no un sustituto de comer bien. Útil si comes poco variado, estás en déficit calórico fuerte o viajas mucho. No arregla una dieta mala y ninguna de sus vitaminas está en dosis pensada para tratar una carencia concreta.'),
  ('Colágeno',
   'Proteína del tejido conectivo. Como proteína alimentaria es de baja calidad porque le falta triptófano, así que no sirve para construir músculo. Donde hay señales interesantes es en tendones y articulaciones, sobre todo tomado con vitamina C alrededor de una hora antes de cargar ese tejido.'),
  ('Cúrcuma',
   'Su compuesto activo, la curcumina, tiene efecto antiinflamatorio. El problema es que se absorbe fatal por sí sola: las presentaciones útiles la combinan con pimienta negra o la formulan para mejorar la absorción. La cúrcuma de la cocina no llega a dosis con efecto.'),
  ('Ashwagandha',
   'Planta adaptógena con evidencia razonable en reducción de estrés percibido y cortisol. Cuando alguien nota que le ayuda al rendimiento, casi siempre es por la vía indirecta: duermes mejor y te estresas menos, así que recuperas mejor. No es un estimulante ni actúa el mismo día.'),
  ('Melatonina',
   'No es un somnífero: es la hormona que le dice al cuerpo que ya es de noche. Sirve sobre todo para reajustar el reloj interno, como en el jet lag o si entrenas muy tarde y te cuesta desconectar. Dosis pequeñas funcionan igual o mejor que las grandes.'),
  ('Electrolitos',
   'Sodio, potasio y magnesio, que es lo que se va con el sudor. Beber solo agua tras sudar mucho repone el líquido pero no las sales, y eso deja calambres y sensación de flojera. Importan en sesiones largas, con calor, o cuando estás cortando peso.'),
  ('Bicarbonato de sodio',
   'Tampón que sube el pH de la sangre y ayuda a retirar la acidez del músculo en esfuerzos muy intensos de uno a diez minutos. Funciona de verdad y es baratísimo. El problema es el estómago: a mucha gente le sienta francamente mal, así que se prueba en entrenamiento y jamás el día de competir.'),
  ('Nitratos (zumo de remolacha)',
   'Los nitratos se convierten en óxido nítrico, que abre los vasos y hace que el músculo necesite algo menos de oxígeno para el mismo trabajo. La mejora en resistencia es pequeña pero real, y se nota más en gente no muy entrenada. Los enjuagues bucales antisépticos lo anulan, porque hacen falta las bacterias de la boca para la conversión.'),
  ('Probióticos',
   'Bacterias vivas que apoyan la flora intestinal. El efecto depende mucho de la cepa concreta: no todos los probióticos valen para lo mismo, y el envase rara vez lo aclara. Tienen más sentido tras un ciclo de antibióticos o con molestias digestivas frecuentes que como suplemento diario porque sí.')
) as v(name, detail)
where common_supplements.name = v.name;
