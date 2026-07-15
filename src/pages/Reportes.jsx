// pages/Reportes.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// Paleta para los gráficos
const COLORES = ['#4F6EF7', '#16a085', '#8e44ad', '#e67e22', '#c0392b', '#2980b9', '#27ae60', '#d35400', '#7f8c8d', '#f39c12']

function plazoLegible(anios) {
  if (!anios || anios <= 0) return '0 d'
  const dias = anios * 365
  if (dias < 60) return `${Math.round(dias)} d`
  if (anios < 2) return `${(dias/30).toFixed(1)} m`
  return `${anios.toFixed(2)} a`
}

export default function Reportes() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [items, setItems]         = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [custodios, setCustodios] = useState([])
  const [cargando, setCargando]   = useState(true)

  // Filtros (arrays de ids seleccionados; vacío = todos)
  const [fUsuarios, setFUsuarios]   = useState([])
  const [fCustodios, setFCustodios] = useState([])
  // Moneda de análisis para los gráficos y ponderaciones
  const [moneda, setMoneda] = useState('ARS')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (fUsuarios.length)  params.set('usuarios', fUsuarios.join(','))
      if (fCustodios.length) params.set('custodios', fCustodios.join(','))

      const [rRep, rCust] = await Promise.all([
        authFetch(`/api/cartera/reporte?${params}`),
        authFetch('/api/cartera/custodios'),
      ])
      const dRep  = await rRep.json()
      const dCust = await rCust.json()
      setItems(dRep.data || [])
      setCustodios(dCust.data || [])

      if (esAdmin) {
        const rU = await authFetch('/api/admin/usuarios')
        const dU = await rU.json()
        setUsuarios(dU.usuarios || [])
      }
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, esAdmin, fUsuarios, fCustodios])

  useEffect(() => { cargar() }, [cargar])

  // Campo de valuación según moneda elegida
  const valKey = moneda === 'USD' ? 'valuacion_usd' : 'valuacion_ars'

  // Solo items con valuación en la moneda elegida
  const itemsMoneda = useMemo(
    () => items.filter(i => parseFloat(i[valKey] || 0) > 0),
    [items, valKey]
  )

  // ── Totales y ponderaciones ──
  const resumen = useMemo(() => {
    const total = itemsMoneda.reduce((s, i) => s + parseFloat(i[valKey] || 0), 0)
    if (total === 0) return { total: 0, tirPond: 0, durPond: 0, cantidad: 0 }

    let tirPond = 0, durPond = 0
    for (const i of itemsMoneda) {
      const val = parseFloat(i[valKey] || 0)
      const peso = val / total
      tirPond += (parseFloat(i.tasa || 0)) * peso
      durPond += (parseFloat(i.plazo_anios || 0)) * peso
    }
    return { total, tirPond, durPond, cantidad: itemsMoneda.length }
  }, [itemsMoneda, valKey])

  // ── Agrupaciones para gráficos ──
  const agrupar = (campo) => {
    const map = {}
    for (const i of itemsMoneda) {
      const k = i[campo] || 'Sin asignar'
      map[k] = (map[k] || 0) + parseFloat(i[valKey] || 0)
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
  }

  const porMoneda = useMemo(() => {
    // Distribución de exposición por moneda, todo expresado en USD (denominador
    // común) para que la proporción ARS vs USD sea comparable y real.
    const map = {}
    for (const i of items) {
      const valUsd = parseFloat(i.valuacion_usd || 0)
      if (valUsd <= 0) continue
      const mon = i.moneda || 'ARS'
      map[mon] = (map[mon] || 0) + valUsd
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [items])

  const porCustodio    = useMemo(() => agrupar('custodio_nombre'), [itemsMoneda, valKey])
  const porInstrumento = useMemo(() => agrupar('grupo'), [itemsMoneda, valKey])

  // ¿Mostrar desglose por custodio? No si hay un solo custodio seleccionado
  const mostrarCustodios = fCustodios.length !== 1 && porCustodio.length > 1

  const toggle = (arr, setArr, id) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id])
  }

  const hayFiltros = fUsuarios.length || fCustodios.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📊 Reporte de cartera</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻ Actualizar</button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-start">
          {/* Moneda de análisis */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Moneda de análisis</label>
            <div className="flex gap-2">
              {['ARS', 'USD'].map(m => (
                <button key={m} onClick={() => setMoneda(m)}
                  className={`px-4 py-2 text-sm rounded-lg border-2 font-semibold ${moneda === m ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Custodios */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Custodios {fCustodios.length > 0 && `(${fCustodios.length})`}</label>
            <div className="flex flex-wrap gap-2">
              {custodios.map(c => (
                <button key={c.id} onClick={() => toggle(fCustodios, setFCustodios, c.id)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${fCustodios.includes(c.id) ? 'bg-indigo-500 text-white border-indigo-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Usuarios (admin) */}
        {esAdmin && usuarios.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Usuarios {fUsuarios.length > 0 && `(${fUsuarios.length})`}</label>
            <div className="flex flex-wrap gap-2">
              {usuarios.map(u => (
                <button key={u.id} onClick={() => toggle(fUsuarios, setFUsuarios, u.id)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${fUsuarios.includes(u.id) ? 'bg-purple-500 text-white border-purple-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {u.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {hayFiltros && (
          <button onClick={() => { setFUsuarios([]); setFCustodios([]) }}
            className="text-xs text-red-400 hover:text-red-600">✕ Limpiar filtros</button>
        )}
      </div>

      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : itemsMoneda.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay tenencias en {moneda} {hayFiltros ? 'con estos filtros' : ''}
        </div>
      ) : (
        <>
          {/* Tarjetas de totales */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-indigo-600 rounded-xl p-5 text-white">
              <p className="text-indigo-200 text-sm">Total {moneda}</p>
              <p className="text-2xl font-bold mt-1">{moneda} {fmt(resumen.total)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-gray-400 text-sm">TIR/TNA promedio pond.</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{fmt(resumen.tirPond)}%</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-gray-400 text-sm">Duration/plazo pond.</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{fmt(resumen.durPond)} <span className="text-sm text-gray-400">años</span></p>
              <p className="text-xs text-gray-400">{plazoLegible(resumen.durPond)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-gray-400 text-sm">Tenencias</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{resumen.cantidad}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-3 gap-6">
            {/* Por moneda: exposición real, expresada en USD */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Exposición por moneda</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porMoneda} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                    label={e => `${e.name} ${(e.percent * 100).toFixed(0)}%`}>
                    {porMoneda.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `USD ${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-gray-400">Instrumentos según su moneda de origen (base USD)</p>
            </div>

            {/* Por instrumento */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Por tipo de instrumento ({moneda})</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porInstrumento} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {porInstrumento.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Por custodio (si aplica) */}
            {mostrarCustodios ? (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Por custodio ({moneda})</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={porCustodio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                      {porCustodio.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-center text-gray-300 text-sm">
                {fCustodios.length === 1 ? 'Un solo custodio seleccionado' : 'Sin desglose por custodio'}
              </div>
            )}
          </div>

          {/* Tabla detalle */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Instrumento', 'Ticker', 'Moneda', `Valuación ${moneda}`, '% Cartera', 'Tasa', 'Plazo', 'Custodio', esAdmin ? 'Usuario' : null]
                      .filter(h => h !== null).map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itemsMoneda.slice().sort((a,b) => parseFloat(b[valKey]) - parseFloat(a[valKey])).map((i, idx) => {
                    const val = parseFloat(i[valKey] || 0)
                    const pct = resumen.total > 0 ? (val / resumen.total * 100) : 0
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{i.grupo}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-700">{i.ticker}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{i.moneda}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{fmt(val)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmt(pct)}%</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#16a085' }}>{i.tasa ? `${fmt(i.tasa)}%` : '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{plazoLegible(i.plazo_anios)}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{i.custodio_nombre || '-'}</td>
                        {esAdmin && <td className="px-4 py-3 text-xs text-gray-400">{i.usuario_nombre || '-'}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
              {itemsMoneda.length} tenencia(s) · Total {moneda} {fmt(resumen.total)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
