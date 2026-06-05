import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CreateBookingSchema, CancelBookingSchema, GENERIC_VALIDATION_ERROR } from "@/lib/validations";
import { applyRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reservaciones")
    .select("id, sesion_id, bloque")
    .eq("usuario_id", userId);

  if (error) {
    console.error("[bookings] fetch error:", error.code);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }

  return NextResponse.json({ bookings: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 400 });
  }

  const parsed = CancelBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 422 });
  }

  const { attendeeId, reservationId } = parsed.data;

  const supabase = getSupabaseServerClient();

  // Verify reservation belongs to this user before deleting
  const { data: reservation } = await supabase
    .from("reservaciones")
    .select("id")
    .eq("id", reservationId)
    .eq("usuario_id", attendeeId)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "Reservación no encontrada" }, { status: 404 });
  }

  const { error } = await supabase
    .from("reservaciones")
    .delete()
    .eq("id", reservationId)
    .eq("usuario_id", attendeeId);

  if (error) {
    console.error("[bookings] delete error:", error.code);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 400 });
  }

  const parsed = CreateBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 422 });
  }

  const { attendeeId: usuarioId, sessionId: sesionId, blockNum: bloque } = parsed.data;

  const limited = await applyRateLimit(req, "booking", usuarioId);
  if (limited) return limited;

  const supabase = getSupabaseServerClient();

  // Verify user exists and get denormalized name/email for the reservation record
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nombre, email")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!usuario) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cross-check: the session must belong to the stated bloque (prevents block spoofing)
  const { data: sesion } = await supabase
    .from("sesiones")
    .select("id, bloque")
    .eq("id", sesionId)
    .eq("bloque", bloque)
    .maybeSingle();

  if (!sesion) {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 422 });
  }

  // Defensive check — DB unique constraint also catches this race condition
  const { data: conflict } = await supabase
    .from("reservaciones")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("bloque", bloque)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json(
      { error: "Ya tenés una reservación en este bloque horario" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("reservaciones")
    .insert({
      usuario_id:     usuarioId,
      sesion_id:      sesionId,
      bloque,
      nombre_usuario: usuario.nombre,
      email_usuario:  usuario.email,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "P0001") {
      return NextResponse.json({ error: "Sesión sin lugares disponibles" }, { status: 409 });
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya tenés una reservación en este bloque horario" },
        { status: 409 }
      );
    }
    console.error("[bookings] insert error:", error.code);
    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  }

  return NextResponse.json({ reservacionId: data.id }, { status: 201 });
}
