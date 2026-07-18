// pages/CarteraObjetivo.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

// Perfiles de cartera
const PERFILES = [
  { v: 'conservadora', l: 'Conservadora', color: '#16a085' },
  { v: 'media',        l: 'Media',        color: '#e67e22' },
  { v: 'agresiva',     l: 'Agresiva',     color: '#c5183c' },
]

// Dimensiones y sus categorías, en orden de presentación.
// Los códigos (v) coinciden con la tabla carteras_objetivo y con el backend.
const DIMENSIONES = [
  { v: 'moneda', l: 'Moneda', cats: [
    { v: 'pesos',     l: 'Pesos' },
    { v: 'pesos_cer', l: 'Pesos CER' },
    { v: 'dolar',     l: 'Dólar' },
  ]},
  { v: 'instrumento', l: 'Tipo de instrumento', cats: [
    { v: 'liquidez',       l: 'Liquidez / Vista' },
    { v: 'fci',            l: 'FCI' },
    { v: 'pf_cauciones',   l: 'Plazos fijos / Cauciones' },
    { v: 'letras_bonos',   l: 'Letras y Bonos' },
    { v: 'on',             l: 'ON / Fideicomisos' },
    { v: 'renta_variable', l: 'Renta variable' },
    { v: 'derivados',      l: 'Derivados' },
    { v: 'otros',          l: 'Otros' },
  ]},
  { v: 'sector', l: 'Sector', cats: [
    { v: 'publico_nacional',   l: 'Público Nacional' },
    { v: 'publico_provincial', l: 'Público Provincial' },
    { v: 'publico_otros',      l: 'Público Otros' },
    { v: 'privado',            l: 'Privado' },
    { v: 'mixto',              l: 'Mixto' },
  ]},
  { v: 'renta', l: 'Renta', cats: [
    { v: 'fija',     l: 'Renta Fija' },
    { v: 'variable', l: 'Renta Variable' },
  ]},
  { v: 'riesgo', l: 'Riesgo', cats: [
    { v: 'argentina',  l: 'Argentina' },
    { v: 'externo',    l: 'Externo' },
    { v: 'emergentes', l: 'Emergentes' },
  ]},
]

// Mapa dim → cat → label, para la vista de comparación
const LABELS = {}
for (const d of DIMENSIONES) {
  LABELS[d.v] = {}
  for (const c of d.cats) LABELS[d.v][c.v] = c.l
}

// Estilos por nivel de alerta
const ALERTA = {
  ok:           { chip: 'bg-green-100 text-green-700', barra: '#16a085', label: 'En objetivo' },
  fuera_optimo: { chip: 'bg-amber-100 text-amber-700', barra: '#e67e22', label: 'Fuera del óptimo' },
  fuera_limite: { chip: 'bg-red-100 text-red-700',     barra: '#c5183c', label: 'Fuera de límites' },
}

const n = (x) => {
  const v = parseFloat(x)
  return Number.isFinite(v) ? v : 0
}

const clamp = (x) => Math.max(0, Math.min(100, n(x)))

// Barra horizontal: zona piso–tope, marca del óptimo y del real
function BarraRango({ real, piso, optimo, tope, color }) {
  const hayObjetivo = piso !== null && tope !== null
  return (
    <div className="relative h-5 bg-gray-100 rounded w-full overflow-hidden">
      {hayObjetivo && (
        <div className="absolute h-full bg-green-100" style={{ left: `${clamp(piso)}%`, width: `${Math.max(0, clamp(tope) - clamp(piso))}%` }} />
      )}
      {optimo !== null && (
        <div className="absolute h-full w-0.5 bg-gray-500" style={{ left: `${clamp(optimo)}%` }} title={`Óptimo ${n(optimo).toFixed(1)}%`} />
      )}
      <div className="absolute top-0 h-full w-1 rounded" style={{ left: `${clamp(real)}%`, backgroundColor: color, transform: 'translateX(-2px)' }} title={`Real ${n(real).toFixed(1)}%`} />
    </div>
  )
}

// Paleta por índice de categoría (compartida entre óptimo y real de una dimensión)
const PALETA = ['#4F6EF7', '#16a085', '#e67e22', '#8e44ad', '#e74c3c', '#2980b9', '#f1c40f', '#34495e']

// Torta chica (pie SVG) sin dependencias. datos: [{ valor, color, label }]
function MiniTorta({ datos, size = 60 }) {
  const total = datos.reduce((s, d) => s + Math.max(0, n(d.valor)), 0)
  const r = size / 2
  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill="none" stroke="#e5e7eb" strokeWidth="2" />
        <text x={r} y={r + 3} textAnchor="middle" fontSize="9" fill="#bbb">s/d</text>
      </svg>
    )
  }
  let ang = -Math.PI / 2
  const sectores = datos.map((d, i) => {
    const val = Math.max(0, n(d.valor))
    if (val <= 0) return null
    const frac = val / total
    const a0 = ang
    const a1 = ang + frac * 2 * Math.PI
    ang = a1
    if (frac >= 0.99999) {
      return <circle key={i} cx={r} cy={r} r={r} fill={d.color}><title>{`${d.label}: ${val.toFixed(1)}%`}</title></circle>
    }
    const x0 = r + r * Math.cos(a0), y0 = r + r * Math.sin(a0)
    const x1 = r + r * Math.cos(a1), y1 = r + r * Math.sin(a1)
    const large = frac > 0.5 ? 1 : 0
    return (
      <path key={i} d={`M${r},${r} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`} fill={d.color}>
        <title>{`${d.label}: ${val.toFixed(1)}%`}</title>
      </path>
    )
  })
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{sectores}</svg>
}

export default function CarteraObjetivo() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [tab, setTab]           = useState('definicion') // 'definicion' | 'comparacion'
  const [datos, setDatos]       = useState(null)         // { perfil: { dim: { cat: {piso,optimo,tope} } } }
  const [perfil, setPerfil]     = useState('conservadora')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]   = useState(null)
  const [actualizado, setActualizado] = useState(null)

  // Comparación
  const [comp, setComp]                 = useState(null)
  const [cargandoComp, setCargandoComp] = useState(false)
  const [errorComp, setErrorComp]       = useState(null)

  // ── Definición ──────────────────────────────────────────────
  const construirMapa = (data) => {
    const map = {}
    for (const pf of PERFILES) {
      map[pf.v] = {}
      for (const dim of DIMENSIONES) {
        map[pf.v][dim.v] = {}
        const arr = data?.[pf.v]?.[dim.v] || []
        const porCat = {}
        for (const row of arr) porCat[row.categoria] = row
        for (const cat of dim.cats) {
          const r = porCat[cat.v]
          map[pf.v][dim.v][cat.v] = {
            piso:   r ? n(r.piso)   : 0,
            optimo: r ? n(r.optimo) : 0,
            tope:   r ? n(r.tope)   : 100,
          }
        }
      }
    }
    return map
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    setMensaje(null)
    try {
      const res  = await authFetch('/api/cartera/carteras-objetivo')
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Error al cargar')
      setDatos(construirMapa(json.data || {}))
      setActualizado(json.actualizado || null)
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setCargando(false)
    }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  // ── Comparación ─────────────────────────────────────────────
  const cargarComparacion = useCallback(async () => {
    setCargandoComp(true)
    setErrorComp(null)
    try {
      const res  = await authFetch(`/api/cartera/carteras-objetivo/comparacion?perfil=${perfil}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Error al cargar la comparación')
      setComp(json)
    } catch (e) {
      setErrorComp(e.message)
      setComp(null)
    } finally {
      setCargandoComp(false)
    }
  }, [authFetch, perfil])

  useEffect(() => {
    if (tab === 'comparacion') cargarComparacion()
  }, [tab, cargarComparacion])

  const setCelda = (dim, cat, campo, valor) => {
    setDatos(prev => ({
      ...prev,
      [perfil]: {
        ...prev[perfil],
        [dim]: {
          ...prev[perfil][dim],
          [cat]: { ...prev[perfil][dim][cat], [campo]: valor },
        },
      },
    }))
  }

  const guardar = async () => {
    if (!datos) return
    const cambios = []
    for (const dim of DIMENSIONES) {
      for (const cat of dim.cats) {
        const b = datos[perfil][dim.v][cat.v]
        const piso = n(b.piso), optimo = n(b.optimo), tope = n(b.tope)
        for (const [k, val] of [['piso', piso], ['óptimo', optimo], ['tope', tope]]) {
          if (val < 0 || val > 100) {
            return setMensaje({ tipo: 'error', texto: `${dim.l} · ${cat.l}: ${k} fuera de rango (0–100)` })
          }
        }
        if (!(piso <= optimo && optimo <= tope)) {
          return setMensaje({ tipo: 'error', texto: `${dim.l} · ${cat.l}: debe cumplirse piso ≤ óptimo ≤ tope` })
        }
        cambios.push({ perfil, dimension: dim.v, categoria: cat.v, piso, optimo, tope })
      }
    }

    setGuardando(true)
    setMensaje(null)
    try {
      const res  = await authFetch('/api/cartera/carteras-objetivo', {
        method: 'PUT',
        body: JSON.stringify({ cambios }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Error al guardar')
      const pf = PERFILES.find(p => p.v === perfil)?.l || perfil
      setMensaje({ tipo: 'ok', texto: `Cartera ${pf} guardada (${json.guardados} filas)` })
      if (tab === 'comparacion') cargarComparacion()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const perfilActual = PERFILES.find(p => p.v === perfil)
  const recargar = () => (tab === 'comparacion' ? cargarComparacion() : cargar())

  if (cargando) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🎯 Cartera Objetivo</h1>
          <p className="text-sm text-gray-400 mt-1">
            {tab === 'definicion'
              ? 'Bandas piso / óptimo / tope por dimensión · el óptimo de cada dimensión debería sumar 100%'
              : 'Tu tenencia real (base USD) contra el objetivo del perfil elegido'}
          </p>
        </div>
        <button onClick={recargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻ Recargar</button>
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Selector de perfil (compartido entre pestañas) */}
      <div className="flex gap-3">
        {PERFILES.map(p => (
          <button key={p.v}
            onClick={() => { setPerfil(p.v); setMensaje(null) }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
              perfil === p.v ? 'text-white' : 'border-gray-200 text-gray-400 hover:bg-gray-50'
            }`}
            style={perfil === p.v ? { backgroundColor: p.color, borderColor: p.color } : {}}>
            {p.l}
          </button>
        ))}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['definicion', 'Definición'], ['comparacion', 'Comparación']].map(([v, l]) => (
          <button key={v}
            onClick={() => { setTab(v); setMensaje(null) }}
            className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors ${
              tab === v ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* ════════ PESTAÑA DEFINICIÓN ════════ */}
      {tab === 'definicion' && datos && (
        <>
          {DIMENSIONES.map(dim => {
            const filas = datos[perfil][dim.v]
            const sumaOptimo = dim.cats.reduce((s, c) => s + n(filas[c.v].optimo), 0)
            const suma100 = Math.abs(sumaOptimo - 100) < 0.01
            return (
              <div key={dim.v} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-700">{dim.l}</h2>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    suma100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    Óptimo: {sumaOptimo.toFixed(1)}%{suma100 ? ' ✓' : ` (${sumaOptimo > 100 ? 'excede' : 'faltan'} ${Math.abs(100 - sumaOptimo).toFixed(1)}%)`}
                  </span>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-28">Piso %</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-28">Óptimo %</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-28">Tope %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dim.cats.map(cat => {
                      const b = filas[cat.v]
                      const piso = n(b.piso), optimo = n(b.optimo), tope = n(b.tope)
                      const ordenOk = piso <= optimo && optimo <= tope
                      const inputCls = (bad) =>
                        `w-full border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none ${
                          bad ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-gray-200 focus:border-indigo-400'
                        }`
                      return (
                        <tr key={cat.v} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-600">{cat.l}</td>
                          <td className="px-4 py-2">
                            <input type="number" step="any" min="0" max="100" disabled={!esAdmin}
                              value={b.piso}
                              onChange={e => setCelda(dim.v, cat.v, 'piso', e.target.value)}
                              className={inputCls(!ordenOk)} />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" step="any" min="0" max="100" disabled={!esAdmin}
                              value={b.optimo}
                              onChange={e => setCelda(dim.v, cat.v, 'optimo', e.target.value)}
                              className={inputCls(!ordenOk)} />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" step="any" min="0" max="100" disabled={!esAdmin}
                              value={b.tope}
                              onChange={e => setCelda(dim.v, cat.v, 'tope', e.target.value)}
                              className={inputCls(!ordenOk)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}

          {esAdmin && (
            <div className="flex items-center justify-between sticky bottom-0 bg-white/90 backdrop-blur border-t border-gray-100 py-3 -mx-2 px-2">
              <span className="text-xs text-gray-400">
                {actualizado ? `Última actualización: ${new Date(actualizado).toLocaleString('es-AR')}` : 'Sin cambios guardados todavía'}
              </span>
              <button onClick={guardar} disabled={guardando}
                className="px-6 py-2.5 text-white rounded-lg font-semibold disabled:opacity-60"
                style={{ backgroundColor: perfilActual?.color || '#4F6EF7' }}>
                {guardando ? 'Guardando...' : `Guardar cartera ${perfilActual?.l || ''}`}
              </button>
            </div>
          )}

          {!esAdmin && (
            <p className="text-xs text-gray-400 text-center">Solo un administrador puede editar la cartera objetivo.</p>
          )}
        </>
      )}

      {/* ════════ PESTAÑA COMPARACIÓN ════════ */}
      {tab === 'comparacion' && (
        <>
          {cargandoComp && (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          {errorComp && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">⚠️ {errorComp}</div>
          )}

          {!cargandoComp && !errorComp && comp && (
            <>
              {/* Resumen */}
              <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Patrimonio (base USD)</p>
                  <p className="font-bold text-gray-800">USD {n(comp.base_total_usd).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                </div>
                {comp.fecha_cierre && (
                  <div>
                    <p className="text-xs text-gray-400">Datos al</p>
                    <p className="font-bold text-gray-800">{new Date(comp.fecha_cierre).toLocaleDateString('es-AR')}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Comparando contra</p>
                  <p className="font-bold" style={{ color: perfilActual?.color }}>{perfilActual?.l}</p>
                </div>
              </div>

              {DIMENSIONES.map(dim => {
                const d = comp.dimensiones?.[dim.v]
                if (!d) return null
                const dataOpt  = d.filas.map((f, i) => ({ valor: n(f.optimo), color: PALETA[i % PALETA.length], label: LABELS[dim.v]?.[f.categoria] || f.categoria }))
                const dataReal = d.filas.map((f, i) => ({ valor: n(f.real),   color: PALETA[i % PALETA.length], label: LABELS[dim.v]?.[f.categoria] || f.categoria }))
                return (
                  <div key={dim.v} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <h2 className="font-semibold text-gray-700 truncate">{dim.l}</h2>
                        {d.sin_clasificar > 0 && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                            ⚠️ {d.sin_clasificar.toFixed(1)}% sin clasificar
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">Óptimo</p>
                          <MiniTorta datos={dataOpt} />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">Real</p>
                          <MiniTorta datos={dataReal} />
                        </div>
                      </div>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-40">Real vs rango</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Real</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Óptimo</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Desvío</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {d.filas.map((f, i) => {
                          const al = ALERTA[f.alerta] || ALERTA.ok
                          const desvio = f.desvio
                          return (
                            <tr key={f.categoria} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-600">
                                <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ backgroundColor: PALETA[i % PALETA.length] }} />
                                {LABELS[dim.v]?.[f.categoria] || f.categoria}
                              </td>
                              <td className="px-4 py-2">
                                <BarraRango real={f.real} piso={f.piso} optimo={f.optimo} tope={f.tope} color={al.barra} />
                              </td>
                              <td className="px-4 py-2 text-sm text-center font-semibold text-gray-800">{n(f.real).toFixed(1)}%</td>
                              <td className="px-4 py-2 text-sm text-center text-gray-500">{f.optimo !== null ? `${n(f.optimo).toFixed(1)}%` : '—'}</td>
                              <td className="px-4 py-2 text-sm text-center font-semibold"
                                style={{ color: desvio === null ? '#999' : desvio > 0 ? '#16a085' : desvio < 0 ? '#c5183c' : '#666' }}>
                                {desvio === null ? '—' : `${desvio > 0 ? '+' : ''}${desvio.toFixed(1)}%`}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${al.chip}`}>{al.label}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}

              {/* Referencia */}
              <p className="text-xs text-gray-400 px-1">
                Barra: zona verde = rango piso–tope · línea gris = óptimo · marca de color = tu tenencia real.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
