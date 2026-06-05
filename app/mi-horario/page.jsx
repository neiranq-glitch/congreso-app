'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'

export default function MiHorario() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [reservaciones, setReservaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalItem, setModalItem] = useState(null)   // reservacion con sesion anidada
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }
    if (!user) return

    let cancelled = false

    const fetchData = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from('reservaciones')
        .select(`
          id,
          bloque,
          sesion_id,
          sesiones (
            titulo,
            ponente,
            descripcion,
            hora_inicio,
            hora_fin,
            lugar
          )
        `)
        .eq('usuario_id', user.id)
        .order('bloque')

      if (!cancelled) {
        setReservaciones(data || [])
        setCargando(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [user, loading, router])

  const handleOpenModal = async (item) => {
    setModalItem(item)
    setQrDataUrl('')
    try {
      const url = await QRCode.toDataURL(item.id, { margin: 2, width: 220 })
      setQrDataUrl(url)
    } catch (err) {
      console.error('QR generation error:', err)
    }
  }

  const handleCloseModal = () => {
    setModalItem(null)
    setQrDataUrl('')
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Cargando horario...</p>
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

      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Mi Horario</h2>
        <p className="text-gray-600 mb-8">Tus sesiones reservadas — toca una tarjeta para ver el QR de acceso</p>

        {reservaciones.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No tienes sesiones reservadas aún.</p>
            <button
              onClick={() => router.push('/agenda')}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition"
            >
              Ver Agenda
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reservaciones.map(item => {
              const s = item.sesiones
              return (
                <button
                  key={item.id}
                  onClick={() => handleOpenModal(item)}
                  className="bg-white rounded-lg shadow p-5 border-2 border-green-400 text-left hover:shadow-md hover:border-green-500 transition w-full"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          Bloque {item.bloque}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {s?.hora_inicio} – {s?.hora_fin}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-lg leading-snug mb-1">
                        {s?.titulo}
                      </h3>
                      <p className="text-sm text-blue-600 mb-1">👤 {s?.ponente}</p>
                      <p className="text-sm text-gray-500">📍 {s?.lugar}</p>
                    </div>
                    <div className="flex-shrink-0 text-green-500 text-2xl">▶</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalItem && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header verde */}
            <div className="bg-green-500 text-white px-6 py-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium opacity-90">Bloque {modalItem.bloque}</span>
                <button
                  onClick={handleCloseModal}
                  className="text-white/80 hover:text-white text-2xl leading-none"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <h3 className="text-xl font-bold leading-snug">{modalItem.sesiones?.titulo}</h3>
            </div>

            <div className="px-6 py-4 space-y-2">
              <p className="text-gray-700">
                <span className="font-medium">Ponente:</span>{' '}
                {modalItem.sesiones?.ponente}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Hora:</span>{' '}
                {modalItem.sesiones?.hora_inicio} – {modalItem.sesiones?.hora_fin}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Lugar:</span>{' '}
                {modalItem.sesiones?.lugar}
              </p>
              {modalItem.sesiones?.descripcion && (
                <p className="text-gray-600 text-sm pt-1">{modalItem.sesiones.descripcion}</p>
              )}
            </div>

            {/* QR */}
            <div className="px-6 pb-6 flex flex-col items-center">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">
                Código QR de acceso
              </p>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Código QR de la reservación"
                  className="rounded-lg border border-gray-200"
                  width={220}
                  height={220}
                />
              ) : (
                <div className="w-[220px] h-[220px] bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400 text-sm">Generando QR...</p>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 text-center">
                Presenta este código al ingresar a la sesión
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
