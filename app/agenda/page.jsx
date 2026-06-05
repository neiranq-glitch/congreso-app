'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

export default function Agenda() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sesiones, setSesiones]         = useState([])
  const [reservaciones, setReservaciones] = useState([])  // [{id, sesion_id, bloque}]
  const [cargando, setCargando]         = useState(true)
  const [reservando, setReservando]     = useState(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }
    if (!user) return

    let cancelled = false

    const fetchData = async () => {
      const supabase = getSupabaseBrowserClient()

      const { data: sesionesData } = await supabase
        .from('sesiones')
        .select('*')
        .order('bloque')

      const res = await fetch(`/api/bookings?userId=${user.id}`)
      const { bookings } = res.ok ? await res.json() : { bookings: [] }

      if (!cancelled) {
        setSesiones(sesionesData || [])
        setReservaciones(bookings || [])
        setCargando(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [user, loading, router])

  const estaReservada = (sesionId) => reservaciones.some(r => r.sesion_id === sesionId)
  const tieneReservacionEnBloque = (bloque) => reservaciones.some(r => r.bloque === bloque)
  const getReservacionId = (sesionId) => reservaciones.find(r => r.sesion_id === sesionId)?.id

  const handleReservar = async (sesion) => {
    if (tieneReservacionEnBloque(sesion.bloque)) {
      alert('Ya tienes una sesión reservada en este bloque horario')
      return
    }

    setReservando(sesion.id)

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendeeId: user.id,
          sessionId:  sesion.id,
          blockNum:   sesion.bloque,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al reservar')

      setReservaciones([...reservaciones, {
        id:       data.reservacionId,
        sesion_id: sesion.id,
        bloque:   sesion.bloque,
      }])
      alert(`¡Reservación exitosa!\n${sesion.titulo}`)
    } catch (err) {
      alert('Error al reservar: ' + err.message)
    } finally {
      setReservando(null)
    }
  }

  const handleCancelar = async (sesion) => {
    if (!confirm('¿Cancelar esta reservación?')) return

    const reservacionId = getReservacionId(sesion.id)
    if (!reservacionId) return

    try {
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendeeId:    user.id,
          reservationId: reservacionId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al cancelar')
      }

      setReservaciones(reservaciones.filter(r => r.sesion_id !== sesion.id))
    } catch (err) {
      alert('Error al cancelar: ' + err.message)
    }
  }

  const bloques = [...new Set(sesiones.map(s => s.bloque))].sort((a, b) => a - b)

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Cargando agenda...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Congreso App</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition"
        >
          ← Volver
        </button>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Agenda del Congreso</h2>
        <p className="text-gray-600 mb-8">Selecciona una sesión por bloque horario</p>

        {sesiones.length === 0 && (
          <p className="text-gray-500 text-center py-12">No hay sesiones disponibles.</p>
        )}

        {bloques.map(bloque => {
          const sesionesDelBloque = sesiones.filter(s => s.bloque === bloque)
          const primera = sesionesDelBloque[0]
          const bloqueReservado = tieneReservacionEnBloque(bloque)

          return (
            <div key={bloque} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-full font-bold">
                  Bloque {bloque}
                </div>
                {primera && (
                  <span className="text-gray-500 font-medium">
                    {primera.hora_inicio} – {primera.hora_fin}
                  </span>
                )}
                {bloqueReservado && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                    ✓ Reservado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sesionesDelBloque.map(sesion => {
                  const reservada = estaReservada(sesion.id)
                  const bloqueOcupado = bloqueReservado && !reservada

                  return (
                    <div
                      key={sesion.id}
                      className={`bg-white rounded-lg shadow p-5 border-2 transition ${
                        reservada
                          ? 'border-green-400 bg-green-50'
                          : bloqueOcupado
                          ? 'border-gray-200 opacity-60'
                          : 'border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      <h3 className="font-bold text-gray-800 mb-1">{sesion.titulo}</h3>
                      <p className="text-sm text-blue-600 mb-1">👤 {sesion.ponente}</p>
                      <p className="text-sm text-gray-500 mb-1">📍 {sesion.lugar}</p>
                      {sesion.descripcion && (
                        <p className="text-sm text-gray-400 mb-3">{sesion.descripcion}</p>
                      )}

                      <div className="mt-auto pt-2">
                        {reservada ? (
                          <button
                            onClick={() => handleCancelar(sesion)}
                            className="w-full bg-red-100 text-red-600 py-2 rounded-lg font-medium hover:bg-red-200 transition text-sm"
                          >
                            Cancelar reservación
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReservar(sesion)}
                            disabled={bloqueOcupado || reservando === sesion.id}
                            className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm"
                          >
                            {reservando === sesion.id ? 'Reservando...' : 'Reservar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
