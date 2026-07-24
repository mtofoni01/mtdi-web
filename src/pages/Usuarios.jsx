import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 0) { return parseFloat(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec }) }

export default function Usuarios() {
  const { authFetch } = useAuth()
  const [usuarios, setUsuarios]   = useState([])
  const [cargando, setCargando]   = useState(true)
  const [editando, setEditando]   = useState(null)
  const [presARS, setPresARS]     = useState('')
  const [presUSD, setPresUSD]     = useState('')
  const [saldos, setSaldos]       = useState({})
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [formAlta, setFormAlta]   = useState({ nombre: '', email: '', password: '', rol: 'usuario' })
  const [msgAlta, setMsgAlta]     = useState(null)
  const [creando, setCreando]     = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res  = await authFetch('/api/admin/usuarios')
      const data = await res.json()
      setUsuarios(data.usuarios || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  const verSaldo = async (u) => {
    try {
      const res  = await authFetch(`/api/saldo?usuario_id=${u.id}`)
      const data = await res.json()
      setSaldos(prev => ({ ...prev, [u.id]: data.data }))
    } catch {}
  }

  const guardarPresupuesto = async (u) => {
    try {
      await authFetch(`/api/admin/usuarios/${u.id}/presupuesto`, {
        method: 'PUT',
        body: JSON.stringify({ presupuesto_ars: presARS ? parseFloat(presARS) : null, presupuesto_usd: presUSD ? parseFloat(presUSD) : null }),
      })
      setEditando(null); cargar()
    } catch {}
  }

  const crearUsuario = async () => {
    setMsgAlta(null)
    if (!formAlta.nombre || !formAlta.email || !formAlta.password) {
      return setMsgAlta({ tipo: 'error', texto: 'Nombre, email y contraseña son obligatorios.' })
    }
    if (formAlta.password.length < 8) {
      return setMsgAlta({ tipo: 'error', texto: 'La contraseña debe tener al menos 8 caracteres.' })
    }
    setCreando(true)
    try {
      const res = await authFetch('/api/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify(formAlta),
      })
      const d = await res.json()
      if (!res.ok || d.error) throw new Error(d.error || 'Error al crear el usuario')
      setMsgAlta({ tipo: 'ok', texto: `Usuario ${formAlta.email} creado.` })
      setFormAlta({ nombre: '', email: '', password: '', rol: 'usuario' })
      setMostrarAlta(false)
      cargar()
    } catch (e) {
      setMsgAlta({ tipo: 'error', texto: e.message })
    } finally {
      setCreando(false)
    }
  }

  const eliminar = async (u) => {
    if (!confirm(`¿Desactivar a ${u.nombre}?`)) return
    try { await authFetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' }); cargar() } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">👥 Usuarios</h1>
        <div className="flex gap-2">
          <button onClick={() => { setMostrarAlta(v => !v); setMsgAlta(null) }}
            className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#2d7d46' }}>
            {mostrarAlta ? '✕ Cerrar' : '+ Nuevo usuario'}
          </button>
          <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
        </div>
      </div>

      {msgAlta && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${msgAlta.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {msgAlta.tipo === 'ok' ? '✓ ' : '⚠️ '}{msgAlta.texto}
        </div>
      )}

      {mostrarAlta && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Nuevo usuario</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nombre</label>
              <input type="text" value={formAlta.nombre} onChange={e => setFormAlta({ ...formAlta, nombre: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Email</label>
              <input type="email" value={formAlta.email} onChange={e => setFormAlta({ ...formAlta, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Contraseña <span className="text-gray-400">(mín. 8)</span></label>
              <input type="password" value={formAlta.password} onChange={e => setFormAlta({ ...formAlta, password: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rol</label>
              <select value={formAlta.rol} onChange={e => setFormAlta({ ...formAlta, rol: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={crearUsuario} disabled={creando}
              className="px-5 py-2 text-sm text-white rounded-lg font-semibold disabled:opacity-60" style={{ backgroundColor: '#2d7d46' }}>
              {creando ? 'Creando...' : 'Crear usuario'}
            </button>
            <button onClick={() => { setMostrarAlta(false); setMsgAlta(null) }}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : (
        <div className="space-y-4">
          {usuarios.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{u.nombre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.rol === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-600'}`}>{u.rol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.activo ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <p className="text-sm text-gray-400">{u.email}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    {u.presupuesto_ars && <span>💵 ARS {fmt(u.presupuesto_ars)}</span>}
                    {u.presupuesto_usd && <span>💵 USD {fmt(u.presupuesto_usd, 2)}</span>}
                    {!u.presupuesto_ars && !u.presupuesto_usd && <span className="text-red-400">Sin presupuesto</span>}
                  </div>
                  {saldos[u.id] && (
                    <div className="flex gap-4 mt-1 text-xs">
                      <span className={saldos[u.id].saldo_disponible_ars >= 0 ? 'text-green-500' : 'text-red-500'}>
                        Disp. ARS: {fmt(saldos[u.id].saldo_disponible_ars)}
                      </span>
                      <span className={saldos[u.id].saldo_disponible_usd >= 0 ? 'text-green-500' : 'text-red-500'}>
                        Disp. USD: {fmt(saldos[u.id].saldo_disponible_usd, 2)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button onClick={() => verSaldo(u)}
                    className="px-3 py-1 text-xs border border-indigo-200 text-indigo-500 rounded-lg hover:bg-indigo-50">
                    📊 Ver saldo
                  </button>
                  <button onClick={() => { setEditando(u); setPresARS(u.presupuesto_ars || ''); setPresUSD(u.presupuesto_usd || '') }}
                    className="px-3 py-1 text-xs border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50">
                    💰 Presupuesto
                  </button>
                  <button onClick={() => eliminar(u)}
                    className="px-3 py-1 text-xs border border-red-200 text-red-400 rounded-lg hover:bg-red-50">
                    🗑️ Eliminar
                  </button>
                </div>
              </div>

              {editando?.id === u.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Presupuesto ARS</label>
                    <input type="number" value={presARS} onChange={e => setPresARS(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Presupuesto USD</label>
                    <input type="number" value={presUSD} onChange={e => setPresUSD(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <button onClick={() => guardarPresupuesto(u)}
                    className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
                    Guardar
                  </button>
                  <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
