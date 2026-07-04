// pages/Movimientos.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtFecha(f) {
  if (!f) return '-'
  const s = f.includes('T') ? f.split('T')[0] : f
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}

// Etiquetas y colores por tipo de operación
const TIPO_OP = {
  compra:          { label: 'Compra',          color: '#2d7d46', signo: '−' },
  venta:           { label: 'Venta',           color: '#c5183c', signo: '+' },
  cupon:           { label: 'Cupón/Renta',     color: '#16a085', signo: '+' },
  amortizacion:    { label: 'Amortización',    color: '#16a085', signo: '+' },
  reinversion:     { label: 'Reinversión',     color: '#2d7d46', signo: '−' },
  suscripcion_fci: { label: 'Suscripción FCI', color: '#2d7d46', signo: '−' },
  rescate_fci:     { label: 'Rescate FCI',     color: '#c5183c', signo: '+' },
  vto_plazo_fijo:  { label: 'Vto. Plazo Fijo', color: '#16a085', signo: '+' },
  deposito_saldo:  { label: 'Depósito',        color: '#2d7d46', signo: '−' },
  extraccion_saldo:{ label: 'Extracción',      color: '#c5183c', signo: '+' },
  pase_moneda:     { label: 'Pase Moneda',     color: '#8e44ad', signo: '±' },
}

const TODOS_TIPOS = Object.keys(TIPO_OP)

export default function Movimientos() {
  const { authFetch, usuario } = useAuth()
  const [movimientos, setMovimientos] = useState([])
  const [usuarios, setUsuarios]       = useState([])
  const [cargando, setCargando]       = useState(true)

  // Filtros
  const [fTicker, setFTicker]     = useState('')
  const [fTipo, setFTipo]         = useState('')
  const [fMoneda, setFMoneda]     = useState('')
  const [fUsuario, setFUsuario]   = useState('todos')
  const [fDesde, setFDesde]       = useState('')
  const [fHasta, setFHasta]       = useState('')

  const esAdmin = usuario?.rol === 'admin'

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (esAdmin) {
        if (fUsuario === 'todos') params.set('todos', 'true')
        else params.set('usuario_id', fUsuario)
      }
      if (fTicker) params.set('ticker', fTicker.toUpperCase())
      if (fTipo)   params.set('tipo_op', fTipo)
      if (fMoneda) params.set('moneda', fMoneda)
      if (fDesde)  params.set('desde', fDesde)
      if (fHasta)  params.set('hasta', fHasta)

      const res  = await authFetch(`/api/cartera/operaciones?${params}`)
      const data = await res.json()
      setMovimientos(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, esAdmin, fUsuario, fTicker, fTipo, fMoneda, fDesde, fHasta])

  useEffect(() => { cargar() }, [cargar])

  // Cargar lista de usuarios (admin)
  useEffect(() => {
    if (!esAdmin) return
    authFetch('/api/admin/usuarios')
      .then(r => r.json())
      .then(d => setUsuarios(d.usuarios || []))
      .catch(() => {})
  }, [authFetch, esAdmin])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este movimiento? Esto NO revierte el efecto en la posición.')) return
    try {
      await authFetch(`/api/cartera/operaciones/${id}`, { method: 'DELETE' })
      cargar()
    } catch {}
  }

  const limpiarFiltros = () => {
    setFTicker(''); setFTipo(''); setFMoneda(''); setFUsuario('todos'); setFDesde(''); setFHasta('')
  }

  const hayFiltros = fTicker || fTipo || fMoneda || fDesde || fHasta || fUsuario !== 'todos'

  // Totales del período filtrado
  const totales = movimientos.reduce((acc, m) => {
    const t = TIPO_OP[m.tipo_op]
    const imp = parseFloat(m.importe || 0)
    const key = m.moneda || 'ARS'
    if (!acc[key]) acc[key] = { ingresos: 0, egresos: 0 }
    if (t?.signo === '+') acc[key].ingresos += imp
    else if (t?.signo === '−') acc[key].egresos += imp
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🔄 Movimientos</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻ Actualizar</button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ticker</label>
            <input
              type="text"
              value={fTicker}
              onChange={e => setFTicker(e.target.value.toUpperCase())}
              placeholder="Todos"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
            <select value={fTipo} onChange={e => setFTipo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Todos</option>
              {TODOS_TIPOS.map(t => <option key={t} value={t}>{TIPO_OP[t].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Moneda</label>
            <select value={fMoneda} onChange={e => setFMoneda(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Todas</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {esAdmin && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Usuario</label>
              <select value={fUsuario} onChange={e => setFUsuario(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="todos">Todos</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Desde</label>
            <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hasta</label>
            <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          {hayFiltros && (
            <button onClick={limpiarFiltros}
              className="px-3 py-2 text-sm text-red-400 border border-red-200 rounded-lg hover:bg-red-50">
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Totales */}
      {Object.keys(totales).length > 0 && (
        <div className="flex gap-4">
          {Object.entries(totales).map(([moneda, t]) => (
            <div key={moneda} className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex gap-6">
              <div>
                <p className="text-xs text-gray-400">Ingresos {moneda}</p>
                <p className="text-lg font-bold text-green-600">+{fmt(t.ingresos)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Egresos {moneda}</p>
                <p className="text-lg font-bold text-red-500">−{fmt(t.egresos)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Neto {moneda}</p>
                <p className="text-lg font-bold text-gray-800">{fmt(t.ingresos - t.egresos)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : movimientos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay movimientos {hayFiltros ? 'con estos filtros' : 'cargados'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Fecha', 'Tipo', 'Ticker', 'VN/Cant', 'Precio', 'Importe', 'Comisión', 'Resultado', 'Custodio', esAdmin ? 'Usuario' : null, esAdmin ? '' : null]
                    .filter(Boolean)
                    .map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movimientos.map((m) => {
                  const t = TIPO_OP[m.tipo_op] || { label: m.tipo_op, color: '#555', signo: '' }
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full text-white whitespace-nowrap"
                          style={{ backgroundColor: t.color }}>
                          {t.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-gray-700">{m.ticker}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{m.vn_cantidad ? fmt(m.vn_cantidad, 0) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{m.precio ? fmt(m.precio, 4) : '-'}</td>
                      <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                        <span style={{ color: t.signo === '+' ? '#16a085' : t.signo === '−' ? '#c5183c' : '#8e44ad' }}>
                          {t.signo} {m.moneda} {fmt(m.importe)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {m.comision_importe ? `${m.moneda} ${fmt(m.comision_importe)}` : (m.comision_bonificada ? 'Bonif.' : '-')}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {m.resultado_importe !== null && m.resultado_importe !== undefined ? (
                          <span style={{ color: parseFloat(m.resultado_importe) >= 0 ? '#16a085' : '#c5183c' }} className="font-semibold">
                            {parseFloat(m.resultado_importe) >= 0 ? '▲' : '▼'} {fmt(m.resultado_importe)}
                            {m.resultado_pct !== null && <span className="text-xs ml-1">({fmt(m.resultado_pct)}%)</span>}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{m.custodio_nombre || '-'}</td>
                      {esAdmin && <td className="px-4 py-3 text-xs text-gray-500">{m.usuario_nombre || '-'}</td>}
                      {esAdmin && (
                        <td className="px-4 py-3">
                          <button onClick={() => eliminar(m.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {movimientos.length} movimiento(s)
          </div>
        </div>
      )}
    </div>
  )
}
