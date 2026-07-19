// pages/Auditoria.jsx
import { useState, useEffect, useCallback, Fragment } from 'react'
import { useAuth } from '../context/AuthContext'

const ACCIONES = [
  { v: '', l: 'Todas las acciones' },
  { v: 'login', l: 'Login' },
  { v: 'crear', l: 'Crear' },
  { v: 'editar', l: 'Editar' },
  { v: 'borrar', l: 'Borrar' },
]
const ENTIDADES = [
  '', 'operacion', 'cobro', 'precio', 'especie', 'custodio', 'deposito', 'fci',
  'snapshot', 'flujos_manuales', 'posicion', 'cartera_objetivo',
  'comision', 'gasto', 'documento', 'usuario', 'pase_moneda', 'sesion',
]
const COLOR_ACCION = {
  login: '#6b7280', crear: '#16a085', editar: '#4F6EF7', borrar: '#e74c3c',
}

const PAGE = 100

function fmtFechaHora(f) {
  if (!f) return '-'
  const d = new Date(f)
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Auditoria() {
  const { authFetch } = useAuth()

  const [filtros, setFiltros] = useState({ accion: '', entidad: '', desde: '', hasta: '', q: '' })
  const [registros, setRegistros] = useState([])
  const [total, setTotal]     = useState(0)
  const [offset, setOffset]   = useState(0)
  const [cargando, setCargando] = useState(false)
  const [expandido, setExpandido] = useState(null)  // id de fila con detalle abierto

  const cargar = useCallback(async (nuevoOffset = 0, append = false) => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (filtros.accion)  params.set('accion', filtros.accion)
      if (filtros.entidad) params.set('entidad', filtros.entidad)
      if (filtros.desde)   params.set('desde', filtros.desde)
      if (filtros.hasta)   params.set('hasta', filtros.hasta)
      if (filtros.q)       params.set('q', filtros.q)
      params.set('limit', PAGE)
      params.set('offset', nuevoOffset)

      const res = await authFetch(`/api/cartera/auditoria?${params}`)
      const d = await res.json()
      if (d.ok) {
        setRegistros(prev => append ? [...prev, ...d.data] : d.data)
        setTotal(d.total)
        setOffset(nuevoOffset)
      }
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, filtros])

  useEffect(() => { cargar(0, false) }, [cargar])

  const parseJson = (v) => {
    if (v == null) return null
    if (typeof v === 'object') return v
    try { return JSON.parse(v) } catch { return v }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🔎 Auditoría</h1>
        <p className="text-sm text-gray-400 mt-1">Registro de acciones del sistema: quién, qué y cuándo.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Acción</label>
          <select value={filtros.accion} onChange={e => setFiltros({ ...filtros, accion: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
            {ACCIONES.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Entidad</label>
          <select value={filtros.entidad} onChange={e => setFiltros({ ...filtros, entidad: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
            {ENTIDADES.map(e => <option key={e} value={e}>{e === '' ? 'Todas las entidades' : e}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Desde</label>
          <input type="date" value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Hasta</label>
          <input type="date" value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-gray-400 block mb-1">Buscar (detalle, usuario, id)</label>
          <input type="text" value={filtros.q} onChange={e => setFiltros({ ...filtros, q: e.target.value })}
            placeholder="ej: AO27, Administrador..."
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        {(filtros.accion || filtros.entidad || filtros.desde || filtros.hasta || filtros.q) && (
          <button onClick={() => setFiltros({ accion: '', entidad: '', desde: '', hasta: '', q: '' })}
            className="text-xs text-gray-400 underline pb-2">limpiar</button>
        )}
      </div>

      <p className="text-xs text-gray-400">{total} registro(s){registros.length < total ? ` · mostrando ${registros.length}` : ''}</p>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID', 'Detalle', ''].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {registros.map(r => {
                const antes = parseJson(r.antes)
                const despues = parseJson(r.despues)
                const tieneDetalle = antes || despues
                const abierto = expandido === r.id
                return (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtFechaHora(r.fecha_hora)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{r.usuario_nombre || `#${r.usuario_id ?? '-'}`}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: COLOR_ACCION[r.accion] || '#6b7280' }}>{r.accion}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{r.entidad || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{r.entidad_id || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{r.detalle || '-'}</td>
                      <td className="px-4 py-2.5 text-right">
                        {tieneDetalle && (
                          <button onClick={() => setExpandido(abierto ? null : r.id)}
                            className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
                            {abierto ? 'ocultar' : 'ver cambios'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {abierto && (
                      <tr key={`${r.id}-det`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">Antes</p>
                              <pre className="text-xs bg-white border border-gray-100 rounded-lg p-3 overflow-x-auto text-gray-600">{antes ? JSON.stringify(antes, null, 2) : '—'}</pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">Después</p>
                              <pre className="text-xs bg-white border border-gray-100 rounded-lg p-3 overflow-x-auto text-gray-600">{despues ? JSON.stringify(despues, null, 2) : '—'}</pre>
                            </div>
                          </div>
                          {r.ip && <p className="text-[11px] text-gray-400 mt-2">IP: {r.ip}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {registros.length === 0 && !cargando && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Sin registros para estos filtros</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {cargando && (
          <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" /></div>
        )}
        {registros.length < total && !cargando && (
          <div className="px-4 py-3 border-t border-gray-100 text-center">
            <button onClick={() => cargar(offset + PAGE, true)}
              className="text-sm text-indigo-600 hover:underline">Cargar más ({total - registros.length} restantes)</button>
          </div>
        )}
      </div>
    </div>
  )
}
