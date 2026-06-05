'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Registro() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [nombre, setNombre] = useState('')
  const [institucion, setInstitucion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegistro = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: contrasena,
        options: {
          // Metadata is read by the DB trigger trg_on_auth_user_created
          // as a fallback if the manual insert below fails
          data: { nombre, institucion },
        },
      })

      if (authError) throw authError

      if (authData.user) {
        const { error: dbError } = await supabase
          .from('usuarios')
          .insert({
            id: authData.user.id,
            email,
            nombre,
            institucion,
          })

        if (dbError) throw dbError
      }

      alert('¡Registro exitoso! Por favor inicia sesión.')
      router.push('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Registro
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleRegistro} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu nombre completo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institución/Universidad
            </label>
            <input
              type="text"
              value={institucion}
              onChange={(e) => setInstitucion(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu universidad"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-500 hover:underline font-bold">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  )
}