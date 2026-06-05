'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import jsQR from 'jsqr'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

// ── Stats card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green:  'bg-green-50 border-green-200 text-green-700',
  }
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [asistentes, setAsistentes] = useState([])
  const [bloques, setBloques]       = useState([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')

  // Scanner state
  const [camActiva, setCamActiva]   = useState(false)
  const [scanMsg, setScanMsg]       = useState('')
  const [ultimoScan, setUltimoScan] = useState(null)   // {nombre, ok}

  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const streamRef     = useRef(null)
  const rafRef        = useRef(null)
  const procesandoRef = useRef(false)

  // ── Auth + admin guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // ── Fetch attendees ──────────────────────────────────────────────────────────
  const fetchAsistentes = useCallback(async () => {
    if (!user) return
    const res = await fetch(`/api/admin/attendees?userId=${user.id}`)
    if (!res.ok) return
    const { attendees } = await res.json()
    setAsistentes(attendees ?? [])
    const set = new Set()
    attendees?.forEach(a => a.reservaciones?.forEach(r => set.add(r.bloque)))
    setBloques([...set].sort((a, b) => a - b))
  }, [user])

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) return
    fetchAsistentes().finally(() => setCargando(false))
  }, [user, fetchAsistentes])

  // ── QR scan loop ─────────────────────────────────────────────────────────────
  const scanLoop = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    if (video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })
      if (code && !procesandoRef.current) {
        procesandoRef.current = true
        procesarQR(code.data)
        return   // pause loop while processing
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const procesarQR = async (bookingId) => {
    setScanMsg('Procesando...')
    try {
      const res  = await fetch('/api/admin/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bookingId, userId: user.id }),
      })
      const data = await res.json()

      if (res.ok) {
        setScanMsg(`✓ Asistencia marcada: ${data.nombre}`)
        setUltimoScan({ nombre: data.nombre, ok: true })
        fetchAsistentes()                           // refresh table silently
      } else if (res.status === 409) {
        setScanMsg(`⚠ Ya registrado: ${data.nombre ?? data.error}`)
        setUltimoScan({ nombre: data.nombre ?? '', ok: false })
      } else {
        setScanMsg(`✗ ${data.error}`)
        setUltimoScan({ nombre: '', ok: false })
      }
    } catch {
      setScanMsg('✗ Error de red')
    }

    setTimeout(() => {
      procesandoRef.current = false
      setScanMsg('Apunta la cámara al código QR del asistente')
      rafRef.current = requestAnimationFrame(scanLoop)
    }, 2500)
  }

  const abrirCamara = async () => {
    setScanMsg('')
    setUltimoScan(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current     = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCamActiva(true)
      setScanMsg('Apunta la cámara al código QR del asistente')
      rafRef.current = requestAnimationFrame(scanLoop)
    } catch (err) {
      setScanMsg('No se pudo acceder a la cámara: ' + err.message)
    }
  }

  const cerrarCamara = () => {
    if (rafRef.current)   cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCamActiva(false)
    setScanMsg('')
  }

  useEffect(() => () => cerrarCamara(), [])  // cleanup on unmount

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalReservaciones = asistentes.reduce(
    (sum, a) => sum + (a.reservaciones?.length ?? 0), 0
  )
  const totalAsistencias = asistentes.reduce(
    (sum, a) => sum + (a.reservaciones?.filter(r => r.asistio).length ?? 0), 0
  )

  const asistentesVisibles = asistentes.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.email.toLowerCase().includes(busqueda.toLowerCase())
  )

  // ── Render guards ────────────────────────────────────────────────────────────
  if (loading || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-xl text-gray-600">Cargando panel admin...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Nav */}
      <nav className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Panel Admin</h1>
          <p className="text-xs text-gray-400">{user?.email}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition"
        >
          ← Dashboard
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Registrados"   value={asistentes.length}   color="blue"   />
          <StatCard label="Reservaciones" value={totalReservaciones}   color="purple" />
          <StatCard label="Asistencias"   value={totalAsistencias}     color="green"  />
        </div>

        {/* QR Scanner */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Escáner QR</h2>
            <button
              onClick={camActiva ? cerrarCamara : abrirCamara}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                camActiva
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {camActiva ? 'Cerrar cámara' : 'Abrir cámara'}
            </button>
          </div>

          {/* video+canvas are always mounted so videoRef is never null on first click */}
          <div className={`p-4 flex flex-col items-center gap-3 ${camActiva ? '' : 'hidden'}`}>
            <div className="relative w-full max-w-xs">
              <video
                ref={videoRef}
                className="w-full rounded-lg"
                muted
                playsInline
              />
              <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none opacity-60" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {!camActiva && (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Abre la cámara para escanear el QR de acceso de un asistente
            </div>
          )}

          {/* scanMsg lives outside the conditional so camera-error messages are visible */}
          {scanMsg && (
            <div className="px-4 pb-4 flex justify-center">
              <p className={`text-sm font-medium text-center px-4 py-2 rounded-lg w-full max-w-xs ${
                scanMsg.startsWith('✓') ? 'bg-green-50 text-green-700' :
                scanMsg.startsWith('⚠') ? 'bg-yellow-50 text-yellow-700' :
                scanMsg.startsWith('✗') ? 'bg-red-50 text-red-700'    :
                'bg-gray-50 text-gray-600'
              }`}>
                {scanMsg}
              </p>
            </div>
          )}
        </div>

        {/* Attendees table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-800">
              Asistentes
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({asistentesVisibles.length} de {asistentes.length})
              </span>
            </h2>
            <input
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar nombre o email..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {asistentesVisibles.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay asistentes registrados aún.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Institución</th>
                    {bloques.map(b => (
                      <th key={b} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Bloque {b}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asistentesVisibles.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {a.nombre}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.email}</td>
                      <td className="px-4 py-3 text-gray-500">{a.institucion ?? '—'}</td>
                      {bloques.map(b => {
                        const r = a.reservaciones?.find(r => r.bloque === b)
                        return (
                          <td key={b} className="px-4 py-3">
                            {r ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-gray-700 text-xs leading-tight line-clamp-2">
                                  {r.sesiones?.titulo ?? '—'}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-xs font-medium mt-0.5 ${
                                  r.asistio ? 'text-green-600' : 'text-amber-600'
                                }`}>
                                  {r.asistio ? '✓ Asistió' : '○ Pendiente'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
