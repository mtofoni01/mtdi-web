// pages/Reportes.jsx
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useAuth } from '../context/AuthContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const COLORES = ['#4F6EF7', '#16a085', '#8e44ad', '#e67e22', '#c0392b', '#2980b9', '#27ae60', '#d35400', '#7f8c8d', '#f39c12']

function meses(anios) {
  return (parseFloat(anios || 0) * 12)
}
function fmtMeses(anios) {
  const m = meses(anios)
  if (m < 0.5) return `${Math.round(anios * 365)} d`
  return `${m.toFixed(1)} m`
}

// Orden de liquidez: más líquido primero
const ORDEN_GRUPO = {
  'Depósitos a la vista': 1,
  'Plazos fijos': 2,
  'Cauciones': 3,
  'FCI': 4,
  'Renta fija': 5,
  'Renta variable': 6,
}

// Pondera tasa y plazo sobre base_usd (denominador común y estable)
function ponderar(items) {
  const base = items.reduce((s, i) => s + parseFloat(i.base_usd || 0), 0)
  if (base === 0) return { tir: 0, dur: 0, base: 0 }
  let tir = 0, dur = 0
  for (const i of items) {
    const peso = parseFloat(i.base_usd || 0) / base
    tir += parseFloat(i.tasa || 0) * peso
    dur += parseFloat(i.plazo_anios || 0) * peso
  }
  return { tir, dur, base }
}

export default function Reportes() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [items, setItems]         = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [custodios, setCustodios] = useState([])
  const [cargando, setCargando]   = useState(true)

  const [fUsuarios, setFUsuarios]   = useState([])
  const [fCustodios, setFCustodios] = useState([])

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

  const global = useMemo(() => ponderar(items), [items])
  const totalArs = useMemo(() => items.reduce((s, i) => s + parseFloat(i.valuacion_ars || 0), 0), [items])
  const totalUsd = useMemo(() => items.reduce((s, i) => s + parseFloat(i.valuacion_usd || 0), 0), [items])

  // Estructura jerárquica: moneda → grupo de instrumento
  const estructura = useMemo(() => {
    const monedas = {}
    for (const i of items) {
      const mon = i.moneda || 'ARS'
      if (!monedas[mon]) monedas[mon] = {}
      const g = i.grupo || 'Otros'
      if (!monedas[mon][g]) monedas[mon][g] = []
      monedas[mon][g].push(i)
    }
    const resultado = []
    for (const mon of Object.keys(monedas).sort()) {
      const grupos = Object.entries(monedas[mon])
        .sort((a, b) => (ORDEN_GRUPO[a[0]] || 99) - (ORDEN_GRUPO[b[0]] || 99))
        .map(([grupo, its]) => ({
          grupo,
          items: its.slice().sort((a, b) => parseFloat(a.plazo_anios) - parseFloat(b.plazo_anios)),
          pond: ponderar(its),
          totalArs: its.reduce((s, i) => s + parseFloat(i.valuacion_ars || 0), 0),
          totalUsd: its.reduce((s, i) => s + parseFloat(i.valuacion_usd || 0), 0),
        }))
      const itemsMon = items.filter(i => (i.moneda || 'ARS') === mon)
      resultado.push({
        moneda: mon,
        grupos,
        pond: ponderar(itemsMon),
        totalArs: itemsMon.reduce((s, i) => s + parseFloat(i.valuacion_ars || 0), 0),
        totalUsd: itemsMon.reduce((s, i) => s + parseFloat(i.valuacion_usd || 0), 0),
      })
    }
    return resultado
  }, [items])

  const agrupar = (campo) => {
    const map = {}
    for (const i of items) {
      const k = i[campo] || 'Sin asignar'
      map[k] = (map[k] || 0) + parseFloat(i.base_usd || 0)
    }
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value*100)/100 })).sort((a,b)=>b.value-a.value)
  }
  const porMoneda      = useMemo(() => agrupar('moneda'), [items])
  const porInstrumento = useMemo(() => agrupar('grupo'), [items])
  const porCustodio    = useMemo(() => agrupar('custodio_nombre'), [items])
  const mostrarCustodios = fCustodios.length !== 1 && porCustodio.length > 1

  const toggle = (arr, setArr, id) => setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id])
  const hayFiltros = fUsuarios.length || fCustodios.length

  const Fila = ({ i }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 pl-8 text-sm font-semibold text-gray-700">{i.ticker}</td>
      <td className="px-4 py-2 text-xs text-gray-400">{i.descripcion?.slice(0, 28)}</td>
      <td className="px-4 py-2 text-sm text-right">{fmt(i.valuacion_ars)}</td>
      <td className="px-4 py-2 text-sm text-right">{fmt(i.valuacion_usd)}</td>
      <td className="px-4 py-2 text-sm text-right" style={{ color: '#16a085' }}>{i.tasa ? `${fmt(i.tasa)}%` : '—'}</td>
      <td className="px-4 py-2 text-xs text-right text-gray-500">{fmtMeses(i.plazo_anios)}</td>
      <td className="px-4 py-2 text-xs text-gray-400">{i.custodio_nombre || '—'}</td>
      {esAdmin && <td className="px-4 py-2 text-xs text-gray-400">{i.usuario_nombre || '—'}</td>}
    </tr>
  )

  const colSpan = esAdmin ? 8 : 7

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📊 Reporte de cartera</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻ Actualizar</button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div>
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
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay tenencias {hayFiltros ? 'con estos filtros' : ''}
        </div>
      ) : (
        <>
          {/* Totales globales */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-indigo-600 rounded-xl p-5 text-white">
              <p className="text-indigo-200 text-sm">Total ARS</p>
              <p className="text-xl font-bold mt-1">$ {fmt(totalArs)}</p>
            </div>
            <div className="bg-indigo-500 rounded-xl p-5 text-white">
              <p className="text-indigo-200 text-sm">Total USD</p>
              <p className="text-xl font-bold mt-1">USD {fmt(totalUsd)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-gray-400 text-sm">TIR/TNA prom. pond.</p>
              <p className="text-xl font-bold text-green-600 mt-1">{fmt(global.tir)}%</p>
              <p className="text-xs text-gray-300">base USD · estable</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-gray-400 text-sm">Duration/plazo pond.</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">{fmt(meses(global.dur), 1)} <span className="text-sm text-gray-400">meses</span></p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Exposición por moneda</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porMoneda} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                    label={e => `${e.name} ${(e.percent*100).toFixed(0)}%`}>
                    {porMoneda.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `USD ${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-gray-400">Base USD</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Por instrumento</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porInstrumento} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
                    {porInstrumento.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `USD ${fmt(v)}`} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {mostrarCustodios ? (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Por custodio</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={porCustodio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
                      {porCustodio.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `USD ${fmt(v)}`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-center text-gray-300 text-sm">
                {fCustodios.length === 1 ? 'Un solo custodio' : 'Sin desglose'}
              </div>
            )}
          </div>

          {/* Tabla jerárquica */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ticker</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Detalle</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Val. ARS</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Val. USD</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tasa</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Plazo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Custodio</th>
                    {esAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>}
                  </tr>
                </thead>
                <tbody>
                  {estructura.map(mon => (
                    <Fragment key={`mon-wrap-${mon.moneda}`}>
                      <tr className="bg-indigo-600 text-white">
                        <td colSpan={colSpan} className="px-4 py-2 font-bold text-sm">💱 {mon.moneda}</td>
                      </tr>
                      {mon.grupos.map(g => (
                        <Fragment key={`g-wrap-${mon.moneda}-${g.grupo}`}>
                          <tr className="bg-gray-100">
                            <td colSpan={2} className="px-4 py-1.5 pl-6 font-semibold text-xs text-gray-600 uppercase">{g.grupo}</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(g.totalArs)}</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(g.totalUsd)}</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(g.pond.tir)}%</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(meses(g.pond.dur),1)}m</td>
                            <td colSpan={esAdmin ? 2 : 1}></td>
                          </tr>
                          {g.items.map((i, idx) => <Fila key={`${mon.moneda}-${g.grupo}-${idx}`} i={i} />)}
                        </Fragment>
                      ))}
                      <tr className="bg-indigo-50 border-y border-indigo-100 font-semibold">
                        <td colSpan={2} className="px-4 py-2 text-sm text-indigo-700">Subtotal {mon.moneda}</td>
                        <td className="px-4 py-2 text-right text-sm text-indigo-700">{fmt(mon.totalArs)}</td>
                        <td className="px-4 py-2 text-right text-sm text-indigo-700">{fmt(mon.totalUsd)}</td>
                        <td className="px-4 py-2 text-right text-sm text-green-600">{fmt(mon.pond.tir)}%</td>
                        <td className="px-4 py-2 text-right text-sm text-indigo-700">{fmt(meses(mon.pond.dur),1)}m</td>
                        <td colSpan={esAdmin ? 2 : 1}></td>
                      </tr>
                    </Fragment>
                  ))}
                  <tr className="bg-gray-800 text-white font-bold">
                    <td colSpan={2} className="px-4 py-3 text-sm">TOTAL GENERAL</td>
                    <td className="px-4 py-3 text-right text-sm">$ {fmt(totalArs)}</td>
                    <td className="px-4 py-3 text-right text-sm">USD {fmt(totalUsd)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-300">{fmt(global.tir)}%</td>
                    <td className="px-4 py-3 text-right text-sm">{fmt(meses(global.dur),1)}m</td>
                    <td colSpan={esAdmin ? 2 : 1}></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400">
              {items.length} tenencia(s) · Ponderaciones sobre base común USD (estables, no dependen de la moneda)
            </div>
          </div>
        </>
      )}
    </div>
  )
}
