// pages/Evolucion.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtFecha(f) {
  if (!f) return '-'
  const s = String(f).includes('T') ? String(f).split('T')[0] : String(f)
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}
function meses(anios) { return parseFloat(anios || 0) * 12 }

// Muestra una variación con color y signo
function Variacion({ v, sufijo = '', invertirColor = false }) {
  if (!v || v.abs === undefined) return <span className="text-gray-300">—</span>
  const pos = v.abs >= 0
  const color = (pos !== invertirColor) ? 'text-green-600' : 'text-red-500'
  return (
    <span className={color}>
      {pos ? '+' : ''}{fmt(v.abs)}{sufijo}
      {v.rel !== null && v.rel !== undefined && (
        <span className="text-xs opacity-70"> ({pos ? '+' : ''}{fmt(v.rel)}%)</span>
      )}
    </span>
  )
}

export default function Evolucion() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [fotos, setFotos]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [idA, setIdA]           = useState('')  // más reciente
  const [idB, setIdB]           = useState('')  // anterior
  const [comp, setComp]         = useState(null)
  const [comparando, setComparando] = useState(false)
  const [cerFotos, setCerFotos] = useState(null)  // { cerA, cerB } CER de la foto actual/anterior
  const [cerPorFecha, setCerPorFecha] = useState({})  // { 'YYYY-MM-DD': valorCER } de todas las fotos

  const cargarFotos = useCallback(async () => {
    setCargando(true)
    try {
      const res = await authFetch('/api/cartera/snapshots')
      const data = await res.json()
      const lista = data.data || []
      setFotos(lista)
      // Preseleccionar las dos más recientes
      if (lista.length >= 2) {
        setIdA(String(lista[0].id))
        setIdB(String(lista[1].id))
      }
    } catch {}
    finally { setCargando(false) }
  }, [authFetch])

  useEffect(() => { cargarFotos() }, [cargarFotos])

  // Serie cronológica ascendente para los gráficos de evolución
  const serie = useMemo(() => {
    return fotos
      .slice()
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map(f => ({
        fecha: fmtFecha(f.fecha),
        totalUsd: Math.round(parseFloat(f.total_usd || 0)),
        tir: Math.round(parseFloat(f.tir_pond || 0) * 100) / 100,
        duration: Math.round(meses(f.duration_pond) * 10) / 10,
      }))
  }, [fotos])

  const comparar = useCallback(async () => {
    if (!idA || !idB || idA === idB) { setComp(null); return }
    setComparando(true)
    try {
      const res = await authFetch(`/api/cartera/snapshots/comparar/${idA}/${idB}`)
      const data = await res.json()
      if (data.ok) setComp(data)
    } catch {}
    finally { setComparando(false) }
  }, [authFetch, idA, idB])

  useEffect(() => { comparar() }, [comparar])

  // CER de la fecha de cada foto (para reexpresar en pesos constantes)
  useEffect(() => {
    if (!comp?.anterior?.fecha || !comp?.actual?.fecha) { setCerFotos(null); return }
    const fA = String(comp.actual.fecha).split('T')[0]
    const fB = String(comp.anterior.fecha).split('T')[0]
    Promise.all([
      authFetch(`/api/cartera/cer?fecha=${fA}`).then(r => r.json()),
      authFetch(`/api/cartera/cer?fecha=${fB}`).then(r => r.json()),
    ]).then(([dA, dB]) => {
      setCerFotos(dA.ok && dB.ok ? { cerA: dA.valor, cerB: dB.valor } : null)
    }).catch(() => setCerFotos(null))
  }, [authFetch, comp])

  // Pesos constantes: reexpresa la foto anterior a pesos de la fecha actual (× CER_actual/CER_anterior)
  const arsConstante = useMemo(() => {
    if (!comp || !cerFotos || !cerFotos.cerB) return null
    const factor    = cerFotos.cerA / cerFotos.cerB
    const antReexpr = parseFloat(comp.anterior.total_ars || 0) * factor
    const actual    = parseFloat(comp.actual.total_ars || 0)
    const rel = antReexpr !== 0 ? (actual / antReexpr - 1) * 100 : null
    return { antReexpr, actual, abs: actual - antReexpr, rel, factor }
  }, [comp, cerFotos])

  // CER de cada foto (para el gráfico de patrimonio en pesos constantes)
  useEffect(() => {
    if (!fotos.length) { setCerPorFecha({}); return }
    const fechas = [...new Set(fotos.map(f => String(f.fecha).split('T')[0]))]
    Promise.all(fechas.map(fe =>
      authFetch(`/api/cartera/cer?fecha=${fe}`).then(r => r.json()).then(d => ({ fe, valor: d.ok ? d.valor : null }))
    )).then(arr => {
      const map = {}
      for (const { fe, valor } of arr) if (valor !== null) map[fe] = valor
      setCerPorFecha(map)
    }).catch(() => setCerPorFecha({}))
  }, [authFetch, fotos])

  // Serie de patrimonio reexpresado a pesos de la foto más reciente (base común)
  const serieConstante = useMemo(() => {
    const ord = fotos.slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    if (ord.length < 2) return []
    const cerBase = cerPorFecha[String(ord[ord.length - 1].fecha).split('T')[0]]
    if (!cerBase) return []
    const out = []
    for (const f of ord) {
      const cerF = cerPorFecha[String(f.fecha).split('T')[0]]
      if (!cerF) return []  // si falta el CER de alguna foto, no se grafica (serie incompleta)
      out.push({ fecha: fmtFecha(f.fecha), arsConstante: Math.round(parseFloat(f.total_ars || 0) * (cerBase / cerF)) })
    }
    return out
  }, [fotos, cerPorFecha])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta foto?')) return
    try {
      await authFetch(`/api/cartera/snapshots/${id}`, { method: 'DELETE' })
      cargarFotos()
    } catch {}
  }

  if (!esAdmin) {
    return <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
      Solo disponible para administradores
    </div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">📈 Evolución de cartera</h1>

      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : fotos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay fotos guardadas todavía. Andá a <span className="font-semibold">Reportes</span> y usá "📸 Guardar foto" para crear la primera.
        </div>
      ) : (
        <>
          {/* Selector de fotos a comparar */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">Comparar dos fotos</p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Foto más reciente</label>
                <select value={idA} onChange={e => setIdA(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 min-w-[220px]">
                  <option value="">Seleccionar...</option>
                  {fotos.map(f => (
                    <option key={f.id} value={f.id}>
                      {fmtFecha(f.fecha)}{f.etiqueta ? ` — ${f.etiqueta}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-gray-300 pb-2">vs</span>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Foto anterior</label>
                <select value={idB} onChange={e => setIdB(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 min-w-[220px]">
                  <option value="">Seleccionar...</option>
                  {fotos.map(f => (
                    <option key={f.id} value={f.id}>
                      {fmtFecha(f.fecha)}{f.etiqueta ? ` — ${f.etiqueta}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {idA && idB && idA === idB && (
              <p className="text-xs text-red-400 mt-2">Elegí dos fotos distintas</p>
            )}
          </div>

          {/* Comparación */}
          {comparando ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"/></div>
          ) : comp ? (
            <>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Métrica</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        {fmtFecha(comp.anterior.fecha)}<br/><span className="text-gray-300 normal-case">anterior</span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        {fmtFecha(comp.actual.fecha)}<br/><span className="text-gray-300 normal-case">actual</span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Variación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {/* USD primero: es la medida principal (moneda dura) */}
                    <tr className="bg-indigo-50">
                      <td className="px-4 py-3 text-sm font-semibold text-indigo-800">Total USD <span className="text-xs font-normal text-indigo-400">(moneda dura)</span></td>
                      <td className="px-4 py-3 text-right text-sm">USD {fmt(comp.anterior.total_usd)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">USD {fmt(comp.actual.total_usd)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold"><Variacion v={comp.variacion.total_usd} /></td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-600">Total ARS <span className="text-xs text-gray-400">(nominal)</span></td>
                      <td className="px-4 py-3 text-right text-sm">$ {fmt(comp.anterior.total_ars)}</td>
                      <td className="px-4 py-3 text-right text-sm">$ {fmt(comp.actual.total_ars)}</td>
                      <td className="px-4 py-3 text-right text-sm"><Variacion v={comp.variacion.total_ars} /></td>
                    </tr>
                    {arsConstante && (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-600"
                          title={`Foto anterior reexpresada a pesos de la fecha actual usando el CER (factor ${arsConstante.factor.toFixed(4)}). La variación descuenta la inflación medida por el CER.`}>
                          Total ARS <span className="text-xs text-gray-400">(pesos constantes · CER)</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">$ {fmt(arsConstante.antReexpr)}</td>
                        <td className="px-4 py-3 text-right text-sm">$ {fmt(arsConstante.actual)}</td>
                        <td className="px-4 py-3 text-right text-sm"><Variacion v={{ abs: arsConstante.abs, rel: arsConstante.rel }} /></td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-600">TIR/TNA prom. pond.</td>
                      <td className="px-4 py-3 text-right text-sm">{fmt(comp.anterior.tir_pond)}%</td>
                      <td className="px-4 py-3 text-right text-sm">{fmt(comp.actual.tir_pond)}%</td>
                      <td className="px-4 py-3 text-right text-sm"><Variacion v={comp.variacion.tir_pond} sufijo=" pp" /></td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-600">Duration/plazo pond.</td>
                      <td className="px-4 py-3 text-right text-sm">{fmt(meses(comp.anterior.duration_pond), 1)} m</td>
                      <td className="px-4 py-3 text-right text-sm">{fmt(meses(comp.actual.duration_pond), 1)} m</td>
                      <td className="px-4 py-3 text-right text-sm">
                        <Variacion v={{ abs: meses(comp.variacion.duration_pond.abs), rel: comp.variacion.duration_pond.rel }} sufijo=" m" />
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-600">Tipo de cambio</td>
                      <td className="px-4 py-3 text-right text-sm">{fmt(comp.anterior.tc)}</td>
                      <td className="px-4 py-3 text-right text-sm">{fmt(comp.actual.tc)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">
                        {comp.anterior.tc && comp.actual.tc ? `${fmt((comp.actual.tc/comp.anterior.tc - 1)*100)}%` : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-400 italic">
                La variación en USD es la medida principal por ser moneda dura. La variación nominal en ARS no está ajustada por inflación
                (la comparación en pesos constantes por CER se incorporará más adelante).
              </p>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              Elegí dos fotos distintas para ver la comparación
            </div>
          )}

          {/* Gráficos de evolución (se enriquecen a medida que sumás fotos) */}
          {serie.length >= 2 && (
            <div className="grid grid-cols-2 gap-6">
              {/* Patrimonio en USD */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">Evolución del patrimonio (USD)</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={serie} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => `USD ${fmt(v)}`} />
                    <Line type="monotone" dataKey="totalUsd" name="Total USD" stroke="#4F6EF7" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* TIR y Duration con doble eje */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">Evolución de indicadores</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={serie} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`}
                      label={{ value: 'TIR', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#16a085' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${v}m`}
                      label={{ value: 'Duration', angle: 90, position: 'insideRight', fontSize: 11, fill: '#8e44ad' }} />
                    <Tooltip formatter={(v, n) => n === 'TIR' ? `${fmt(v)}%` : `${fmt(v,1)} m`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="left" type="monotone" dataKey="tir" name="TIR" stroke="#16a085" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="duration" name="Duration" stroke="#8e44ad" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Patrimonio en pesos constantes (base: foto más reciente, deflactado por CER) */}
              {serieConstante.length >= 2 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4 col-span-2">
                  <p className="text-sm font-semibold text-gray-600 mb-3">
                    Patrimonio en pesos constantes <span className="text-xs font-normal text-gray-400">(base última foto · deflactado por CER)</span>
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={serieConstante} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`} />
                      <Tooltip formatter={v => `$ ${fmt(v)}`} />
                      <Line type="monotone" dataKey="arsConstante" name="ARS constantes" stroke="#e67e22" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
          {serie.length === 1 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
              Con una sola foto todavía no se puede graficar la evolución. Guardá al menos una segunda foto (idealmente a fin de mes) para ver las tendencias.
            </div>
          )}

          {/* Listado de fotos */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-600">Fotos guardadas</p>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Fecha', 'Etiqueta', 'Total ARS', 'Total USD', 'TIR pond.', 'Duration', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fotos.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{fmtFecha(f.fecha)}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{f.etiqueta || '—'}</td>
                    <td className="px-4 py-2 text-sm text-right">$ {fmt(f.total_ars)}</td>
                    <td className="px-4 py-2 text-sm text-right">USD {fmt(f.total_usd)}</td>
                    <td className="px-4 py-2 text-sm text-right">{fmt(f.tir_pond)}%</td>
                    <td className="px-4 py-2 text-sm text-right">{fmt(meses(f.duration_pond), 1)} m</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => eliminar(f.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
