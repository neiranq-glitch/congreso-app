import { z } from "zod";

export const RegisterAttendeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name required")
    .max(120)
    .regex(/^[\p{L}\p{M}'\-\s]+$/u, "Invalid characters in name"),
  email: z.string().trim().email("Invalid email").max(254).toLowerCase(),
  institution: z.string().trim().min(2, "Institution required").max(200),
});

export const CreateBookingSchema = z.object({
  attendeeId: z.string().uuid("Invalid attendee ID"),
  sessionId:  z.string().uuid("Invalid session ID"),
  // bloque is an integer, not a UUID — matches sesiones.bloque column
  blockNum:   z.number().int().positive("Invalid block number"),
});

export const CancelBookingSchema = z.object({
  attendeeId:    z.string().uuid("Invalid attendee ID"),
  reservationId: z.string().uuid("Invalid reservation ID"),
});

export const ScanQRSchema = z.object({
  bookingId:  z.string().uuid("Invalid booking ID"),
  staffToken: z
    .string()
    .min(32)
    .max(128)
    .regex(/^[A-Za-z0-9+/=\-_]+$/),
});

export const GENERIC_VALIDATION_ERROR = {
  error: "Invalid request data",
  code: "VALIDATION_ERROR",
} as const;

export type RegisterAttendeeInput = z.infer<typeof RegisterAttendeeSchema>;
export type CreateBookingInput    = z.infer<typeof CreateBookingSchema>;
export type CancelBookingInput    = z.infer<typeof CancelBookingSchema>;
export type ScanQRInput           = z.infer<typeof ScanQRSchema>;
