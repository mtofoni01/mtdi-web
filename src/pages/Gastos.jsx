// pages/Gastos.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtFecha(f) {
  if (!f) return '-'
  const s = String(f).includes('T') ? String(f).split('T')[0] : String(f)
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}
function hoy() { return new Date().toISOString().split('T')[0] }

const CATEGORIAS = {
  comision_custodia:    { label: 'Comisión de custodia',    color: '#8e44ad', icon: '🏛️' },
  comision_transaccion: { label: 'Comisión de transacción', color: '#2980b9', icon: '💹' },
  derechos_mercado:     { label: 'Derechos de mercado',     color: '#16a085', icon: '📊' },
  impuestos:            { label: 'Impuestos',               color: '#c0392b', icon: '🧾' },
  administrativos:      { label: 'Gastos administrativos',  color: '#d35400', icon: '📋' },
  otros:                { label: 'Otros',                   color: '#7f8c8d', icon: '📌' },
}

export default function Gastos() {
  const { authFetch, usuario } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const esAdmin = usuario?.rol === 'admin'

  const [gastos, setGastos]       = useState([])
  const [especies, setEspecies]   = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [documentos, setDocumentos] = useState([])
  const [cargando, setCargando]   = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]     = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  // Filtros
  const [fCategoria, setFCategoria] = useState('')
  const [fTicker, setFTicker]       = useState('')

  const [form, setForm] = useState({
    usuario_id: '', categoria: 'otros', concepto: '',
    importe: '', moneda: 'ARS', fecha: hoy(),
    ticker: '', documento_id: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (esAdmin) params.set('todos', 'true')
      if (fCategoria) params.set('categoria', fCategoria)
      if (fTicker)    params.set('ticker', fTicker.toUpperCase())

      const [rG, rE] = await Promise.all([
        authFetch(`/api/gastos?${params}`),
        authFetch('/api/cartera/especies'),
      ])
      const dG = await rG.json()
      const dE = await rE.json()
      setGastos(dG.data || [])
      setEspecies(dE.data || [])

      if (esAdmin) {
        const [rU, rD] = await Promise.all([
          authFetch('/api/admin/usuarios'),
          authFetch('/api/admin/documentos'),
        ])
        const dU = await rU.json()
        const dD = await rD.json()
        setUsuarios(dU.usuarios || [])
        setDocumentos(dD.documentos || [])
      }
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, esAdmin, fCategoria, fTicker])

  useEffect(() => { cargar() }, [cargar])

  // Precarga desde Documentos (via navigate con state)
  useEffect(() => {
    const pre = location.state?.desdeDocumento
    if (!pre) return
    setForm(f => ({
      ...f,
      documento_id: pre.id || '',
      concepto: pre.proveedor ? `${pre.tipo || 'Documento'} ${pre.numero ? 'N° ' + pre.numero : ''} — ${pre.proveedor}`.trim() : '',
      importe: pre.total || '',
      fecha: pre.fecha ? String(pre.fecha).split('T')[0] : hoy(),
      usuario_id: pre.usuario_id || '',
    }))
    setMostrarForm(true)
    navigate(location.pathname, { replace: true, state: {} })  // limpiar el state
  }, [location, navigate])

  const guardar = async () => {
    if (!esAdmin) return setMensaje({ tipo: 'error', texto: 'Solo el administrador puede cargar gastos' })
    if (!form.usuario_id) return setMensaje({ tipo: 'error', texto: 'Seleccioná el usuario al que se imputa' })
    if (!form.concepto)   return setMensaje({ tipo: 'error', texto: 'Ingresá el concepto' })
    if (!form.importe)    return setMensaje({ tipo: 'error', texto: 'Ingresá el importe' })

    setGuardando(true)
    setMensaje(null)
    try {
      const body = {
        usuario_id: form.usuario_id,
        categoria: form.categoria,
        concepto: form.concepto,
        importe: parseFloat(form.importe),
        moneda: form.moneda,
        fecha: form.fecha,
        ticker: form.ticker || null,
        documento_id: form.documento_id || null,
      }
      const res  = await authFetch('/api/gastos', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')

      setMensaje({ tipo: 'ok', texto: `Gasto registrado: ${form.moneda} ${fmt(form.importe)}` })
      setForm(f => ({ ...f, concepto: '', importe: '', ticker: '', documento_id: '' }))
      setMostrarForm(false)
      cargar()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return
    try { await authFetch(`/api/gastos/${id}`, { method: 'DELETE' }); cargar() } catch {}
  }

  // Totales por moneda
  const totales = useMemo(() => gastos.reduce((acc, g) => {
    const m = g.moneda || 'ARS'
    acc[m] = (acc[m] || 0) + parseFloat(g.importe || 0)
    return acc
  }, {}), [gastos])

  // Totales por categoría
  const porCategoria = useMemo(() => gastos.reduce((acc, g) => {
    const c = g.categoria || 'otros'
    if (!acc[c]) acc[c] = {}
    const m = g.moneda || 'ARS'
    acc[c][m] = (acc[c][m] || 0) + parseFloat(g.importe || 0)
    return acc
  }, {}), [gastos])

  const hayFiltros = fCategoria || fTicker

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">💸 Gastos</h1>
        <div className="flex gap-3">
          <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
          {esAdmin && (
            <button onClick={() => setMostrarForm(v => !v)}
              className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
              {mostrarForm ? '✕ Cerrar' : '＋ Nuevo gasto'}
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* ── FORMULARIO ── */}
      {mostrarForm && esAdmin && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          {/* Categoría */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Categoría *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(CATEGORIAS).map(([k, v]) => (
                <button key={k} onClick={() => set('categoria', k)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-colors text-left ${form.categoria === k ? 'text-white' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                  style={form.categoria === k ? { backgroundColor: v.color, borderColor: v.color } : {}}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Usuario + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Imputar a usuario *</label>
              <select value={form.usuario_id} onChange={e => set('usuario_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="">Seleccionar...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Concepto *</label>
            <input type="text" value={form.concepto} onChange={e => set('concepto', e.target.value)}
              placeholder="Ej: Comisión de custodia trimestral"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>

          {/* Importe + Moneda */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Importe *</label>
              <input type="number" value={form.importe} onChange={e => set('importe', e.target.value)}
                placeholder="0.00" step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Moneda *</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Imputación opcional a ticker + documento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                Imputar a especie <span className="text-gray-300 normal-case">(opcional)</span>
              </label>
              <select value={form.ticker} onChange={e => set('ticker', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="">Sin imputar a especie</option>
                {especies.map(e => <option key={e.ticker} value={e.ticker}>{e.ticker} — {e.descripcion?.slice(0,25)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                Documento respaldatorio <span className="text-gray-300 normal-case">(opcional)</span>
              </label>
              <select value={form.documento_id} onChange={e => set('documento_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="">Sin documento</option>
                {documentos.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.tipo} {d.numero ? `N° ${d.numero}` : ''} — {d.proveedor || 's/proveedor'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            {form.importe && (
              <div className="flex justify-between items-center mb-4 px-4 py-3 bg-red-50 rounded-lg">
                <span className="text-sm text-gray-600">Egreso del presupuesto del cliente:</span>
                <span className="text-lg font-bold text-red-500">− {form.moneda} {fmt(form.importe)}</span>
              </div>
            )}
            <button onClick={guardar} disabled={guardando}
              className="w-full py-3 text-white rounded-lg font-semibold disabled:opacity-60"
              style={{ backgroundColor: CATEGORIAS[form.categoria].color }}>
              {guardando ? 'Guardando...' : 'Registrar Gasto'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Categoría</label>
            <select value={fCategoria} onChange={e => setFCategoria(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Todas</option>
              {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Especie</label>
            <input type="text" value={fTicker} onChange={e => setFTicker(e.target.value.toUpperCase())}
              placeholder="Todas"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-indigo-400" />
          </div>
          {hayFiltros && (
            <button onClick={() => { setFCategoria(''); setFTicker('') }}
              className="px-3 py-2 text-sm text-red-400 border border-red-200 rounded-lg hover:bg-red-50">✕ Limpiar</button>
          )}
        </div>
      </div>

      {/* Totales */}
      {Object.keys(totales).length > 0 && (
        <div className="flex gap-4 flex-wrap">
          {Object.entries(totales).map(([m, v]) => (
            <div key={m} className="bg-white rounded-xl border border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">Total gastos {m}</p>
              <p className="text-xl font-bold text-red-500">− {m} {fmt(v)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resumen por categoría */}
      {Object.keys(porCategoria).length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Por categoría</p>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(porCategoria).map(([cat, monedas]) => {
              const c = CATEGORIAS[cat] || CATEGORIAS.otros
              return (
                <div key={cat} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                  <span className="text-xs text-gray-600">{c.icon} {c.label}</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {Object.entries(monedas).map(([m, v]) => `${m} ${fmt(v)}`).join(' · ')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : gastos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay gastos {hayFiltros ? 'con estos filtros' : 'cargados'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Fecha', 'Categoría', 'Concepto', 'Especie', 'Importe', 'Documento', esAdmin ? 'Usuario' : null, esAdmin ? '' : null]
                    .filter(h => h !== null).map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gastos.map(g => {
                  const c = CATEGORIAS[g.categoria] || CATEGORIAS.otros
                  return (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtFecha(g.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full text-white whitespace-nowrap"
                          style={{ backgroundColor: c.color }}>{c.icon} {c.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{g.concepto}</td>
                      <td className="px-4 py-3">
                        {g.ticker
                          ? <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-indigo-500">{g.ticker}</span>
                          : <span className="text-xs text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-500 whitespace-nowrap">− {g.moneda} {fmt(g.importe)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {g.doc_tipo ? (
                          g.imagen_url
                            ? <a href={g.imagen_url} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">
                                {g.doc_tipo} {g.doc_numero ? `N° ${g.doc_numero}` : ''} 📎
                              </a>
                            : `${g.doc_tipo} ${g.doc_numero ? 'N° ' + g.doc_numero : ''}`
                        ) : '-'}
                      </td>
                      {esAdmin && <td className="px-4 py-3 text-xs text-gray-500">{g.usuario_nombre}</td>}
                      {esAdmin && (
                        <td className="px-4 py-3">
                          <button onClick={() => eliminar(g.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {gastos.length} gasto(s)
          </div>
        </div>
      )}
    </div>
  )
}
