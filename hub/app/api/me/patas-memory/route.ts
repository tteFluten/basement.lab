import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, hasDb } from "@/lib/db";
import { getGemini, hasGemini } from "@/lib/gemini";

export const runtime = "nodejs";

/** GET — return the current user's patas_memory */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDb()) return NextResponse.json({ memory: null });

  const db = getDb();
  const { data } = await db.from("users").select("patas_memory").eq("id", session.user.id).single();
  return NextResponse.json({ memory: (data as { patas_memory?: string } | null)?.patas_memory ?? null });
}

/** POST — generate a new summary from recent messages and save it */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDb() || !hasGemini()) return NextResponse.json({ memory: null });

  const { messages, currentMemory, userName } = await req.json() as {
    messages: { role: "user" | "ai"; text: string }[];
    currentMemory: string | null;
    userName: string | null;
  };

  const conversationText = messages
    .slice(-60)
    .map(m => `${m.role === "user" ? (userName ?? "Usuario") : "Patas"}: ${m.text}`)
    .join("\n");

  const prompt = currentMemory
    ? `Tenés este resumen previo de conversaciones con ${userName ?? "el usuario"}:\n\n${currentMemory}\n\n---\nAhora incorporá esta conversación reciente y generá un resumen actualizado:\n\n${conversationText}`
    : `Generá un resumen de esta conversación entre Patas y ${userName ?? "el usuario"}:\n\n${conversationText}`;

  const systemInstruction = `Sos Patas. Generá un resumen conciso (máximo 250 palabras) de lo que sabés sobre este usuario basándote en sus conversaciones. Incluí:
- Su rol y contexto en Basement
- Temas que ha consultado o le interesan
- Su forma de trabajar y preferencias
- Cualquier dato personal o profesional relevante que haya mencionado
- Preguntas recurrentes o áreas donde necesitó ayuda

Escribí en primera persona como si fuera tu memoria interna ("El usuario es...", "Ha preguntado sobre...", "Prefiere..."). Sin listas ni formato markdown, solo texto fluido y conciso.`;

  try {
    const ai = getGemini();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { systemInstruction, maxOutputTokens: 350, temperature: 0.4 },
    });
    const memory = (result as unknown as { text?: string }).text?.trim() ?? null;

    if (memory) {
      const db = getDb();
      await db.from("users").update({ patas_memory: memory }).eq("id", session.user.id);
    }

    return NextResponse.json({ memory });
  } catch (e) {
    console.error("POST /api/me/patas-memory:", e);
    return NextResponse.json({ memory: null });
  }
}
