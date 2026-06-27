import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Custodios() {
  const { authFetch } = useAuth()
  const [custodios, setCustodios] = useState([])
  const [cargando, setCargando]   = useState(true)
  const [nombre, setNombre]       = useState('')
  const [tipo, setTipo]           = useState('broker')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res  = await authFetch('/api/cartera/custodios')
      const data = await res.json()
      setCustodios(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!nombre) return
    try {
      await authFetch('/api/cartera/custodios', { method: 'POST', body: JSON.stringify({ nombre, tipo }) })
      setNombre(''); cargar()
    } catch {}
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este custodio?')) return
    try { await authFetch(`/api/cartera/custodios/${id}`, { method: 'DELETE' }); cargar() } catch {}
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">🏛️ Custodios</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Nuevo custodio</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Banco Galicia"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              {['broker','banco','comitente','otro'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={guardar} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
            Agregar
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Nombre', 'Tipo', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {custodios.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{c.tipo}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => eliminar(c.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️ Eliminar</button>
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
