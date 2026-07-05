// pages/FCI.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtFecha(f) {
  if (!f) return '-'
  const s = f.includes('T') ? f.split('T')[0] : f
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}
function hoy() { return new Date().toISOString().split('T')[0] }

const CONCEPTOS = {
  suscripcion: { label: 'Suscripción', color: '#2d7d46', efecto: 'egresa' },
  rescate:     { label: 'Rescate',     color: '#c5183c', efecto: 'ingresa' },
  valuacion:   { label: 'Valuación',   color: '#8e44ad', efecto: 'neutro' },
}

export default function FCI() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [fcis, setFcis]         = useState([])
  const [especies, setEspecies] = useState([])
  const [custodios, setCustodios] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [movs, setMovs]         = useState([])
  const [detalle, setDetalle]   = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]   = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [form, setForm] = useState({
    ticker: '', concepto: 'suscripcion', fecha: hoy(),
    vn: '', cotizacion: '', importe: '', moneda: 'ARS',
    custodio_id: '', notas: '', usuario_id: '',
  })
  const [importeManual, setImporteManual] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = esAdmin ? '?todos=true' : ''
      const [rFci, rEsp, rCust] = await Promise.all([
        authFetch(`/api/cartera/fci${params}`),
        authFetch('/api/cartera/especies'),
        authFetch('/api/cartera/custodios'),
      ])
      const dFci  = await rFci.json()
      const dEsp  = await rEsp.json()
      const dCust = await rCust.json()
      setFcis(dFci.data || [])
      setEspecies((dEsp.data || []).filter(e => ['fci_mm','fci_rf','fci_rv','fci_mix'].includes(e.tipo)))
      setCustodios(dCust.data || [])
      if (esAdmin) {
        const rU = await authFetch('/api/admin/usuarios')
        const dU = await rU.json()
        setUsuarios(dU.usuarios || [])
      }
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, esAdmin])

  useEffect(() => { cargar() }, [cargar])

  // Autocálculo de importe
  useEffect(() => {
    if (importeManual || form.concepto === 'valuacion') return
    const vn = parseFloat(form.vn || 0)
    const co = parseFloat(form.cotizacion || 0)
    if (!vn || !co) { set('importe', ''); return }
    set('importe', (vn * co).toFixed(2))
  }, [form.vn, form.cotizacion, importeManual, form.concepto])

  const especieSel = useMemo(() => especies.find(e => e.ticker === form.ticker), [especies, form.ticker])

  const verMovimientos = async (fci) => {
    if (detalle?.especie_id === fci.especie_id && detalle?.usuario_id === fci.usuario_id) {
      setDetalle(null); setMovs([]); return
    }
    setDetalle(fci)
    try {
      const params = esAdmin ? '?todos=true' : ''
      const res  = await authFetch(`/api/cartera/fci/${fci.ticker}/movimientos${params}`)
      const data = await res.json()
      setMovs(data.data || [])
    } catch {}
  }

  const guardar = async () => {
    if (!form.ticker)     return setMensaje({ tipo: 'error', texto: 'Seleccioná el FCI' })
    if (!form.cotizacion) return setMensaje({ tipo: 'error', texto: 'Ingresá la cotización de la cuotaparte' })
    if (form.concepto !== 'valuacion' && !form.vn)
      return setMensaje({ tipo: 'error', texto: 'Ingresá las cuotapartes (VN)' })

    setGuardando(true)
    setMensaje(null)
    try {
      const body = {
        ticker: form.ticker, concepto: form.concepto, fecha: form.fecha,
        cotizacion: parseFloat(form.cotizacion),
        moneda: form.moneda, custodio_id: form.custodio_id || null,
        notas: form.notas || null,
      }
      if (form.concepto !== 'valuacion') {
        body.vn = parseFloat(form.vn)
        body.importe = form.importe ? parseFloat(form.importe) : null
      }
      if (esAdmin && form.usuario_id) body.usuario_id = form.usuario_id

      const res  = await authFetch('/api/cartera/fci', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')

      setMensaje({ tipo: 'ok', texto: `${CONCEPTOS[form.concepto].label} registrada. Saldo: ${fmt(data.saldo_vn, 4)} cuotapartes` })
      setForm(f => ({ ...f, vn: '', cotizacion: '', importe: '', notas: '' }))
      setImporteManual(false)
      cargar()
      if (detalle) verMovimientos(detalle)
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este movimiento? Recalculá los saldos manualmente si es necesario.')) return
    try { await authFetch(`/api/cartera/fci/${id}`, { method: 'DELETE' }); cargar(); if (detalle) verMovimientos(detalle) } catch {}
  }

  const esValuacion = form.concepto === 'valuacion'

  // Totales de valuación
  const totalValuacion = fcis.reduce((acc, f) => {
    const key = f.moneda || 'ARS'
    acc[key] = (acc[key] || 0) + parseFloat(f.valuacion || 0)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📊 Fondos Comunes (FCI)</h1>
        <div className="flex gap-3">
          <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
          <button onClick={() => setMostrarForm(v => !v)}
            className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
            {mostrarForm ? '✕ Cerrar' : '＋ Nuevo movimiento'}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Totales */}
      {Object.keys(totalValuacion).length > 0 && (
        <div className="flex gap-4">
          {Object.entries(totalValuacion).map(([moneda, val]) => (
            <div key={moneda} className="bg-white rounded-xl border border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">Valuación total {moneda}</p>
              <p className="text-xl font-bold text-gray-800">{moneda} {fmt(val)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          {/* Concepto */}
          <div className="flex gap-3">
            {Object.entries(CONCEPTOS).map(([k, v]) => (
              <button key={k} onClick={() => set('concepto', k)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${form.concepto === k ? 'text-white' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                style={form.concepto === k ? { backgroundColor: v.color, borderColor: v.color } : {}}>
                {v.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 italic">
            {esValuacion ? 'Solo actualiza la cotización para revaluar el saldo. No mueve dinero ni cuotapartes.'
              : form.concepto === 'suscripcion' ? 'Comprás cuotapartes. Egresa del presupuesto.'
              : 'Rescatás cuotapartes. Ingresa al presupuesto.'}
          </p>

          {/* FCI */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">FCI *</label>
            <select value={form.ticker} onChange={e => { set('ticker', e.target.value); const es = especies.find(x => x.ticker === e.target.value); if (es) set('moneda', es.moneda) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Seleccionar...</option>
              {especies.map(e => <option key={e.ticker} value={e.ticker}>{e.ticker} — {e.descripcion}</option>)}
            </select>
            {especies.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay FCI cargados. Creá uno en Especies (tipo fci_mm, fci_rf, etc.)</p>}
          </div>

          {/* Fecha + Moneda */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
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

          {/* VN + Cotización */}
          <div className="grid grid-cols-2 gap-4">
            {!esValuacion && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cuotapartes (VN) *</label>
                <input type="number" value={form.vn} onChange={e => set('vn', e.target.value)}
                  placeholder="0.0000" step="any"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            )}
            <div className={esValuacion ? 'col-span-2' : ''}>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cotización cuotaparte *</label>
              <input type="number" value={form.cotizacion} onChange={e => set('cotizacion', e.target.value)}
                placeholder="0.000000" step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>

          {/* Importe (no en valuación) */}
          {!esValuacion && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Importe</label>
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={importeManual} onChange={e => setImporteManual(e.target.checked)} />
                  Editar manual
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">{form.moneda}</span>
                <input type="number" value={form.importe} onChange={e => set('importe', e.target.value)}
                  readOnly={!importeManual} placeholder="0.00" step="any"
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none ${importeManual ? 'border-gray-200' : 'border-gray-100 bg-gray-50 text-gray-600'}`} />
              </div>
              {!importeManual && <p className="text-xs text-gray-400 mt-1">Calculado: VN × cotización</p>}
            </div>
          )}

          {/* Custodio + Usuario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Custodio</label>
              <select value={form.custodio_id} onChange={e => set('custodio_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="">Sin custodio</option>
                {custodios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {esAdmin && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Para usuario</label>
                <select value={form.usuario_id} onChange={e => set('usuario_id', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                  <option value="">Mi cuenta</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notas</label>
            <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Opcional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>

          <div className="pt-4 border-t border-gray-100">
            {!esValuacion && form.importe && (
              <div className="flex justify-between items-center mb-4 px-4 py-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-500">{form.concepto === 'suscripcion' ? 'Egreso del' : 'Ingreso al'} presupuesto:</span>
                <span className="text-lg font-bold" style={{ color: form.concepto === 'suscripcion' ? '#c5183c' : '#16a085' }}>
                  {form.concepto === 'suscripcion' ? '−' : '+'} {form.moneda} {fmt(form.importe)}
                </span>
              </div>
            )}
            <button onClick={guardar} disabled={guardando}
              className="w-full py-3 text-white rounded-lg font-semibold disabled:opacity-60"
              style={{ backgroundColor: CONCEPTOS[form.concepto].color }}>
              {guardando ? 'Guardando...' : `Registrar ${CONCEPTOS[form.concepto].label}`}
            </button>
          </div>
        </div>
      )}

      {/* Lista de FCI */}
      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : fcis.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">No hay FCI con movimientos</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['FCI', 'Saldo cuotapartes', 'Últ. cotización', 'Valuación', 'TNA deveng.', 'Custodio', esAdmin ? 'Usuario' : null, '']
                    .filter(h => h !== null).map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fcis.map((f) => {
                  const isOpen = detalle?.especie_id === f.especie_id && detalle?.usuario_id === f.usuario_id
                  return (
                    <tr key={`${f.especie_id}-${f.usuario_id}`} onClick={() => verMovimientos(f)}
                      className={`cursor-pointer transition-colors ${isOpen ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-white px-2 py-1 rounded bg-indigo-500">{f.ticker}</span>
                        <span className="text-xs text-gray-400 ml-2">{f.descripcion?.slice(0, 20)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{fmt(f.saldo_vn, 4)}</td>
                      <td className="px-4 py-3 text-sm">{f.moneda} {fmt(f.ultima_cotizacion, 6)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{f.moneda} {fmt(f.valuacion)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: f.tna_devengada >= 0 ? '#16a085' : '#c5183c' }}>
                        {f.tna_devengada !== null ? `${fmt(f.tna_devengada)}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{f.custodio_nombre || '-'}</td>
                      {esAdmin && <td className="px-4 py-3 text-xs text-gray-500">{f.usuario_nombre}</td>}
                      <td className="px-4 py-3 text-xs text-indigo-400">{isOpen ? '▲' : '▼'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Detalle de movimientos */}
          {detalle && movs.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Movimientos de {detalle.ticker}</p>
              <div className="bg-white rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Fecha', 'Concepto', 'Cuotapartes', 'Cotización', 'Importe', 'Saldo VN', 'Valuación', esAdmin ? '' : null]
                        .filter(h => h !== null).map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {movs.map(m => {
                      const c = CONCEPTOS[m.concepto] || { label: m.concepto, color: '#555' }
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-500">{fmtFecha(m.fecha)}</td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: c.color }}>{c.label}</span>
                          </td>
                          <td className="px-3 py-2 text-xs">{m.vn !== null ? fmt(m.vn, 4) : '-'}</td>
                          <td className="px-3 py-2 text-xs">{fmt(m.cotizacion, 6)}</td>
                          <td className="px-3 py-2 text-xs">{m.importe !== null ? `${m.moneda} ${fmt(m.importe)}` : '-'}</td>
                          <td className="px-3 py-2 text-xs font-semibold">{fmt(m.saldo_vn, 4)}</td>
                          <td className="px-3 py-2 text-xs text-indigo-600">{m.moneda} {fmt(m.valuacion)}</td>
                          {esAdmin && <td className="px-3 py-2"><button onClick={(e) => { e.stopPropagation(); eliminar(m.id) }} className="text-red-400 hover:text-red-600 text-xs">🗑️</button></td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
