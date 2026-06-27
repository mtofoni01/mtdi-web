import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 0) { return parseFloat(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec }) }

export default function Gastos() {
  const { authFetch, usuario } = useAuth()
  const [gastos, setGastos]   = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const url = usuario?.rol === 'admin' ? '/api/gastos?todos=true' : '/api/gastos'
      const res  = await authFetch(url)
      const data = await res.json()
      setGastos(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, usuario])

  useEffect(() => { cargar() }, [cargar])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return
    try { await authFetch(`/api/gastos/${id}`, { method: 'DELETE' }); cargar() } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">💸 Gastos</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Fecha', 'Concepto', 'Importe', 'Moneda', 'Documento', 'Usuario', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {gastos.map((g, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(g.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-sm">{g.concepto}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-red-500">- {g.moneda} {fmt(g.importe)}</td>
                  <td className="px-4 py-3 text-xs">{g.moneda}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{g.doc_tipo ? `${g.doc_tipo} ${g.doc_numero ? 'N°'+g.doc_numero : ''} - ${g.proveedor || ''}` : '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{g.usuario_nombre || '-'}</td>
                  <td className="px-4 py-3">
                    {usuario?.rol === 'admin' && (
                      <button onClick={() => eliminar(g.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                    )}
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
