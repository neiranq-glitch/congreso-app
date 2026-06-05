// Regenerate when schema changes:
// npx supabase gen types typescript --project-id bezjipedtrbjefaxrnhe > lib/supabase/types.ts

// ── Row types ─────────────────────────────────────────────────────────────────

export type SesionRow = {
  id: string;
  titulo: string;
  ponente: string;
  descripcion: string | null;
  hora_inicio: string;
  hora_fin: string;
  lugar: string;
  bloque: number;         // integer — agrupa sesiones paralelas
  capacidad: number;
  created_at: string;
};

export type UsuarioRow = {
  id: string;
  nombre: string;
  email: string;
  institucion: string | null;
  created_at: string;
};

export type ReservacionRow = {
  id: string;
  usuario_id: string;
  sesion_id: string;
  bloque: number;         // desnormalizado de sesion.bloque para el unique constraint
  nombre_usuario: string;
  email_usuario: string;
  asistio: boolean;
  asistio_at: string | null;
  created_at: string;
};

export type SesionConCapacidadRow = SesionRow & {
  reservaciones_count: number;
  lugares_disponibles: number;
  llena: boolean;
};

// ── Database type (used by createClient<Database>) ────────────────────────────
// Requires Relationships and Functions to satisfy GenericSchema/GenericTable
// constraints in @supabase/postgrest-js

export type Database = {
  public: {
    Tables: {
      sesiones: {
        Row: SesionRow;
        Insert: Omit<SesionRow, "id" | "created_at">;
        Update: Partial<Omit<SesionRow, "id" | "created_at">>;
        Relationships: [];
      };
      usuarios: {
        Row: UsuarioRow;
        Insert: Omit<UsuarioRow, "created_at">;
        Update: Partial<Omit<UsuarioRow, "id" | "created_at">>;
        Relationships: [];
      };
      reservaciones: {
        Row: ReservacionRow;
        Insert: Omit<ReservacionRow, "id" | "created_at" | "asistio" | "asistio_at">;
        Update: Partial<Pick<ReservacionRow, "asistio" | "asistio_at">>;
        Relationships: [
          {
            foreignKeyName: "reservaciones_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservaciones_sesion_id_fkey";
            columns: ["sesion_id"];
            isOneToOne: false;
            referencedRelation: "sesiones";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      sesiones_con_capacidad: {
        Row: SesionConCapacidadRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
