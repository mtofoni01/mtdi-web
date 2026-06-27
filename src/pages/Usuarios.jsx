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

  const eliminar = async (u) => {
    if (!confirm(`¿Desactivar a ${u.nombre}?`)) return
    try { await authFetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' }); cargar() } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">👥 Usuarios</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
      </div>

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
