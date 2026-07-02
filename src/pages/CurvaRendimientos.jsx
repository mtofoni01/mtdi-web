// pages/CurvaRendimientos.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const COLORES_TIPO = {
  bono_usd:  '#4F6EF7',
  bono_ars:  '#e67e22',
  bono_cer:  '#27ae60',
  bono_dv:   '#8e44ad',
  letra_ars: '#e74c3c',
  letra_usd: '#2980b9',
  on:        '#16a085',
}

const LABEL_TIPO = {
  bono_usd:  'Bono USD',
  bono_ars:  'Bono ARS',
  bono_cer:  'Bono CER',
  bono_dv:   'Dollar Linked',
  letra_ars: 'LECAP',
  letra_usd: 'LETE',
  on:        'ON',
}

// ── Regresión polinómica grado 2 (mínimos cuadrados) ──────────────
// Resuelve el sistema [a, b, c] tal que y ≈ a·x² + b·x + c
function polyReg2(puntos) {
  const n  = puntos.length
  if (n < 3) return null

  const x  = puntos.map(p => p.duration)
  const y  = puntos.map(p => p.tir)

  // Sumatoria de potencias de x
  const s0  = n
  const s1  = x.reduce((a, v) => a + v, 0)
  const s2  = x.reduce((a, v) => a + v ** 2, 0)
  const s3  = x.reduce((a, v) => a + v ** 3, 0)
  const s4  = x.reduce((a, v) => a + v ** 4, 0)
  const t0  = y.reduce((a, v) => a + v, 0)
  const t1  = x.reduce((a, v, i) => a + v * y[i], 0)
  const t2  = x.reduce((a, v, i) => a + v ** 2 * y[i], 0)

  // Matriz 3x3 (método de Cramer simplificado con eliminación gaussiana)
  let M = [
    [s4, s3, s2, t2],
    [s3, s2, s1, t1],
    [s2, s1, s0, t0],
  ]

  for (let col = 0; col < 3; col++) {
    // Pivoteo parcial
    let maxRow = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]

    if (Math.abs(M[col][col]) < 1e-10) return null

    for (let row = 0; row < 3; row++) {
      if (row === col) continue
      const factor = M[row][col] / M[col][col]
      for (let k = col; k <= 3; k++) M[row][k] -= factor * M[col][k]
    }
  }

  const a = M[0][3] / M[0][0]
  const b = M[1][3] / M[1][1]
  const c = M[2][3] / M[2][2]

  return (xVal) => a * xVal ** 2 + b * xVal + c
}

function ScatterChart({ puntos, titulo }) {
  const svgRef   = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const W = 680, H = 360
  const PAD = { top: 30, right: 30, bottom: 50, left: 60 }

  if (!puntos || puntos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
        Sin datos para {titulo}
      </div>
    )
  }

  const duraciones = puntos.map(p => p.duration)
  const tires      = puntos.map(p => p.tir)

  const minDur = Math.max(0, Math.min(...duraciones) - 0.3)
  const maxDur = Math.max(...duraciones) + 0.3
  const minTir = Math.max(0, Math.min(...tires) - 2)
  const maxTir = Math.max(...tires) + 2

  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top  - PAD.bottom

  const xScale = v => PAD.left + ((v - minDur) / (maxDur - minDur)) * chartW
  const yScale = v => PAD.top  + chartH - ((v - minTir) / (maxTir - minTir)) * chartH

  // Calcular curva de regresión
  const regFn = polyReg2(puntos)
  const curvePath = (() => {
    if (!regFn) return null
    const steps = 80
    const points = []
    for (let i = 0; i <= steps; i++) {
      const xVal = minDur + (i / steps) * (maxDur - minDur)
      const yVal = regFn(xVal)
      if (yVal < minTir - 5 || yVal > maxTir + 5) continue // clip extremos
      points.push(`${xScale(xVal).toFixed(1)},${yScale(yVal).toFixed(1)}`)
    }
    if (points.length < 2) return null
    return 'M' + points.join(' L')
  })()

  // Grillas
  const xTicks = 5
  const yTicks = 5
  const xStep  = (maxDur - minDur) / xTicks
  const yStep  = (maxTir - minTir) / yTicks

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h3 className="text-base font-semibold text-gray-700 mb-3 text-center">{titulo}</h3>
      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 380 }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grilla horizontal */}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const val = minTir + i * yStep
            const y   = yScale(val)
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="#f0f0f0" strokeWidth="1" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end"
                  fontSize="11" fill="#999">{val.toFixed(1)}%</text>
              </g>
            )
          })}

          {/* Grilla vertical */}
          {Array.from({ length: xTicks + 1 }, (_, i) => {
            const val = minDur + i * xStep
            const x   = xScale(val)
            return (
              <g key={i}>
                <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom}
                  stroke="#f0f0f0" strokeWidth="1" />
                <text x={x} y={H - PAD.bottom + 16} textAnchor="middle"
                  fontSize="11" fill="#999">{val.toFixed(1)}</text>
              </g>
            )
          })}

          {/* Ejes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
            stroke="#ddd" strokeWidth="1.5" />
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
            stroke="#ddd" strokeWidth="1.5" />

          {/* Labels ejes */}
          <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#888">
            Duration Modificada (años)
          </text>
          <text
            x={14} y={H / 2} textAnchor="middle" fontSize="12" fill="#888"
            transform={`rotate(-90, 14, ${H / 2})`}
          >
            TIR (%)
          </text>

          {/* Curva de regresión polinómica grado 2 */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke="#4F6EF7"
              strokeWidth="2"
              strokeDasharray="6 3"
              opacity="0.5"
            />
          )}

          {/* Puntos */}
          {puntos.map((p, i) => {
            const cx = xScale(p.duration)
            const cy = yScale(p.tir)
            const color = COLORES_TIPO[p.tipo] || '#4F6EF7'
            return (
              <g key={i}
                onMouseEnter={e => setTooltip({ ...p, cx, cy })}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.85} />
                <text x={cx} y={cy - 12} textAnchor="middle"
                  fontSize="10" fontWeight="600" fill={color}>
                  {p.ticker}
                </text>
              </g>
            )
          })}

          {/* Tooltip */}
          {tooltip && (() => {
            const bx = Math.min(tooltip.cx + 12, W - 160)
            const by = Math.max(tooltip.cy - 70, PAD.top)
            return (
              <g>
                <rect x={bx} y={by} width={150} height={68}
                  rx="6" fill="white" stroke="#e0e0e0" strokeWidth="1"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
                <text x={bx + 10} y={by + 18} fontSize="12" fontWeight="700"
                  fill={COLORES_TIPO[tooltip.tipo] || '#333'}>{tooltip.ticker}</text>
                <text x={bx + 10} y={by + 33} fontSize="10" fill="#666">
                  {tooltip.descripcion?.slice(0, 22)}
                </text>
                <text x={bx + 10} y={by + 48} fontSize="11" fill="#333">
                  TIR: <tspan fontWeight="600">{parseFloat(tooltip.tir).toFixed(2)}%</tspan>
                </text>
                <text x={bx + 10} y={by + 63} fontSize="11" fill="#333">
                  MD: <tspan fontWeight="600">{parseFloat(tooltip.duration).toFixed(2)} años</tspan>
                </text>
              </g>
            )
          })()}
        </svg>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {[...new Set(puntos.map(p => p.tipo))].map(tipo => (
          <div key={tipo} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORES_TIPO[tipo] || '#999' }} />
            <span className="text-xs text-gray-500">{LABEL_TIPO[tipo] || tipo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CurvaRendimientos() {
  const { authFetch }   = useAuth()
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res  = await authFetch('/api/cartera/curva-rendimientos')
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Error al cargar')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  const fecha = data?.fecha
    ? new Date(data.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📉 Curva de Rendimientos</h1>
          {fecha && <p className="text-sm text-gray-400 mt-1">Datos al {fecha} — instrumentos en seguimiento</p>}
        </div>
        <button
          onClick={cargar}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >↻ Actualizar</button>
      </div>

      {/* Estados */}
      {cargando && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
          ⚠️ {error}
        </div>
      )}

      {!cargando && !error && data && (
        <div className="space-y-6">
          {/* Resumen badges */}
          <div className="flex gap-4">
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center gap-3">
              <span className="text-2xl">🇦🇷</span>
              <div>
                <p className="text-xs text-gray-400">Títulos en Pesos</p>
                <p className="text-xl font-bold text-gray-800">{data.pesos.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center gap-3">
              <span className="text-2xl">🇺🇸</span>
              <div>
                <p className="text-xs text-gray-400">Títulos en Dólares</p>
                <p className="text-xl font-bold text-gray-800">{data.dolares.length}</p>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <ScatterChart puntos={data.pesos}   titulo="Curva de Rendimientos — Títulos en Pesos (ARS)" />
          <ScatterChart puntos={data.dolares} titulo="Curva de Rendimientos — Títulos en Dólares (USD)" />

          {/* Tablas */}
          {[
            { titulo: '🇦🇷 Títulos en Pesos', puntos: data.pesos },
            { titulo: '🇺🇸 Títulos en Dólares', puntos: data.dolares },
          ].map(({ titulo, puntos }) => puntos.length > 0 && (
            <div key={titulo} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-700">{titulo}</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Ticker', 'Descripción', 'Tipo', 'TIR', 'Duration (MD)'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...puntos].sort((a, b) => a.duration - b.duration).map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-white px-2 py-1 rounded"
                          style={{ backgroundColor: COLORES_TIPO[p.tipo] || '#4F6EF7' }}>
                          {p.ticker}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.descripcion}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{LABEL_TIPO[p.tipo] || p.tipo}</td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#b5700a' }}>
                        {parseFloat(p.tir).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#b5700a' }}>
                        {parseFloat(p.duration).toFixed(2)} años
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
