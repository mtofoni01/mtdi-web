// pages/Reportes.jsx
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useAuth } from '../context/AuthContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const COLORES = ['#4F6EF7', '#16a085', '#8e44ad', '#e67e22', '#c0392b', '#2980b9', '#27ae60', '#d35400', '#7f8c8d', '#f39c12']

function meses(anios) {
  return (parseFloat(anios || 0) * 12)
}
function fmtMeses(anios) {
  return `${meses(anios).toFixed(1)} m`
}

// Orden fijo de grupos (nivel 2): colocaciones líquidas → renta variable → renta fija
const ORDEN_GRUPO = {
  'Depósitos a la vista': 1,
  'FCI': 2,
  'Plazos fijos': 3,
  'Cauciones': 4,
  'Renta variable': 5,
  'Renta fija': 6,
}

// Orden fijo de subgrupos dentro de Renta fija (nivel 3)
const ORDEN_SUBGRUPO = {
  'Letras $': 1,
  'Letras USD': 2,
  'Bonos $ tasa fija': 3,
  'Bonos $ CER': 4,
  'Bonos $ dólar linked': 5,
  'Bonos USD': 6,
  'Obligaciones negociables': 7,
  'Otros': 99,
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
  const { authFetch, usuario, token } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [items, setItems]         = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [custodios, setCustodios] = useState([])
  const [cargando, setCargando]   = useState(true)
  const [fechaCierre, setFechaCierre] = useState(null)
  const [tc, setTc]               = useState(null)

  const [fUsuarios, setFUsuarios]   = useState([])
  const [fCustodios, setFCustodios] = useState([])
  const [verDetalle, setVerDetalle] = useState(true)  // toggle detalle por especie

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
      setFechaCierre(dRep.fecha_cierre || null)
      setTc(dRep.tc || null)

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

  // Estructura jerárquica: moneda → grupo → subgrupo → items
  const estructura = useMemo(() => {
    const monedas = {}
    for (const i of items) {
      const mon = i.moneda || 'ARS'
      const g = i.grupo || 'Otros'
      const sg = i.subgrupo || g
      if (!monedas[mon]) monedas[mon] = {}
      if (!monedas[mon][g]) monedas[mon][g] = {}
      if (!monedas[mon][g][sg]) monedas[mon][g][sg] = []
      monedas[mon][g][sg].push(i)
    }
    const resultado = []
    for (const mon of Object.keys(monedas).sort()) {
      const grupos = Object.entries(monedas[mon])
        .sort((a, b) => (ORDEN_GRUPO[a[0]] || 99) - (ORDEN_GRUPO[b[0]] || 99))
        .map(([grupo, subMap]) => {
          const esRentaFija = grupo === 'Renta fija'
          // Subgrupos ordenados (solo se muestran como nivel extra en renta fija)
          const subgrupos = Object.entries(subMap)
            .sort((a, b) => (ORDEN_SUBGRUPO[a[0]] || 99) - (ORDEN_SUBGRUPO[b[0]] || 99))
            .map(([subgrupo, its]) => ({
              subgrupo,
              items: its.slice().sort((a, b) => parseFloat(a.plazo_anios) - parseFloat(b.plazo_anios)),
              pond: ponderar(its),
              totalArs: its.reduce((s, i) => s + parseFloat(i.valuacion_ars || 0), 0),
              totalUsd: its.reduce((s, i) => s + parseFloat(i.valuacion_usd || 0), 0),
            }))
          const itsGrupo = Object.values(subMap).flat()
          return {
            grupo,
            esRentaFija,
            subgrupos,
            items: itsGrupo.slice().sort((a, b) => parseFloat(a.plazo_anios) - parseFloat(b.plazo_anios)),
            pond: ponderar(itsGrupo),
            totalArs: itsGrupo.reduce((s, i) => s + parseFloat(i.valuacion_ars || 0), 0),
            totalUsd: itsGrupo.reduce((s, i) => s + parseFloat(i.valuacion_usd || 0), 0),
          }
        })
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

  // Leyenda de texto con porcentajes (para que siempre salga, también en PDF)
  const Leyenda = ({ data }) => {
    const total = data.reduce((s, d) => s + d.value, 0)
    if (total === 0) return null
    return (
      <div className="mt-2 space-y-0.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORES[i % COLORES.length] }} />
              <span className="text-gray-600">{d.name}</span>
            </span>
            <span className="text-gray-500 font-medium">{((d.value/total)*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    )
  }

  // Exportar PDF: usa el diálogo de impresión del navegador (Guardar como PDF).
  // Los estilos @media print ocultan todo menos el cuerpo del reporte.
  const exportarPDF = () => { window.print() }

  // Exportar Excel: descarga el .xlsx del backend (sin filtros, tabla plana)
  const exportarExcel = async () => {
    try {
      const base = 'https://backend-login-production-6dd0.up.railway.app'
      const res = await fetch(`${base}/api/cartera/reporte/excel`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_cartera_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {}
  }

  const Fila = ({ i }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 pl-8 text-sm font-semibold text-gray-700">{i.ticker}</td>
      <td className="px-4 py-2 text-xs text-gray-400">{i.descripcion?.slice(0, 28)}</td>
      <td className="px-4 py-2 text-sm text-right">{fmt(i.valuacion_ars)}</td>
      <td className="px-4 py-2 text-sm text-right">{fmt(i.valuacion_usd)}</td>
      <td className="px-4 py-2 text-sm text-right" style={{ color: '#16a085' }}>{i.tasa ? `${fmt(i.tasa)}%` : '—'}</td>
      <td className="px-4 py-2 text-xs text-right text-gray-500">{fmtMeses(i.plazo_anios)}</td>
      <td className="px-4 py-2 text-xs text-gray-400 no-print">{i.custodio_nombre || '—'}</td>
      {esAdmin && <td className="px-4 py-2 text-xs text-gray-400 no-print">{i.usuario_nombre || '—'}</td>}
    </tr>
  )

  const colSpan = esAdmin ? 8 : 7

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          /* Ocultar todo lo que no sea el reporte */
          body * { visibility: hidden; }
          #reporte-imprimible, #reporte-imprimible * { visibility: visible; }
          #reporte-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          /* Evitar cortes feos dentro de tablas y tarjetas */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          .rounded-xl { break-inside: avoid; }
          @page { margin: 1cm; size: landscape; }
        }
      `}</style>
      <div className="flex items-center justify-between no-print">
        <h1 className="text-2xl font-bold text-gray-800">📊 Reporte de cartera</h1>
        <div className="flex gap-2 no-print">
          <button onClick={() => setVerDetalle(v => !v)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${verDetalle ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {verDetalle ? '📖 Detalle por especie' : '📕 Solo subtotales'}
          </button>
          <button onClick={exportarPDF}
            className="px-4 py-2 text-sm rounded-lg text-white" style={{ backgroundColor: '#c0392b' }}>
            📄 PDF
          </button>
          {esAdmin && (
            <button onClick={exportarExcel}
              className="px-4 py-2 text-sm rounded-lg text-white" style={{ backgroundColor: '#16a085' }}>
              📊 Excel
            </button>
          )}
          <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻ Actualizar</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 no-print">
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
        <div id="reporte-imprimible">
          {/* Encabezado solo visible al imprimir */}
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-bold text-gray-800">Informe de cartera</h2>
            <p className="text-sm text-gray-500">
              Emitido: {new Date().toLocaleDateString('es-AR')}
              {fechaCierre && ` · Cotizaciones al ${new Date(String(fechaCierre).split('T')[0] + 'T12:00:00').toLocaleDateString('es-AR')}`}
              {tc && ` · TC ${fmt(tc, 2)}`}
            </p>
          </div>
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
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={porMoneda} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
                    {porMoneda.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `USD ${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
              <Leyenda data={porMoneda} />
              <p className="text-center text-xs text-gray-400 mt-1">Base USD</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">Por instrumento</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={porInstrumento} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
                    {porInstrumento.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `USD ${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
              <Leyenda data={porInstrumento} />
            </div>
            {mostrarCustodios ? (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Por custodio</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={porCustodio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
                      {porCustodio.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `USD ${fmt(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <Leyenda data={porCustodio} />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase no-print">Custodio</th>
                    {esAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase no-print">Usuario</th>}
                  </tr>
                </thead>
                <tbody>
                  {estructura.map(mon => (
                    <Fragment key={`mon-wrap-${mon.moneda}`}>
                      <tr className="bg-indigo-600 text-white">
                        <td colSpan={colSpan} className="px-4 py-2 font-bold text-sm">{mon.moneda}</td>
                      </tr>
                      {mon.grupos.map(g => (
                        <Fragment key={`g-wrap-${mon.moneda}-${g.grupo}`}>
                          <tr className="bg-gray-100">
                            <td colSpan={2} className="px-4 py-1.5 pl-6 font-semibold text-xs text-gray-600 uppercase">{g.grupo}</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(g.totalArs)}</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(g.totalUsd)}</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(g.pond.tir)}%</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmtMeses(g.pond.dur)}</td>
                            <td colSpan={esAdmin ? 2 : 1} className="no-print"></td>
                          </tr>

                          {g.esRentaFija ? (
                            // Renta fija: nivel extra de subgrupo (Letras, Bonos CER, etc.)
                            g.subgrupos.map(sg => (
                              <Fragment key={`sg-${mon.moneda}-${sg.subgrupo}`}>
                                <tr className="bg-gray-50">
                                  <td colSpan={2} className="px-4 py-1 pl-10 text-xs italic text-gray-500">{sg.subgrupo}</td>
                                  <td className="px-4 py-1 text-right text-xs text-gray-400">{fmt(sg.totalArs)}</td>
                                  <td className="px-4 py-1 text-right text-xs text-gray-400">{fmt(sg.totalUsd)}</td>
                                  <td className="px-4 py-1 text-right text-xs text-gray-400">{fmt(sg.pond.tir)}%</td>
                                  <td className="px-4 py-1 text-right text-xs text-gray-400">{fmtMeses(sg.pond.dur)}</td>
                                  <td colSpan={esAdmin ? 2 : 1} className="no-print"></td>
                                </tr>
                                {verDetalle && sg.items.map((i, idx) => <Fila key={`${mon.moneda}-${sg.subgrupo}-${idx}`} i={i} />)}
                              </Fragment>
                            ))
                          ) : (
                            // Resto de grupos: items directo
                            verDetalle && g.items.map((i, idx) => <Fila key={`${mon.moneda}-${g.grupo}-${idx}`} i={i} />)
                          )}
                        </Fragment>
                      ))}
                      <tr className="bg-indigo-50 border-y border-indigo-100 font-semibold">
                        <td colSpan={2} className="px-4 py-2 text-sm text-indigo-700">Subtotal {mon.moneda}</td>
                        <td className="px-4 py-2 text-right text-sm text-indigo-700">{fmt(mon.totalArs)}</td>
                        <td className="px-4 py-2 text-right text-sm text-indigo-700">{fmt(mon.totalUsd)}</td>
                        <td className="px-4 py-2 text-right text-sm text-green-600">{fmt(mon.pond.tir)}%</td>
                        <td className="px-4 py-2 text-right text-sm text-indigo-700">{fmtMeses(mon.pond.dur)}</td>
                        <td colSpan={esAdmin ? 2 : 1} className="no-print"></td>
                      </tr>
                    </Fragment>
                  ))}
                  <tr className="bg-gray-800 text-white font-bold">
                    <td colSpan={2} className="px-4 py-3 text-sm">TOTAL GENERAL</td>
                    <td className="px-4 py-3 text-right text-sm">$ {fmt(totalArs)}</td>
                    <td className="px-4 py-3 text-right text-sm">USD {fmt(totalUsd)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-300">{fmt(global.tir)}%</td>
                    <td className="px-4 py-3 text-right text-sm">{fmtMeses(global.dur)}</td>
                    <td colSpan={esAdmin ? 2 : 1} className="no-print"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400">
              {items.length} tenencia(s) · Ponderaciones sobre base común USD (estables, no dependen de la moneda)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
