import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 0) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function Saldo() {
  const { authFetch, usuario } = useAuth()
  const [saldo, setSaldo]       = useState(null)
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

  // Egresos (restan) e ingresos (suman) con sus labels
  const EGRESOS = [
    { key: 'inversiones',  label: '📉 Inversiones',           desc: 'Compras de títulos y suscripciones FCI' },
    { key: 'colocaciones', label: '🔒 Colocaciones',          desc: 'Depósitos a plazo y a la vista' },
    { key: 'comisiones',   label: '💹 Comisiones',            desc: 'Comisiones de operaciones' },
    { key: 'gastos',       label: '💸 Gastos',                desc: 'Gastos imputados' },
    { key: 'retiros',      label: '⬇️ Retiros de capital',     desc: 'Retiros al exterior' },
    { key: 'pase_egreso',  label: '🔄 Pases (egreso)',        desc: 'Conversión de moneda saliente' },
  ]
  const INGRESOS = [
    { key: 'aportes',      label: '⬆️ Aportes de capital',     desc: 'Aportes desde el exterior' },
    { key: 'ventas',       label: '📈 Ventas y rescates',     desc: 'Ventas de títulos y rescates FCI' },
    { key: 'cobros',       label: '💰 Cobros',                desc: 'Cupones, amortizaciones y vencimientos' },
    { key: 'liberaciones', label: '🔓 Liberaciones',          desc: 'Extracciones de cuenta a la vista' },
    { key: 'pase_ingreso', label: '🔄 Pases (ingreso)',       desc: 'Conversión de moneda entrante' },
  ]

  const bloques = [
    { titulo: 'Presupuesto ARS', moneda: 'ARS', d: saldo?.ars, dec: 0 },
    { titulo: 'Presupuesto USD', moneda: 'USD', d: saldo?.usd, dec: 2 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">💰 Mi saldo</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {bloques.map(b => {
          const d = b.d || {}
          const totalEgresos = EGRESOS.reduce((s, e) => s + parseFloat(d[e.key] || 0), 0)
          const totalIngresos = INGRESOS.reduce((s, i) => s + parseFloat(d[i.key] || 0), 0)
          return (
            <div key={b.titulo} className="space-y-3">
              {/* Header presupuesto + disponible */}
              <div className="bg-indigo-600 rounded-xl p-5 text-white">
                <p className="text-indigo-200 text-sm">{b.titulo}</p>
                <p className="text-2xl font-bold mt-1">{b.moneda} {fmt(d.presupuesto, b.dec)}</p>
                <div className="mt-3 pt-3 border-t border-indigo-500">
                  <p className="text-indigo-200 text-xs">Disponible</p>
                  <p className={`text-2xl font-bold ${parseFloat(d.saldo || 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {b.moneda} {fmt(d.saldo, b.dec)}
                  </p>
                </div>
              </div>

              {/* Ingresos */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-2 bg-green-50 border-b border-green-100">
                  <p className="text-xs font-semibold text-green-700 uppercase">Ingresos (+)</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {INGRESOS.map(item => {
                    const val = parseFloat(d[item.key] || 0)
                    if (val === 0) return null
                    return (
                      <div key={item.key} className="flex justify-between items-center px-5 py-2.5" title={item.desc}>
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <span className="text-sm font-semibold text-green-600">+ {b.moneda} {fmt(val, b.dec)}</span>
                      </div>
                    )
                  })}
                  {totalIngresos === 0 && <div className="px-5 py-3 text-xs text-gray-300 text-center">Sin ingresos</div>}
                </div>
                {totalIngresos > 0 && (
                  <div className="flex justify-between px-5 py-2 bg-green-50 border-t border-green-100">
                    <span className="text-xs font-semibold text-green-700">Total ingresos</span>
                    <span className="text-sm font-bold text-green-700">+ {b.moneda} {fmt(totalIngresos, b.dec)}</span>
                  </div>
                )}
              </div>

              {/* Egresos */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-2 bg-red-50 border-b border-red-100">
                  <p className="text-xs font-semibold text-red-600 uppercase">Egresos (−)</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {EGRESOS.map(item => {
                    const val = parseFloat(d[item.key] || 0)
                    if (val === 0) return null
                    return (
                      <div key={item.key} className="flex justify-between items-center px-5 py-2.5" title={item.desc}>
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <span className="text-sm font-semibold text-red-500">− {b.moneda} {fmt(val, b.dec)}</span>
                      </div>
                    )
                  })}
                  {totalEgresos === 0 && <div className="px-5 py-3 text-xs text-gray-300 text-center">Sin egresos</div>}
                </div>
                {totalEgresos > 0 && (
                  <div className="flex justify-between px-5 py-2 bg-red-50 border-t border-red-100">
                    <span className="text-xs font-semibold text-red-600">Total egresos</span>
                    <span className="text-sm font-bold text-red-600">− {b.moneda} {fmt(totalEgresos, b.dec)}</span>
                  </div>
                )}
              </div>

              {/* Resumen final */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-3 space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Presupuesto inicial</span>
                  <span>{b.moneda} {fmt(d.presupuesto, b.dec)}</span>
                </div>
                <div className="flex justify-between text-xs text-green-600">
                  <span>+ Ingresos</span>
                  <span>{b.moneda} {fmt(totalIngresos, b.dec)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-500">
                  <span>− Egresos</span>
                  <span>{b.moneda} {fmt(totalEgresos, b.dec)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm font-bold text-gray-700">= Disponible</span>
                  <span className={`text-sm font-bold ${parseFloat(d.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {b.moneda} {fmt(d.saldo, b.dec)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
