// Watchlist
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 0) {
  return parseFloat(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec })
}

export default function Watchlist() {
  const { authFetch } = useAuth()
  const [watchlist, setWatchlist] = useState([])
  const [cargando, setCargando]   = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res  = await authFetch('/api/cartera/watchlist')
      const data = await res.json()
      setWatchlist(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">👁️ Watchlist</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : watchlist.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay instrumentos en seguimiento
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Ticker', 'Descripción', 'Tipo', 'Precio ARS', 'Precio USD', 'TIR', 'Duration', 'Volumen', 'Fecha precio'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {watchlist.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-white px-2 py-1 rounded bg-indigo-500">{item.ticker}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.descripcion}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{item.tipo?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{item.precio_cierre_ars ? `$${fmt(item.precio_cierre_ars)}` : '-'}</td>
                  <td className="px-4 py-3 text-sm">USD {item.precio_cierre_usd ? parseFloat(item.precio_cierre_usd).toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#b5700a' }}>{item.tir ? `${parseFloat(item.tir).toFixed(2)}%` : '-'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#b5700a' }}>{item.duration ? parseFloat(item.duration).toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{item.volumen_operado ? `$${(parseFloat(item.volumen_operado)/1e6).toFixed(1)}M` : '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{item.fecha_precio ? new Date(item.fecha_precio).toLocaleDateString('es-AR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
