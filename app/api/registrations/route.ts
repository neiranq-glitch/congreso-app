import { NextRequest, NextResponse } from "next/server";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  RegisterAttendeeSchema,
  GENERIC_VALIDATION_ERROR,
} from "@/lib/validations";
import { applyRateLimit } from "@/lib/rate-limit";

// Registration flow:
// 1. Validate form data
// 2. Call supabase.auth.signInWithOtp() with user metadata (nombre, institucion)
// 3. User receives magic link → clicks → authenticated
// 4. DB trigger (trg_on_auth_user_confirmed) creates the usuarios record automatically
// 5. Return success — the actual user ID is assigned after email confirmation

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, "registration");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 400 });
  }

  const parsed = RegisterAttendeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_VALIDATION_ERROR, { status: 422 });
  }

  const { name: nombre, email, institution: institucion } = parsed.data;

  // Use anon key client — signInWithOtp does not require service role
  // The magic link includes user metadata that the DB trigger reads on confirmation
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: { nombre, institucion },
      // Redirect to the schedule page after email confirmation
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/mi-horario`,
    },
  });

  if (error) {
    console.error("[registrations] signInWithOtp error:", error.message);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }

  // Always return 200 — do not reveal whether the email exists (prevents enumeration)
  return NextResponse.json(
    { message: "Check your email for the confirmation link" },
    { status: 200 }
  );
}
