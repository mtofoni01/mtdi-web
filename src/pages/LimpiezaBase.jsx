// pages/LimpiezaBase.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const TABLAS = [
  { id: 'operaciones',       label: 'Operaciones', ayuda: 'compras, ventas, cobros (cupones/amortizaciones)' },
  { id: 'posiciones',        label: 'Posiciones', ayuda: 'tenencias actuales' },
  { id: 'depositos_plazo',   label: 'Depósitos a plazo', ayuda: 'plazos fijos y cauciones' },
  { id: 'fci_movimientos',   label: 'FCI', ayuda: 'suscripciones y rescates de fondos' },
  { id: 'gastos_usuario',    label: 'Gastos', ayuda: 'gastos cargados' },
  { id: 'documentos',        label: 'Documentos', ayuda: 'comprobantes y su detalle' },
  { id: 'cartera_snapshots', label: 'Fotos (snapshots)', ayuda: 'fotos guardadas de la cartera' },
]

export default function LimpiezaBase() {
  const { authFetch, usuario } = useAuth()
  const [modo, setModo] = useState('datos')  // 'datos' | 'usuario'

  const [usuarios, setUsuarios] = useState([])
  const [seleccion, setSeleccion] = useState([])         // tablas tildadas
  const [usuarioObjetivo, setUsuarioObjetivo] = useState('todos')
  const [usuarioAEliminar, setUsuarioAEliminar] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    authFetch('/api/admin/usuarios')
      .then(r => r.json())
      .then(d => setUsuarios(d.data || d.usuarios || d || []))
      .catch(() => {})
  }, [authFetch])

  const toggleTabla = (id) => setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const limpiarDatos = async () => {
    setProcesando(true); setMensaje(null)
    try {
      const res = await authFetch('/api/cartera/admin/limpiar', {
        method: 'POST',
        body: JSON.stringify({ tablas: seleccion, usuario_id: usuarioObjetivo, confirmacion }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error)
      const total = Object.values(d.resumen).reduce((a, b) => a + b, 0)
      const detalle = Object.entries(d.resumen).map(([t, n]) => `${t}: ${n}`).join(' · ')
      setMensaje({ tipo: 'ok', texto: `Limpieza hecha. ${total} filas borradas (${detalle}).` })
      setConfirmacion(''); setSeleccion([])
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setProcesando(false)
    }
  }

  const eliminarUsuario = async () => {
    setProcesando(true); setMensaje(null)
    try {
      const res = await authFetch(`/api/cartera/admin/usuario-completo/${usuarioAEliminar}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmacion }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error)
      setMensaje({ tipo: 'ok', texto: 'Usuario y todos sus datos eliminados.' })
      setConfirmacion(''); setUsuarioAEliminar('')
      setUsuarios(prev => prev.filter(u => String(u.id) !== String(usuarioAEliminar)))
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setProcesando(false)
    }
  }

  const nombreUsuario = (u) => u.nombre || u.email || `#${u.id}`

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🧹 Limpieza de base</h1>
        <p className="text-sm text-gray-400 mt-1">Puesta a cero de datos cargados. Operación destructiva y auditada.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
        ⚠️ Lo que borres acá no se puede deshacer. Las especies, custodios, comisiones, cartera objetivo, CER, flujos manuales, precios y el log de auditoría <strong>no se tocan</strong>.
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Selector de modo */}
      <div className="flex gap-2">
        <button onClick={() => { setModo('datos'); setConfirmacion(''); setMensaje(null) }}
          className={`px-4 py-2 text-sm rounded-lg border ${modo === 'datos' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-semibold' : 'text-gray-500 border-gray-200'}`}>
          Limpiar datos
        </button>
        <button onClick={() => { setModo('usuario'); setConfirmacion(''); setMensaje(null) }}
          className={`px-4 py-2 text-sm rounded-lg border ${modo === 'usuario' ? 'bg-red-50 text-red-600 border-red-200 font-semibold' : 'text-gray-500 border-gray-200'}`}>
          Eliminar usuario
        </button>
      </div>

      {modo === 'datos' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Qué borrar</label>
            <div className="space-y-2">
              {TABLAS.map(t => (
                <label key={t.id} className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={seleccion.includes(t.id)} onChange={() => toggleTabla(t.id)} className="mt-1" />
                  <span className="text-sm text-gray-700">{t.label} <span className="text-xs text-gray-400">— {t.ayuda}</span></span>
                </label>
              ))}
            </div>
            <button onClick={() => setSeleccion(seleccion.length === TABLAS.length ? [] : TABLAS.map(t => t.id))}
              className="text-xs text-indigo-600 underline mt-2">
              {seleccion.length === TABLAS.length ? 'destildar todo' : 'tildar todo'}
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Para quién</label>
            <select value={usuarioObjetivo} onChange={e => setUsuarioObjetivo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="todos">TODOS los usuarios</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{nombreUsuario(u)}</option>)}
            </select>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="text-xs text-gray-500 block mb-1">Para confirmar, escribí <strong>LIMPIAR</strong></label>
            <div className="flex items-center gap-3">
              <input type="text" value={confirmacion} onChange={e => setConfirmacion(e.target.value)}
                placeholder="LIMPIAR" className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              <button onClick={limpiarDatos} disabled={procesando || confirmacion !== 'LIMPIAR' || seleccion.length === 0}
                className="px-5 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#e74c3c' }}>
                {procesando ? 'Limpiando...' : 'Limpiar datos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modo === 'usuario' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            Esto borra al usuario <strong>y todos sus datos</strong> (operaciones, cobros, gastos, documentos, posiciones, depósitos, fci, fotos). Desaparece de todos los selectores. No se puede deshacer.
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Usuario a eliminar</label>
            <select value={usuarioAEliminar} onChange={e => setUsuarioAEliminar(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400">
              <option value="">Elegí un usuario...</option>
              {usuarios.filter(u => String(u.id) !== String(usuario?.id)).map(u => (
                <option key={u.id} value={u.id}>{nombreUsuario(u)}{u.rol === 'admin' ? ' (admin)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <label className="text-xs text-gray-500 block mb-1">Para confirmar, escribí <strong>ELIMINAR</strong></label>
            <div className="flex items-center gap-3">
              <input type="text" value={confirmacion} onChange={e => setConfirmacion(e.target.value)}
                placeholder="ELIMINAR" className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              <button onClick={eliminarUsuario} disabled={procesando || confirmacion !== 'ELIMINAR' || !usuarioAEliminar}
                className="px-5 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#c0392b' }}>
                {procesando ? 'Eliminando...' : 'Eliminar usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
