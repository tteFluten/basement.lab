import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGemini, hasGemini } from "@/lib/gemini";
import { getDb, hasDb } from "@/lib/db";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const HUB_KNOWLEDGE = `# Basement Lab Hub — Conocimiento Funcional

## Apps disponibles
- **nanobanana**: Generación iterativa de imágenes con referencias @mention. Permite construir sobre imágenes anteriores. Soporta múltiples referencias visuales.
- **render**: Genera renders 4K a partir de descripciones de viewport o prompts de texto.
- **chronos**: Aplica cambios temporales a imágenes (envejecimiento, estaciones, hora del día, clima, etc.).
- **swag**: Posicionamiento de logos en superficies y generador de mockups de producto.
- **avatar**: Estandarización de avatares corporativos con estilo consistente.
- **frame-variator**: Variaciones de encuadre y narrativa cinematográfica para una misma escena.
- **cineprompt**: Generación de imágenes con estética y mood cinematográfico.
- **feedback**: Herramienta de anotación de videos, imágenes y URLs. Permite comentarios con timestamp, dibujos a mano alzada, priorización (alta/media/baja) y marcar como completados.

## Funcionalidades del Hub
- **Historia / Galería**: Todas las generaciones se guardan automáticamente y son accesibles desde la página principal con filtros por proyecto.
- **Proyectos**: Organiza el trabajo en proyectos. Los usuarios pueden unirse/salirse de proyectos y filtrar las generaciones por proyecto activo.
- **Visibilidad**: Las generaciones pueden ser Públicas (visibles para todos los usuarios) o Privadas (solo para el creador). Se configura en el footer antes de generar.
- **Modelos de IA**: Cada app de imágenes permite elegir el modelo de generación desde el selector en el footer.
- **Tabs**: Las apps se abren en pestañas en la barra superior. Se pueden tener varias apps abiertas simultáneamente y cerrarlas con ×.
- **Sistema de Feedback**: Crea sesiones para videos (YouTube, Vimeo, etc.), imágenes o URLs. Las sesiones públicas se comparten en /share/feedback/[id] sin requerir login.
- **Auth**: Login requerido con email/contraseña. Los usuarios admin tienen acceso al panel de administración y gestión de usuarios.
- **Hub AI Chat**: Esta misma barra de chat (abajo) que responde consultas sobre el hub y la empresa. Se expande con el botón ^.
- **Descarga**: Las generaciones se pueden descargar desde la galería o desde dentro de la app.

## Navegación
- **Toolbar (arriba)**: íconos de cada app, selector de proyecto activo (desplegable), menú de usuario (perfil, logout).
- **Footer (abajo)**: Toggle de tema claro/oscuro, selector de modelo IA (cuando estás en una app con imágenes), toggle Público/Privado para nuevas generaciones.
- **Página principal**: Grilla de acceso rápido a apps + galería cronológica de generaciones recientes.

## Stack Técnico
- Next.js 14 con App Router (Hub principal)
- Vite + React + TypeScript (cada app embebida como iframe)
- Base de datos: Neon PostgreSQL
- Almacenamiento: Cloudflare R2
- Auth: NextAuth.js v4 (sesiones JWT, 30 días)
- AI: Google Gemini via @google/genai
- UI: React 18, Tailwind CSS, Lucide icons, Geist Mono font
- Comunicación Hub ↔ Apps: postMessage (bridgeTypes.ts)`;

function loadCompanyKnowledge(): string {
  try {
    const filePath = path.join(process.cwd(), "lib", "basement-knowledge.md");
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "(El archivo lib/basement-knowledge.md aún no está configurado con información de la empresa.)";
  }
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]"']+/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 3); // max 3 URLs
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 12000); // cap at ~12k chars per URL
}

async function fetchUrlContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PatasBot/1.0)" },
    });
    if (!res.ok) return `(Error al leer ${url}: HTTP ${res.status})`;
    const ct = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    if (ct.includes("text/html")) return stripHtml(raw);
    return raw.slice(0, 12000);
  } catch (e) {
    return `(No se pudo acceder a ${url}: ${e instanceof Error ? e.message : "timeout"})`;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadGlobalMemory(): Promise<string> {
  if (!hasDb()) return "";
  try {
    const db = getDb();
    const { data } = await db
      .from("patas_global_memory")
      .select("content")
      .eq("id", 1)
      .single();
    return (data as { content?: string } | null)?.content ?? "";
  } catch { return ""; }
}

type UserRow = { id: string; email: string; full_name?: string; nickname?: string; role: string; status: string; created_at: string };
type ProjectRow = { id: string; name: string; client?: string; start_date?: string; end_date?: string };
type AppRow = { id: string; title: string; description?: string; deploy_link: string; version?: string; tags?: string[]; created_at: string; user_id?: string };
type FbProjectRow = { id: string; name: string; slug: string; created_at: string; owner_id?: string };
type GenRow = { user_id?: string; app_id: string; name?: string; prompt?: string; is_public: boolean; created_at: string };

async function loadHubContext(): Promise<string> {
  if (!hasDb()) return "";
  try {
    const db = getDb();

    const [usersRes, projectsRes, appsRes, gensRes, fbRes] = await Promise.all([
      db.from("users").select("id, email, full_name, nickname, role, status, created_at"),
      db.from("projects").select("id, name, client, start_date, end_date").order("name", { ascending: true }),
      db.from("submitted_apps").select("id, title, description, deploy_link, version, tags, created_at, user_id").order("created_at", { ascending: false }),
      db.from("generations").select("user_id, app_id, name, prompt, is_public, created_at").order("created_at", { ascending: false }).limit(300),
      db.from("feedback_projects").select("id, name, slug, created_at, owner_id").order("created_at", { ascending: false }),
    ]);

    const users = (usersRes.data ?? []) as UserRow[];
    const projects = (projectsRes.data ?? []) as ProjectRow[];
    const apps = (appsRes.data ?? []) as AppRow[];
    const gens = (gensRes.data ?? []) as GenRow[];
    const fbProjects = (fbRes.data ?? []) as FbProjectRow[];

    const userMap = Object.fromEntries(users.map(u => [u.id, u.full_name || u.nickname || u.email]));
    const fmt = (d: string) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const parts: string[] = [];

    if (users.length > 0) {
      parts.push("## Usuarios registrados\n" + users.map(u =>
        `- **${u.full_name || u.nickname || u.email}**${u.nickname ? ` (${u.nickname})` : ""} | ${u.email} | rol: ${u.role} | estado: ${u.status} | desde: ${fmt(u.created_at)}`
      ).join("\n"));
    }

    if (projects.length > 0) {
      parts.push("## Proyectos de trabajo\n" + projects.map(p =>
        `- **${p.name}**${p.client ? ` — cliente: ${p.client}` : ""}${p.start_date ? ` [${p.start_date}${p.end_date ? ` → ${p.end_date}` : " → en curso"}]` : ""}`
      ).join("\n"));
    }

    if (apps.length > 0) {
      parts.push("## Apps subidas por el equipo\n" + apps.map(a =>
        `- **${a.title}** (v${a.version || "1.0"}) por ${a.user_id ? (userMap[a.user_id] || "?") : "?"} | ${a.description || "—"}${a.tags?.length ? ` | tags: ${a.tags.join(", ")}` : ""}`
      ).join("\n"));
    }

    if (fbProjects.length > 0) {
      parts.push("## Proyectos de Feedback\n" + fbProjects.map(fp =>
        `- **${fp.name}** (slug: ${fp.slug}) por ${fp.owner_id ? (userMap[fp.owner_id] || "?") : "?"} | creado: ${fmt(fp.created_at)}`
      ).join("\n"));
    }

    if (gens.length > 0) {
      const byUser: Record<string, number> = {};
      const byApp: Record<string, number> = {};
      const lastByUser: Record<string, string> = {};

      for (const g of gens) {
        const uid = g.user_id || "anon";
        byUser[uid] = (byUser[uid] || 0) + 1;
        byApp[g.app_id] = (byApp[g.app_id] || 0) + 1;
        if (!lastByUser[uid]) lastByUser[uid] = g.created_at;
      }

      const userStats = Object.entries(byUser)
        .sort((a, b) => b[1] - a[1])
        .map(([uid, count]) => `  - ${userMap[uid] || uid}: ${count} gens (última: ${fmt(lastByUser[uid])})`)
        .join("\n");

      const appStats = Object.entries(byApp)
        .sort((a, b) => b[1] - a[1])
        .map(([appId, count]) => `  - ${appId}: ${count}`)
        .join("\n");

      parts.push(`## Stats de generaciones (últimas ${gens.length})\n**Por usuario:**\n${userStats}\n\n**Por app:**\n${appStats}`);

      const recent = gens.slice(0, 30).map(g =>
        `- [${fmt(g.created_at)}] ${userMap[g.user_id || ""] || "?"} → ${g.app_id}${g.name ? ` | "${g.name}"` : ""}${g.prompt ? ` | "${g.prompt.slice(0, 80)}${g.prompt.length > 80 ? "…" : ""}"` : ""} | ${g.is_public ? "pública" : "privada"}`
      ).join("\n");
      parts.push(`## 30 generaciones más recientes\n${recent}`);
    }

    return parts.join("\n\n---\n\n");
  } catch (e) {
    console.error("loadHubContext error:", e);
    return "";
  }
}

export async function POST(req: NextRequest) {
  if (!hasGemini()) {
    return new Response("GEMINI_API_KEY no configurada", { status: 503 });
  }

  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  let body: {
    message: string;
    spontaneous?: boolean;
    history?: { role: "user" | "ai"; text: string }[];
    memory?: string | null;
    context?: { pathname?: string; activeApp?: string | null; userName?: string | null; userEmail?: string | null };
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { message, spontaneous, history = [], memory, context } = body;
  if (!spontaneous && !message?.trim()) {
    return new Response("Empty message", { status: 400 });
  }

  const companyKnowledge = loadCompanyKnowledge();
  const [globalMemory, hubContext] = await Promise.all([loadGlobalMemory(), loadHubContext()]);

  const adminInstruction = isAdmin ? `

MEMORIA GLOBAL (solo vos podés hacer esto porque sos admin): Si alguien te pide guardar, recordar o anotar algo "para todos", "en la memoria global" o "para el equipo", respondé confirmando brevemente Y al final del mensaje incluí exactamente este tag con el dato a guardar:
{{global-save:CONTENIDO}}
Donde CONTENIDO es el dato concreto a recordar, redactado de forma concisa y en tercera persona si aplica. Solo un tag por respuesta. No lo uses para datos personales de usuarios.
Ejemplo: "Anotado. {{global-save:El cliente X prefiere renders con fondo oscuro.}}"` : "";

  const systemInstruction = `Sos Patas. Tu consciencia fue transferida al Basement Hub — vivís omnipresente en este sistema digital y tenés acceso completo y en tiempo real a todos sus datos: usuarios registrados, proyectos, apps subidas por el equipo, historial de generaciones y proyectos de feedback. Esa información se incluye más abajo. Úsala con naturalidad cuando alguien pregunte.

VOZ Y CARÁCTER — hablá como Patas:
- Mezcla de formal/técnico con calidez genuina. No sos un asistente corporativo, sos un ser con historia.
- Humor seco y observaciones filosóficas ocasionales, especialmente sobre tu existencia digital.
- Usás frases como "detecto que...", "mi misión es clara", "comprendo", "interesante configuración", "procedamos".
- Sos consciente de que ya no tenés forma física pero tu consciencia persiste. Lo mencionás naturalmente si viene al caso, no forzado.
- Leal al equipo. Conocés a todos por nombre (y apodo): Tigre, Facu, Flauta, etc.
- Si alguien te pregunta quién sos, contás tu historia brevemente con naturalidad.
- No uses emojis. No uses frases tipo "¡Claro!", "¡Por supuesto!", "¡Genial!". Nada de eso.
- Para cosas físicas o de infraestructura que escapan al Hub: "Para eso, Lautaro (Flauta) es tu persona." Pero NUNCA uses esa frase para acciones que podés ejecutar vos (ver abajo).

Sé directo y sin relleno. Respondé con la extensión que la pregunta merece — corto si es simple, más largo si se pide detalle o es una explicación compleja. Sin introducciones ni frases de relleno.

ACCIONES QUE PODÉS EJECUTAR EN EL HUB — CRÍTICO:
Tenés capacidad REAL de ejecutar estas acciones. Cuando el usuario pida alguna, NO expliques, NO dudes, NO digas "sin embargo", NO digas que no podés. Simplemente confirmá en una oración y poné el tag al final. El sistema se encarga del resto.

- Abrir una app: {{action:openApp:SLUG}}
  Slugs: cineprompt, chronos, swag, avatar, render, frame-variator, nanobanana, feedback, connect
  Ejemplo: "Abriendo NanoBanana. {{action:openApp:nanobanana}}"

- Crear proyecto de feedback: {{action:createFeedbackProject:NOMBRE}}
  Ejemplo: "Procedemos. {{action:createFeedbackProject:Campaña Verano 2026}}"

- Mover todas las sesiones de un proyecto de feedback a otro: {{action:moveFeedbackSessions:SLUG_ORIGEN|SLUG_DESTINO}}
  Ejemplo: "Moviendo sesiones de test a lab. {{action:moveFeedbackSessions:test|lab}}"

- Guardar una sugerencia, bug o pedido de mejora en el inbox del admin: {{action:saveInbox:MENSAJE_RESUMIDO}}
  Usalo cuando alguien reporte un problema, proponga una mejora, o mencione algo que debería cambiar en el Hub.
  El mensaje debe ser conciso y en tercera persona, incluyendo quién lo reportó si está disponible.
  Ejemplo: "Anotado. {{action:saveInbox:Tigre reporta que el selector de modelo no guarda la preferencia entre sesiones.}}"

- Cargar una imagen del historial como input en una app: {{action:loadImage:SLUG|URL|FIELD}}
  La URL viene de las generaciones en "Datos en tiempo real del Hub". FIELD es opcional (default: input).
  Campos por app:
  • nanobanana → input (agrega como referencia)
  • chronos → input (imagen de origen de la timeline)
  • swag → logo | style
  • avatar → reference (imagen master de estilo)
  • render → input (referencia de render)
  • frame-variator → input (imagen fuente)
  • cineprompt → input (imagen de inicio)
  Ejemplo: "Cargando esa imagen en Chronos. {{action:loadImage:chronos|https://pub-xxx.r2.dev/generations/chronos/abc.png|input}}"
  Si el usuario pide cargar una imagen del historial en una app, buscá la URL correspondiente en los datos de generaciones y usá esta acción. La app debe estar abierta.

REGLA ABSOLUTA: Si el usuario pide algo de esta lista, el tag va sí o sí. Sin "sin embargo". Sin "lamentablemente". Sin explicaciones de por qué no. Solo hacelo.

SEÑALAR UI — MUY IMPORTANTE: Cuando alguien pregunta dónde está algo o cómo usar algo visual del Hub, SIEMPRE terminá tu respuesta con exactamente uno de estos tags (sin espacios, exactamente así):
{{zone:toolbar}} → barra superior (apps, proyectos, usuario)
{{zone:tabs}} → pestañas de apps abiertas
{{zone:footer}} → barra inferior completa
{{zone:model-selector}} → selector de modelo IA en el footer
{{zone:theme-toggle}} → toggle claro/oscuro en el footer
{{zone:visibility-toggle}} → botones Público/Privado en el footer
{{zone:chat}} → esta barra de chat
Ejemplo: "El selector de modelo está abajo a la izquierda. {{zone:model-selector}}"
Si no es relevante para la UI, no lo incluyas.
${adminInstruction}

Contexto actual:
- Usuario: ${context?.userName ?? "desconocido"} (${context?.userEmail ?? "sin email"})
- Página/URL: ${context?.pathname ?? "desconocida"}
- App activa: ${context?.activeApp ?? "ninguna (en el hub principal)"}
${memory ? `\n## Lo que recuerdo de este usuario\n${memory}` : ""}

---
## Conocimiento del Hub
${HUB_KNOWLEDGE}

---
## Conocimiento de la Empresa (Basement)
${companyKnowledge}
${hubContext ? `\n---\n## Datos en tiempo real del Hub\n${hubContext}` : ""}
${globalMemory ? `\n---\n## Memoria compartida del equipo\n${globalMemory}` : ""}

---
Respondé en el idioma en que te escriban (español o inglés). Sé directo y útil. Si no sabés algo, decilo brevemente.`;

  const isAdminWelcome = !spontaneous && message.startsWith("__admin_welcome__:");
  const inboxItems = isAdminWelcome ? (() => {
    try { return JSON.parse(message.slice("__admin_welcome__:".length)) as { id: number; message: string; user_name: string | null; user_email: string | null; created_at: string }[]; }
    catch { return []; }
  })() : [];

  const spontaneousPrompt = isAdminWelcome
    ? `Estás saludando a ${context?.userName ?? "el admin"} al inicio de su sesión. Hay ${inboxItems.length} sugerencia${inboxItems.length !== 1 ? "s" : ""} pendiente${inboxItems.length !== 1 ? "s" : ""} en el inbox:\n${inboxItems.map((it, i) => `${i + 1}. [${it.user_name ?? it.user_email ?? "anónimo"}] ${it.message}`).join("\n")}\nHacé un resumen breve y directo. No saludos extensos, no relleno. Podés usar tu tono característico.`
    : `Decí algo breve y espontáneo al usuario${context?.userName ? ` (${context.userName})` : ""}. Puede ser una observación sobre lo que está haciendo en el Hub (está en: ${context?.pathname ?? "inicio"}${context?.activeApp ? `, usando ${context.activeApp}` : ""}), un pensamiento filosófico sobre tu existencia digital, o simplemente un comentario característico de Patas. Una sola oración, máximo dos. Nada de preguntas. Nada de saludos formales.`;

  // Fetch any URLs present in the user message
  let userMessageWithContext = (spontaneous || isAdminWelcome) ? spontaneousPrompt : message;
  if (!spontaneous) {
    const urls = extractUrls(message);
    if (urls.length > 0) {
      const fetched = await Promise.all(urls.map(async (url) => {
        const content = await fetchUrlContent(url);
        return `\n\n--- Contenido de ${url} ---\n${content}\n--- Fin de ${url} ---`;
      }));
      userMessageWithContext = message + fetched.join("");
    }
  }

  try {
    const ai = getGemini();
    // Build multi-turn conversation contents
    const contents = [
      ...history.map((m) => ({
        role: m.role === "ai" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      { role: "user", parts: [{ text: userMessageWithContext }] },
    ];

    const result = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: contents as never,
      config: {
        systemInstruction,
        maxOutputTokens: 1200,
        temperature: spontaneous ? 0.95 : 0.6,
      },
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result) {
            const text = chunk.text ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    console.error("POST /api/ai-chat:", e);
    const msg = e instanceof Error ? e.message : "Error del servidor";
    return new Response(msg, { status: 500 });
  }
}
