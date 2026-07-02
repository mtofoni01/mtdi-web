import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import EspecieDetalle from '../components/EspecieDetalle'

function fmt(n, dec = 0) {
  return parseFloat(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec })
}

function abreviarVol(vol) {
  if (!vol) return '-'
  const n = parseFloat(vol)
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)} MM`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)} M`
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

const colorTipo = (tipo) => {
  const map = {
    bono_usd: '#1a6eb5', bono_ars: '#2d7d46', bono_cer: '#1a7a4a',
    bono_dv: '#0d6e8a', letra_ars: '#3a7d44', letra_usd: '#1a5f8a',
    on: '#2c5f8a', fci_mm: '#6c3fc5', fci_rf: '#5a32a8',
    fci_rv: '#7d1fa8', fci_mix: '#8a3fc5', accion: '#c5183c',
    cedear: '#a8142e', plazo_fijo_ars: '#b5700a', plazo_fijo_usd: '#8a5200',
  }
  return map[tipo] || '#555'
}

// ── Componente de informes ─────────────────────────────────────────
function Informes({ posiciones }) {
  const [custodioFiltro, setCustodioFiltro] = useState('Todos')

  // Lista de custodios únicos
  const custodios = ['Todos', ...new Set(
    posiciones.map(p => p.custodio_nombre).filter(Boolean)
  )]

  // Posiciones filtradas por custodio
  const items = custodioFiltro === 'Todos'
    ? posiciones
    : posiciones.filter(p => p.custodio_nombre === custodioFiltro)

  // ── Total por moneda ──────────────────────────────────────────────
  const totalARS = items.reduce((s, p) => s + parseFloat(p.valuacion_ars || 0), 0)
  const totalUSD = items.reduce((s, p) => s + parseFloat(p.valuacion_usd || 0), 0)

  // Agrupar por moneda de la especie
  const porMoneda = items.reduce((acc, p) => {
    const m = p.moneda || 'ARS'
    if (!acc[m]) acc[m] = { moneda: m, valuacion_ars: 0, valuacion_usd: 0, cantidad: 0 }
    acc[m].valuacion_ars += parseFloat(p.valuacion_ars || 0)
    acc[m].valuacion_usd += parseFloat(p.valuacion_usd || 0)
    acc[m].cantidad++
    return acc
  }, {})

  // ── Total por custodio (cuando filtro = Todos) ────────────────────
  const porCustodio = posiciones.reduce((acc, p) => {
    const c = p.custodio_nombre || 'Sin custodio'
    if (!acc[c]) acc[c] = { custodio: c, valuacion_ars: 0, valuacion_usd: 0, cantidad: 0 }
    acc[c].valuacion_ars += parseFloat(p.valuacion_ars || 0)
    acc[c].valuacion_usd += parseFloat(p.valuacion_usd || 0)
    acc[c].cantidad++
    return acc
  }, {})

  const totalARSTodos = posiciones.reduce((s, p) => s + parseFloat(p.valuacion_ars || 0), 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-700">📊 Informes de cartera</h2>

        {/* Selector de custodio */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Custodio</label>
          <select
            value={custodioFiltro}
            onChange={e => setCustodioFiltro(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          >
            {custodios.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* ── Por moneda ── */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Composición por moneda
            {custodioFiltro !== 'Todos' && <span className="text-indigo-400 ml-1">— {custodioFiltro}</span>}
          </p>
          <div className="space-y-2">
            {Object.values(porMoneda).map(m => {
              const pctARS = totalARS > 0 ? (m.valuacion_ars / totalARS * 100) : 0
              return (
                <div key={m.moneda}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-semibold">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-1 ${m.moneda === 'USD' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {m.moneda}
                      </span>
                      {m.cantidad} especie{m.cantidad !== 1 ? 's' : ''}
                    </span>
                    <span className="font-bold text-gray-700">{pctARS.toFixed(1)}%</span>
                  </div>
                  {/* Barra de progreso */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${pctARS}%`,
                        backgroundColor: m.moneda === 'USD' ? '#1a6eb5' : '#e67e22'
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>${fmt(m.valuacion_ars)}</span>
                    <span>USD {fmt(m.valuacion_usd, 2)}</span>
                  </div>
                </div>
              )
            })}

            {/* Total */}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500 font-semibold">Total</span>
              <div className="text-right">
                <p className="font-bold text-gray-800">${fmt(totalARS)}</p>
                <p className="text-xs text-gray-400">USD {fmt(totalUSD, 2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Por custodio ── */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Composición por custodio
          </p>
          <div className="space-y-2">
            {Object.values(porCustodio)
              .sort((a, b) => b.valuacion_ars - a.valuacion_ars)
              .map(c => {
                const pct = totalARSTodos > 0 ? (c.valuacion_ars / totalARSTodos * 100) : 0
                const isActivo = custodioFiltro === c.custodio
                return (
                  <div
                    key={c.custodio}
                    className={`cursor-pointer rounded-lg p-1 -mx-1 transition-colors ${isActivo ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setCustodioFiltro(prev => prev === c.custodio ? 'Todos' : c.custodio)}
                    title="Click para filtrar por este custodio"
                  >
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className={`font-semibold ${isActivo ? 'text-indigo-600' : ''}`}>
                        🏛️ {c.custodio}
                        <span className="text-gray-400 font-normal ml-1">({c.cantidad})</span>
                      </span>
                      <span className="font-bold text-gray-700">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: '#4F6EF7' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>${fmt(c.valuacion_ars)}</span>
                      <span>USD {fmt(c.valuacion_usd, 2)}</span>
                    </div>
                  </div>
                )
              })}

            {/* Total */}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500 font-semibold">Total</span>
              <div className="text-right">
                <p className="font-bold text-gray-800">${fmt(totalARSTodos)}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Cartera principal ──────────────────────────────────────────────
export default function Cartera() {
  const { authFetch, usuario } = useAuth()
  const [posiciones, setPosiciones] = useState([])
  const [resumen, setResumen]       = useState(null)
  const [cargando, setCargando]     = useState(true)
  const [sortCol, setSortCol]       = useState('ticker')
  const [sortDir, setSortDir]       = useState('asc')
  const [seleccionado, setSeleccionado] = useState(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [mostrarInformes, setMostrarInformes] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const esAdmin = usuario?.rol === 'admin'
      const url = esAdmin ? '/api/cartera/posiciones?todos=true' : '/api/cartera/posiciones'
      const res  = await authFetch(url)
      const data = await res.json()
      const items = data.data || []
      setPosiciones(items)
      let totalARS = 0, totalUSD = 0
      items.forEach(p => {
        if (p.valuacion_ars) totalARS += parseFloat(p.valuacion_ars)
        if (p.valuacion_usd) totalUSD += parseFloat(p.valuacion_usd)
      })
      setResumen({ totalARS, totalUSD, cantidad: items.length })
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, usuario])

  useEffect(() => { cargar() }, [cargar])

  const verDetalle = (item) => {
    setSeleccionado(prev => prev?.ticker === item.ticker ? null : item)
  }

  const sort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...posiciones].sort((a, b) => {
    const va = a[sortCol] ?? ''
    const vb = b[sortCol] ?? ''
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb), undefined, { numeric: true })
      : String(vb).localeCompare(String(va), undefined, { numeric: true })
  })

  const ejecutarCierres = async () => {
    setEjecutando(true)
    try {
      await authFetch('/api/cartera/ejecutar-cierres', { method: 'POST' })
      await cargar()
    } catch {}
    setEjecutando(false)
  }

  const Th = ({ col, label }) => (
    <th onClick={() => sort(col)}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📈 Mi cartera</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setMostrarInformes(v => !v)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${mostrarInformes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            📊 Informes
          </button>
          <button onClick={cargar}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            ↻ Actualizar
          </button>
          {usuario?.rol === 'admin' && (
            <button onClick={ejecutarCierres} disabled={ejecutando}
              className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60"
              style={{ backgroundColor: '#28a745' }}>
              {ejecutando ? 'Actualizando...' : '🔄 Actualizar precios'}
            </button>
          )}
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-indigo-600 rounded-xl p-5 text-white">
            <p className="text-indigo-200 text-sm">Valuación ARS</p>
            <p className="text-2xl font-bold mt-1">${fmt(resumen.totalARS)}</p>
          </div>
          <div className="bg-indigo-500 rounded-xl p-5 text-white">
            <p className="text-indigo-200 text-sm">Valuación USD</p>
            <p className="text-2xl font-bold mt-1">USD {fmt(resumen.totalUSD)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-gray-400 text-sm">Especies en cartera</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{resumen.cantidad}</p>
          </div>
        </div>
      )}

      {/* Informes colapsables */}
      {mostrarInformes && posiciones.length > 0 && (
        <Informes posiciones={posiciones} />
      )}

      <div className="flex gap-6">
        {/* Tabla */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {cargando ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <Th col="ticker"             label="Ticker" />
                    <Th col="tipo"               label="Tipo" />
                    <Th col="vn_actual"          label="VN" />
                    <Th col="precio_promedio"    label="P. Compra" />
                    <Th col="precio_cierre_ars"  label="P. Mercado ARS" />
                    <Th col="precio_cierre_usd"  label="P. Mercado USD" />
                    <Th col="valuacion_ars"      label="Val. ARS" />
                    <Th col="valuacion_usd"      label="Val. USD" />
                    <Th col="resultado_pct"      label="Result. %" />
                    <Th col="tir"                label="TIR" />
                    <Th col="duration"           label="MD" />
                    <Th col="volumen_operado"    label="Volumen" />
                    <Th col="custodio_nombre"    label="Custodio" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((item, i) => {
                    const pct = parseFloat(item.resultado_pct || 0)
                    const isSelected = seleccionado?.ticker === item.ticker
                    return (
                      <tr key={i} onClick={() => verDetalle(item)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-white px-2 py-1 rounded"
                            style={{ backgroundColor: colorTipo(item.tipo) }}>
                            {item.ticker}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.tipo?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm">{fmt(item.vn_actual)}</td>
                        <td className="px-4 py-3 text-sm">{parseFloat(item.precio_promedio || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">{item.precio_cierre_ars ? fmt(item.precio_cierre_ars) : '-'}</td>
                        <td className="px-4 py-3 text-sm">{item.precio_cierre_usd ? parseFloat(item.precio_cierre_usd).toFixed(2) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-indigo-600">${fmt(item.valuacion_ars)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-indigo-600">USD {fmt(item.valuacion_usd)}</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: pct >= 0 ? '#27ae60' : '#e74c3c' }}>
                          {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#b5700a' }}>
                          {item.tir ? `${parseFloat(item.tir).toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#b5700a' }}>
                          {item.duration ? parseFloat(item.duration).toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{abreviarVol(item.volumen_operado)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.custodio_nombre || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel de detalle */}
        {seleccionado && (
          <EspecieDetalle
            ticker={seleccionado.ticker}
            datosBasicos={seleccionado}
            onCerrar={() => setSeleccionado(null)}
          />
        )}
      </div>
    </div>
  )
}
