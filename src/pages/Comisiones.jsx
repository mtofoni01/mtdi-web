import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Comisiones() {
  const { authFetch } = useAuth()
  const [comisiones, setComisiones] = useState([])
  const [custodios, setCustodios]   = useState([])
  const [cargando, setCargando]     = useState(true)
  const [tipo, setTipo]             = useState('')
  const [custodioId, setCustodioId] = useState('')
  const [pct, setPct]               = useState('')

  const TIPOS = ['bono_usd','bono_ars','bono_cer','bono_dv','letra_ars','letra_usd','on','fci_mm','fci_rf','fci_rv','accion','cedear']

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [c, cu] = await Promise.all([
        authFetch('/api/comisiones').then(r => r.json()),
        authFetch('/api/cartera/custodios').then(r => r.json()),
      ])
      setComisiones(c.data || [])
      setCustodios(cu.data || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!tipo || !custodioId || !pct) return
    try {
      await authFetch('/api/comisiones', { method: 'POST', body: JSON.stringify({ tipo_especie: tipo, custodio_id: parseInt(custodioId), porcentaje: parseFloat(pct) }) })
      setTipo(''); setCustodioId(''); setPct(''); cargar()
    } catch {}
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">💹 Comisiones</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Nueva comisión</h2>
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo de especie</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">Seleccioná...</option>
              {TIPOS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Custodio</label>
            <select value={custodioId} onChange={e => setCustodioId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">Seleccioná...</option>
              {custodios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Porcentaje (%)</label>
            <input type="number" step="0.0001" value={pct} onChange={e => setPct(e.target.value)}
              placeholder="Ej: 0.5" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none" />
          </div>
          <button onClick={guardar} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
            Guardar
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Tipo especie', 'Custodio', 'Porcentaje', 'Vigente desde'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {comisiones.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{c.tipo_especie.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm">{c.custodio_nombre}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-amber-600">{parseFloat(c.porcentaje).toFixed(4)}%</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.fecha_desde).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
