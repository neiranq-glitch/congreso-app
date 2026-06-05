import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ScanQRSchema, GENERIC_VALIDATION_ERROR } from "@/lib/validations";
import { applyRateLimit } from "@/lib/rate-limit";

// Staff endpoint: recibe el bookingId del QR y marca asistencia
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 400 });
  }

  const parsed = ScanQRSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 422 });
  }

  const { bookingId: reservacionId, staffToken } = parsed.data;

  const limited = await applyRateLimit(req, "qrScan", staffToken);
  if (limited) return limited;

  const validToken = process.env.STAFF_SCAN_TOKEN;
  if (!validToken || staffToken !== validToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();

  const { data: reservacion } = await supabase
    .from("reservaciones")
    .select("id, asistio, nombre_usuario, sesion_id")
    .eq("id", reservacionId)
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
    .eq("id", reservacionId);

  if (error) {
    console.error("[scan] update error:", error.code);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, nombre: reservacion.nombre_usuario },
    { status: 200 }
  );
}
