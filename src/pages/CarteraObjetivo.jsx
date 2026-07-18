// pages/CarteraObjetivo.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

// Perfiles de cartera
const PERFILES = [
  { v: 'conservadora', l: 'Conservadora', color: '#16a085' },
  { v: 'media',        l: 'Media',        color: '#e67e22' },
  { v: 'agresiva',     l: 'Agresiva',     color: '#c5183c' },
]

// Dimensiones y sus categorías, en orden de presentación.
// Los códigos (v) coinciden con la tabla carteras_objetivo.
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

const n = (x) => {
  const v = parseFloat(x)
  return Number.isFinite(v) ? v : 0
}

export default function CarteraObjetivo() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [datos, setDatos]       = useState(null)   // { perfil: { dim: { cat: {piso,optimo,tope} } } }
  const [perfil, setPerfil]     = useState('conservadora')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]   = useState(null)
  const [actualizado, setActualizado] = useState(null)

  // Construye el mapa editable completo, rellenando faltantes con 0/0/100
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
    // Validación previa en el front (el backend re-valida igual)
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
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const perfilActual = PERFILES.find(p => p.v === perfil)

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
            Bandas piso / óptimo / tope por dimensión · el óptimo de cada dimensión debería sumar 100%
          </p>
        </div>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻ Recargar</button>
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Selector de perfil */}
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

      {/* Dimensiones */}
      {datos && DIMENSIONES.map(dim => {
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

      {/* Guardar */}
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
    </div>
  )
}
