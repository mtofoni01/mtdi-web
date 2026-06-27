import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 0) {
  return parseFloat(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec })
}

export default function Saldo() {
  const { authFetch, usuario } = useAuth()
  const [saldo, setSaldo]     = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res  = await authFetch('/api/saldo')
      const data = await res.json()
      setSaldo(data.data)
    } catch {}
    finally { setCargando(false) }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  if (cargando) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>

  const bloques = [
    { titulo: 'Presupuesto ARS', monto: saldo?.presupuesto_ars, disponible: saldo?.saldo_disponible_ars, moneda: 'ARS',
      items: [
        { l: 'Inversiones', v: saldo?.total_compras_ars, neg: true },
        { l: 'Comisiones', v: saldo?.total_comisiones_ars, neg: true },
        { l: 'Gastos', v: saldo?.total_gastos_ars, neg: true },
        { l: 'Recuperos', v: saldo?.total_recuperos_ars, neg: false },
      ]
    },
    { titulo: 'Presupuesto USD', monto: saldo?.presupuesto_usd, disponible: saldo?.saldo_disponible_usd, moneda: 'USD',
      items: [
        { l: 'Inversiones', v: saldo?.total_compras_usd, neg: true },
        { l: 'Comisiones', v: saldo?.total_comisiones_usd, neg: true },
        { l: 'Gastos', v: saldo?.total_gastos_usd, neg: true },
        { l: 'Recuperos', v: saldo?.total_recuperos_usd, neg: false },
      ]
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">💰 Mi saldo</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {bloques.map(b => (
          <div key={b.titulo} className="space-y-3">
            <div className="bg-indigo-600 rounded-xl p-5 text-white">
              <p className="text-indigo-200 text-sm">{b.titulo}</p>
              <p className="text-2xl font-bold mt-1">{b.moneda} {fmt(b.monto, b.moneda === 'USD' ? 2 : 0)}</p>
              <div className="mt-3 pt-3 border-t border-indigo-500">
                <p className="text-indigo-200 text-xs">Disponible</p>
                <p className={`text-xl font-bold ${parseFloat(b.disponible || 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {b.moneda} {fmt(b.disponible, b.moneda === 'USD' ? 2 : 0)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {b.items.map(item => (
                <div key={item.l} className="flex justify-between px-5 py-3">
                  <span className="text-sm text-gray-500">{item.l}</span>
                  <span className={`text-sm font-semibold ${item.neg ? 'text-red-500' : 'text-green-500'}`}>
                    {item.neg ? '-' : '+'} {b.moneda} {fmt(item.v, b.moneda === 'USD' ? 2 : 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
