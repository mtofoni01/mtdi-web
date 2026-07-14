import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Documentos() {
  const { authFetch, usuario, token } = useAuth()
  const navigate = useNavigate()
  const [documentos, setDocumentos]   = useState([])
  const [cargando, setCargando]       = useState(true)
  const [busqueda, setBusqueda]       = useState('')
  const [filtroTipo, setFiltroTipo]   = useState('Todos')
  const [seleccionado, setSeleccionado] = useState(null)
  const [detalle, setDetalle]         = useState([])
  const fileRef = useRef()

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const url = usuario?.rol === 'admin' ? '/api/admin/documentos' : '/api/documentos'
      const res  = await authFetch(url)
      const data = await res.json()
      setDocumentos(data.documentos || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, usuario])

  useEffect(() => { cargar() }, [cargar])

  const verDetalle = async (doc) => {
    setSeleccionado(doc)
    try {
      const res  = await authFetch(`/api/documentos/${doc.id}`)
      const data = await res.json()
      setDetalle(data.detalle || [])
    } catch {}
  }

  const subirArchivo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('imagen', file)
    try {
      const res = await fetch(`https://backend-login-production-6dd0.up.railway.app/api/documentos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) cargar()
    } catch {}
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este documento?')) return
    try {
      await authFetch(`/api/documentos/${id}`, { method: 'DELETE' })
      cargar()
      if (seleccionado?.id === id) setSeleccionado(null)
    } catch {}
  }

  // Navega a Gastos con los datos del documento precargados
  const imputarComoGasto = (doc) => {
    navigate('/gastos', { state: { desdeDocumento: doc } })
  }

  const TIPOS = ['Todos', 'Factura A', 'Factura B', 'Factura C', 'Remito', 'Nota de pedido', 'Presupuesto', 'Recibo', 'Contrato', 'Otro']

  const filtrados = documentos.filter(d => {
    const matchBusq = !busqueda ||
      (d.proveedor || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (d.numero || '').toLowerCase().includes(busqueda.toLowerCase())
    const matchTipo = filtroTipo === 'Todos' || d.tipo === filtroTipo
    return matchBusq && matchTipo
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📄 Documentos</h1>
        <div className="flex gap-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subirArchivo} />
          <button onClick={() => fileRef.current.click()}
            className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
            📷 Subir imagen (OCR)
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por proveedor o número..."
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        {(busqueda || filtroTipo !== 'Todos') && (
          <button onClick={() => { setBusqueda(''); setFiltroTipo('Todos') }}
            className="px-3 py-2 text-sm text-red-400 border border-red-200 rounded-lg hover:bg-red-50">✕</button>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtrados.length} documento(s)</p>

      <div className="flex gap-6">
        {/* Lista */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {cargando ? (
            <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Tipo', 'Número', 'Fecha', 'Proveedor', 'CUIT', 'IVA', 'Total', 'Usuario', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map((doc, i) => (
                  <tr key={i} onClick={() => verDetalle(doc)}
                    className={`cursor-pointer transition-colors ${seleccionado?.id === doc.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-white px-2 py-1 rounded bg-indigo-500">{doc.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{doc.numero || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{doc.fecha ? new Date(doc.fecha).toLocaleDateString('es-AR') : '-'}</td>
                    <td className="px-4 py-3 text-sm">{doc.proveedor || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{doc.cuit || '-'}</td>
                    <td className="px-4 py-3 text-sm">{doc.iva ? `$${parseFloat(doc.iva).toLocaleString('es-AR')}` : '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{doc.total ? `$${parseFloat(doc.total).toLocaleString('es-AR')}` : '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{doc.usuario_nombre || '-'}</td>
                    <td className="px-4 py-3">
                      {usuario?.rol === 'admin' && (
                        <button onClick={e => { e.stopPropagation(); eliminar(doc.id) }}
                          className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detalle */}
        {seleccionado && (
          <div className="w-72 bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white px-2 py-1 rounded bg-indigo-500">{seleccionado.tipo}</span>
              <button onClick={() => setSeleccionado(null)} className="text-gray-300 hover:text-gray-500">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Número', seleccionado.numero || '-'],
                ['Fecha', seleccionado.fecha ? new Date(seleccionado.fecha).toLocaleDateString('es-AR') : '-'],
                ['Proveedor', seleccionado.proveedor || '-'],
                ['CUIT', seleccionado.cuit || '-'],
                ['IVA', seleccionado.iva ? `$${parseFloat(seleccionado.iva).toLocaleString('es-AR')}` : '-'],
                ['Total', seleccionado.total ? `$${parseFloat(seleccionado.total).toLocaleString('es-AR')}` : '-'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-400">{l}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>

            {detalle.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Detalle</p>
                {detalle.map((item, i) => (
                  <div key={i} className="text-xs border-b border-gray-50 py-2">
                    <p className="font-medium">{item.descripcion}</p>
                    <div className="flex justify-between text-gray-400 mt-1">
                      <span>Cant: {item.cantidad}</span>
                      <span>P.Unit: ${parseFloat(item.precio_unit || 0).toLocaleString('es-AR')}</span>
                      <span className="font-semibold text-gray-600">${parseFloat(item.subtotal || 0).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Imputar como gasto (solo admin) */}
            {usuario?.rol === 'admin' && (
              <button onClick={() => imputarComoGasto(seleccionado)}
                className="w-full py-2 text-sm text-white rounded-lg font-semibold mt-2"
                style={{ backgroundColor: '#d35400' }}>
                💸 Imputar como gasto
              </button>
            )}

            {seleccionado.imagen_url && (
              <a href={seleccionado.imagen_url} target="_blank" rel="noreferrer"
                className="block text-center text-xs text-indigo-500 hover:underline mt-2">
                Ver imagen →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
