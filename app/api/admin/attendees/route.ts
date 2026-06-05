import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // Resolve email from trusted usuarios table — do not trust client claim
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (!usuario || !isAdminEmail(usuario.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: attendees, error } = await supabase
    .from("usuarios")
    .select(`
      id,
      nombre,
      email,
      institucion,
      reservaciones (
        id,
        bloque,
        asistio,
        sesiones (
          titulo,
          hora_inicio,
          hora_fin
        )
      )
    `)
    .order("nombre");

  if (error) {
    console.error("[admin/attendees] fetch error:", error.code);
    return NextResponse.json({ error: "Failed to fetch attendees" }, { status: 500 });
  }

  return NextResponse.json({ attendees: attendees ?? [] });
}
