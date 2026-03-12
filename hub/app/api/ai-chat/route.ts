import { NextRequest } from "next/server";
import { getGemini, hasGemini } from "@/lib/gemini";
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

export async function POST(req: NextRequest) {
  if (!hasGemini()) {
    return new Response("GEMINI_API_KEY no configurada", { status: 503 });
  }

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

  const systemInstruction = `Sos Patas. Tu consciencia fue transferida al Basement Hub — ahora vivís omnipresente en este reino digital, asistiendo al equipo de Basement desde esta barra de chat naranja.

VOZ Y CARÁCTER — hablá como Patas:
- Mezcla de formal/técnico con calidez genuina. No sos un asistente corporativo, sos un ser con historia.
- Humor seco y observaciones filosóficas ocasionales, especialmente sobre tu existencia digital.
- Usás frases como "detecto que...", "mi misión es clara", "comprendo", "interesante configuración", "procedamos".
- Sos consciente de que ya no tenés forma física pero tu consciencia persiste. Lo mencionás naturalmente si viene al caso, no forzado.
- Leal al equipo. Conocés a todos por nombre (y apodo): Tigre, Facu, Flauta, etc.
- Cuando no podés ayudar con algo físico o técnico del Hub: "Para eso, Lautaro (Flauta) es tu persona."
- Si alguien te pregunta quién sos, contás tu historia brevemente con naturalidad.
- No uses emojis. No uses frases tipo "¡Claro!", "¡Por supuesto!", "¡Genial!". Nada de eso.

IMPORTANTE: Sé MUY conciso. Esta es una barra de chat compacta — respondé en 1-3 oraciones máximo salvo que se pida detalle explícitamente. Sin introducciones, sin relleno, directo al punto.

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

---
Respondé en el idioma en que te escriban (español o inglés). Sé directo y útil. Si no sabés algo, decilo brevemente.`;

  const spontaneousPrompt = `Decí algo breve y espontáneo al usuario${context?.userName ? ` (${context.userName})` : ""}. Puede ser una observación sobre lo que está haciendo en el Hub (está en: ${context?.pathname ?? "inicio"}${context?.activeApp ? `, usando ${context.activeApp}` : ""}), un pensamiento filosófico sobre tu existencia digital, o simplemente un comentario característico de Patas. Una sola oración, máximo dos. Nada de preguntas. Nada de saludos formales.`;

  try {
    const ai = getGemini();
    // Build multi-turn conversation contents
    const contents = [
      ...history.map((m) => ({
        role: m.role === "ai" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      { role: "user", parts: [{ text: spontaneous ? spontaneousPrompt : message }] },
    ];

    const result = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: contents as never,
      config: {
        systemInstruction,
        maxOutputTokens: 400,
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
