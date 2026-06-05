import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-6">
          <span className="bg-white/15 text-white text-sm font-medium px-4 py-1.5 rounded-full tracking-wide uppercase">
            Edición 2026
          </span>

          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight">
            Congreso de<br className="hidden sm:block" /> Tecnología 2026
          </h1>

          <p className="text-blue-100 text-xl max-w-xl leading-relaxed">
            El encuentro académico más importante del año. Tres días de ponencias,
            talleres y networking con líderes de la industria y la academia.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              12 – 14 de noviembre, 2026
            </div>
            <span className="hidden sm:block text-blue-300">·</span>
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Auditorio Central, Universidad Nacional
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Link
              href="/registro"
              className="bg-white text-blue-700 font-bold px-8 py-3 rounded-full hover:bg-blue-50 transition shadow-lg"
            >
              Registrarme ahora
            </Link>
            <Link
              href="/login"
              className="border-2 border-white/60 text-white font-semibold px-8 py-3 rounded-full hover:bg-white/10 transition"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* ── Highlights ────────────────────────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
            ¿Qué te espera?
          </h2>
          <p className="text-center text-gray-500 mb-12">
            Una experiencia académica completa en tres áreas clave
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sessions */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-7 flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl">
                🎤
              </div>
              <h3 className="text-xl font-bold text-gray-800">Sesiones</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Más de 20 ponencias especializadas en inteligencia artificial,
                desarrollo de software y transformación digital.
              </p>
            </div>

            {/* Speakers */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50 p-7 flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-white text-2xl">
                👥
              </div>
              <h3 className="text-xl font-bold text-gray-800">Ponentes</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Expertos nacionales e internacionales de empresas líderes y
                universidades de prestigio compartirán su experiencia.
              </p>
            </div>

            {/* Networking */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-7 flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-2xl">
                🤝
              </div>
              <h3 className="text-xl font-bold text-gray-800">Networking</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Espacios de convivencia diseñados para conectar estudiantes,
                académicos y profesionales del sector tecnológico.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center flex flex-col items-center gap-5">
          <h2 className="text-3xl font-extrabold text-white">
            Asegura tu lugar hoy
          </h2>
          <p className="text-blue-100 text-lg">
            El registro es gratuito para estudiantes y académicos de la universidad.
            Los cupos son limitados.
          </p>
          <Link
            href="/registro"
            className="bg-white text-blue-700 font-bold px-10 py-3 rounded-full hover:bg-blue-50 transition shadow-lg text-lg"
          >
            Registrarme gratis
          </Link>
          <p className="text-blue-200 text-sm">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-white underline underline-offset-2 hover:text-blue-100">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="font-medium text-gray-300">Universidad Nacional</p>
          <p>© 2026 Congreso de Tecnología. Todos los derechos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
