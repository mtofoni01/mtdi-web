import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 0) {
  return parseFloat(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec })
}

export default function Depositos() {
  const { authFetch, usuario } = useAuth()
  const [depositos, setDepositos] = useState([])
  const [cargando, setCargando]   = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const url = usuario?.rol === 'admin' ? '/api/cartera/depositos?todos=true' : '/api/cartera/depositos'
      const res  = await authFetch(url)
      const data = await res.json()
      setDepositos(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, usuario])

  useEffect(() => { cargar() }, [cargar])

  const totalARS = depositos.filter(d => d.moneda === 'ARS').reduce((s, d) => s + parseFloat(d.valor_actual || 0), 0)
  const totalUSD = depositos.filter(d => d.moneda === 'USD').reduce((s, d) => s + parseFloat(d.valor_actual || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🏦 Depósitos a plazo</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-600 rounded-xl p-5 text-white">
          <p className="text-indigo-200 text-sm">Total ARS</p>
          <p className="text-2xl font-bold mt-1">${fmt(totalARS)}</p>
        </div>
        <div className="bg-indigo-500 rounded-xl p-5 text-white">
          <p className="text-indigo-200 text-sm">Total USD</p>
          <p className="text-2xl font-bold mt-1">USD {fmt(totalUSD, 2)}</p>
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Ticker', 'Capital', 'Moneda', 'TNA', 'Inicio', 'Vencimiento', 'Días', 'Int. Devengado', 'Valor actual', 'Int. Total', 'Custodio', 'Estado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {depositos.map((d, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${d.vencido ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-white px-2 py-1 rounded bg-amber-600">{d.ticker}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">${fmt(d.capital)}</td>
                  <td className="px-4 py-3 text-sm">{d.moneda}</td>
                  <td className="px-4 py-3 text-sm">{parseFloat(d.tna).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.fecha_inicio).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(d.fecha_vto).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-sm">{d.dias_transcurridos}/{d.dias_plazo}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">+${fmt(d.interes_devengado)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-indigo-600">${fmt(d.valor_actual)}</td>
                  <td className="px-4 py-3 text-xs text-green-500">+${fmt(d.interes_total)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{d.custodio_nombre || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${d.vencido ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {d.vencido ? '⚠️ Vencido' : '✓ Activo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
