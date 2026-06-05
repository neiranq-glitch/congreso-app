import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

const ScanSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  userId:    z.string().uuid("Invalid user ID"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  }

  const { bookingId, userId } = parsed.data;
  const supabase = getSupabaseServerClient();

  // Verify the caller is an admin
  const { data: caller } = await supabase
    .from("usuarios")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (!caller || !isAdminEmail(caller.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: reservacion } = await supabase
    .from("reservaciones")
    .select("id, asistio, nombre_usuario")
    .eq("id", bookingId)
    .maybeSingle();

  if (!reservacion) {
    return NextResponse.json({ error: "Reservación no encontrada" }, { status: 404 });
  }

  if (reservacion.asistio) {
    return NextResponse.json(
      { error: "Este QR ya fue escaneado", nombre: reservacion.nombre_usuario },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("reservaciones")
    .update({ asistio: true, asistio_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) {
    console.error("[admin/scan] update error:", error.code);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, nombre: reservacion.nombre_usuario });
}
