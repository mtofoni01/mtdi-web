// pages/Evolucion.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

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
