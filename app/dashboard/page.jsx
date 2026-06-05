'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Congreso App</h1>
        <button
          onClick={handleLogout}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition"
        >
          Cerrar sesión
        </button>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ¡Bienvenido! 👋
          </h2>
          <p className="text-gray-600">
            Sesión iniciada como: <strong>{user?.email}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            onClick={() => router.push('/agenda')}
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition border-l-4 border-blue-500"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">📅 Ver Agenda</h3>
            <p className="text-gray-600">Explora las sesiones disponibles y reserva tu lugar</p>
          </div>

          <div
            onClick={() => router.push('/mi-horario')}
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition border-l-4 border-purple-500"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">🗓️ Mi Horario</h3>
            <p className="text-gray-600">Mira tus sesiones reservadas y sus códigos QR</p>
          </div>
        </div>
      </div>
    </div>
  )
}