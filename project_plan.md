# Rankd – Plan del Proyecto

## 1. Descripción del Proyecto
Rankd es una plataforma digital de scouting para deportes de contacto (boxeo, MMA). Conecta peleadores amateurs y profesionales con promotoras, managers, marcas y organizadores de eventos. Resuelve la falta de visibilidad y estructura en el ecosistema de los deportes de contacto.

**Usuarios objetivo:** Peleadores, promotoras, managers, marcas patrocinadoras, organizadores de eventos.

## 2. Estructura de Páginas
- `/` – Landing page con todas las secciones (one-page scroll)
  - `#home` – Hero principal
  - `#how-it-works` – Cómo funciona
  - `#fighters` – Peleadores destacados
  - `#opportunities` – Oportunidades disponibles
  - `#brands` – Marcas y equipamiento
  - `#partners` – Socios y marcas
  - `#contact` – Contacto
- `/auth` – Login y registro de usuarios
- `/registro` – Registro rápido para peleadores
- `/fighters` – Directorio completo de peleadores
- `/opportunities` – Listado de oportunidades reales
- `/brands` – Directorio de marcas
- `/fighter/:id` – Perfil público de peleador
- `/dashboard` – Dashboard del usuario
- `/dashboard/fighter` – Dashboard de peleador
- `/dashboard/org` – Dashboard de organización
- `/dashboard/brand` – Dashboard de marca
- `/onboarding/fighter` – Onboarding de peleador
- `/onboarding/org` – Onboarding de organización

## 3. Funcionalidades Core
- [x] Navbar fija con scroll suave entre secciones
- [x] Hero inmersivo con imagen de fondo
- [x] Sección "Cómo Funciona" con pasos visuales
- [x] Showcase de peleadores con tarjetas
- [x] Sección de oportunidades (combates, contratos, patrocinios)
- [x] Sección de marcas/equipamiento
- [x] Sección de partners/marcas
- [x] Formulario de contacto funcional
- [x] Footer completo
- [x] Sistema de autenticación (login/registro)
- [x] Perfiles de peleador con datos deportivos
- [x] Directorio de peleadores con filtros
- [x] Sistema de oportunidades con postulación
- [x] Dashboard por tipo de usuario
- [x] Onboarding multi-paso
- [x] Sistema de mensajes entre usuarios
- [x] **Multi-idioma (ES/EN) con detección automática del navegador**

## 4. Modelo de Datos
- Supabase Auth para autenticación
- Tabla `profiles` para perfiles de usuario
- Tabla `fighters` para datos deportivos de peleadores
- Tabla `opportunities` para oportunidades publicadas
- Tabla `applications` para postulaciones
- Tabla `messages` para mensajes entre usuarios

## 5. Integraciones Backend / Terceros
- Supabase: Auth, Database, Storage
- Formulario de contacto: Readdy Forms API
- Multi-idioma: i18next + react-i18next + i18next-browser-languagedetector

## 6. Plan de Fases

### Fase 1: Landing Page Completa ✅
- Objetivo: Construir el sitio web oficial de Rankd
- Entregable: Landing page con todas las secciones, diseño premium, datos mock realistas

### Fase 2: Autenticación y Perfiles ✅
- Objetivo: Registro de peleadores, perfiles, sistema de matching
- Entregable: Formularios de registro, páginas de perfil, dashboard

### Fase 3: Directorio y Oportunidades ✅
- Objetivo: Directorio de peleadores, sistema de oportunidades
- Entregable: Páginas de directorio, filtros, postulaciones

### Fase 4: Marcas y Multi-idioma ✅
- Objetivo: Sección de marcas, sistema multi-idioma
- Entregable: Página de marcas, traducciones ES/EN, selector de idioma

### Fase 5: Producción y Optimización (futuro)
- Objetivo: Conectar con Supabase real, optimizar rendimiento
- Entregable: Backend funcional, SEO, analytics
