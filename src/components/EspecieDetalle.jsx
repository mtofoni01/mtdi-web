// components/EspecieDetalle.jsx
// Panel de detalle reutilizable para Cartera y Watchlist
// Muestra gráfico de precios históricos y volumen con selector de fechas

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

const AZUL = '#4F6EF7'

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

// Fecha de hace N días en formato YYYY-MM-DD
function fechaHaceNDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function hoy() {
  return new Date().toISOString().split('T')[0]
}

const RANGOS = [
  { label: '30d',  dias: 30 },
  { label: '90d',  dias: 90 },
  { label: '180d', dias: 180 },
  { label: '1a',   dias: 365 },
  { label: 'Todo', dias: null },
]

export default function EspecieDetalle({ ticker, datosBasicos, onCerrar }) {
  const { authFetch } = useAuth()
  const [historial, setHistorial]   = useState([])
  const [especie, setEspecie]       = useState(null)
  const [posicion, setPosicion]     = useState(null)
  const [cargando, setCargando]     = useState(false)
  const [rangoActivo, setRangoActivo] = useState('90d')
  const [desde, setDesde]           = useState(fechaHaceNDias(90))
  const [hasta, setHasta]           = useState(hoy())
  const [moneda, setMoneda]         = useState('ARS')

  const cargar = useCallback(async (desdeVal, hastaVal) => {
    if (!ticker) return
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (desdeVal) params.set('desde', desdeVal)
      if (hastaVal) params.set('hasta', hastaVal)
      const res  = await authFetch(`/api/cartera/posiciones/${ticker}?${params}`)
      const data = await res.json()
      if (data.ok) {
        setHistorial(data.data.historial || [])
        setEspecie(data.data.especie)
        setPosicion(data.data.posicion)
      }
    } catch {}
    finally { setCargando(false) }
  }, [ticker, authFetch])

  useEffect(() => {
    cargar(desde, hasta)
  }, [ticker])

  const aplicarRango = (rango) => {
    setRangoActivo(rango.label)
    if (rango.dias === null) {
      // Todo el historial — sin filtro de fecha desde
      setDesde('')
      setHasta(hoy())
      cargar('', hoy())
    } else {
      const d = fechaHaceNDias(rango.dias)
      const h = hoy()
      setDesde(d)
      setHasta(h)
      cargar(d, h)
    }
  }

  const aplicarFechasCustom = () => {
    setRangoActivo('custom')
    cargar(desde, hasta)
  }

  // Datos para los gráficos
  const grafPrecios = historial.map(p => ({
    fecha:  new Date(p.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    ars:    parseFloat(p.precio_cierre_ars || 0),
    usd:    parseFloat(p.precio_cierre_usd || 0),
  }))

  const grafVolumen = historial
    .filter(p => p.volumen_operado)
    .map(p => ({
      fecha:   new Date(p.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      volumen: parseFloat(p.volumen_operado || 0),
    }))

  const esp = especie || datosBasicos

  return (
    <div className="w-96 bg-white rounded-xl border border-gray-100 flex flex-col max-h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white px-2 py-1 rounded bg-indigo-500">
            {ticker}
          </span>
          <span className="text-sm text-gray-500 truncate max-w-48">{esp?.descripcion}</span>
        </div>
        <button onClick={onCerrar} className="text-gray-300 hover:text-gray-500 text-lg">✕</button>
      </div>

      <div className="p-4 space-y-4">

        {/* Datos rápidos */}
        {esp && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: 'Tipo',     v: esp.tipo?.replace(/_/g, ' ') },
              { l: 'Moneda',   v: esp.moneda },
              { l: 'TIR',      v: datosBasicos?.tir ? `${parseFloat(datosBasicos.tir).toFixed(2)}%` : '-' },
              { l: 'Duration', v: datosBasicos?.duration ? `${parseFloat(datosBasicos.duration).toFixed(2)}` : '-' },
              { l: 'P. ARS',   v: datosBasicos?.precio_cierre_ars ? `$${fmt(datosBasicos.precio_cierre_ars)}` : '-' },
              { l: 'P. USD',   v: datosBasicos?.precio_cierre_usd ? `${parseFloat(datosBasicos.precio_cierre_usd).toFixed(2)}` : '-' },
              ...(posicion ? [
                { l: 'VN',       v: fmt(posicion.vn_actual) },
                { l: 'P. Compra', v: parseFloat(posicion.precio_promedio || 0).toFixed(2) },
              ] : []),
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-xs text-gray-400">{l}</p>
                <p className="text-sm font-semibold text-gray-800">{v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Selector de rango */}
        <div className="space-y-2">
          <div className="flex gap-1">
            {RANGOS.map(r => (
              <button
                key={r.label}
                onClick={() => aplicarRango(r)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  rangoActivo === r.label
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Fechas custom */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
            />
            <span className="text-xs text-gray-400">→</span>
            <input
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
            />
            <button
              onClick={aplicarFechasCustom}
              className="text-xs px-2 py-1 bg-indigo-50 text-indigo-500 border border-indigo-200 rounded hover:bg-indigo-100"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Toggle ARS/USD */}
        <div className="flex gap-2">
          {['ARS', 'USD'].map(m => (
            <button
              key={m}
              onClick={() => setMoneda(m)}
              className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                moneda === m
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : historial.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Sin datos para el período seleccionado
          </div>
        ) : (
          <>
            {/* Gráfico de precios */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Precio {moneda} — {historial.length} registros
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={grafPrecios}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontSize: 9 }}
                    interval={Math.floor(grafPrecios.length / 5)}
                  />
                  <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} width={45} />
                  <Tooltip
                    formatter={(v) => [
                      moneda === 'ARS' ? `$${fmt(v)}` : `USD ${parseFloat(v).toFixed(2)}`,
                      moneda
                    ]}
                    labelStyle={{ fontSize: 11 }}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={moneda === 'ARS' ? 'ars' : 'usd'}
                    stroke={AZUL}
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de volumen */}
            {grafVolumen.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Volumen operado</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={grafVolumen}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 9 }}
                      interval={Math.floor(grafVolumen.length / 5)}
                    />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      width={45}
                      tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v}
                    />
                    <Tooltip
                      formatter={(v) => [abreviarVol(v), 'Volumen']}
                      labelStyle={{ fontSize: 11 }}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="volumen" fill={AZUL} opacity={0.7} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabla historial últimos 10 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Últimos registros</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {[...historial].reverse().slice(0, 15).map((p, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-500 py-1 border-b border-gray-50">
                    <span>{new Date(p.fecha).toLocaleDateString('es-AR')}</span>
                    <span className="font-semibold">${fmt(p.precio_cierre_ars)}</span>
                    <span className="text-indigo-500">USD {parseFloat(p.precio_cierre_usd || 0).toFixed(2)}</span>
                    {p.tir && <span style={{ color: '#b5700a' }}>{parseFloat(p.tir).toFixed(2)}%</span>}
                    {p.volumen_operado && <span className="text-gray-400">{abreviarVol(p.volumen_operado)}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
