// pages/Cobros.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtFecha(f) {
  if (!f) return '-'
  const s = String(f).includes('T') ? String(f).split('T')[0] : String(f)
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}
function hoy() { return new Date().toISOString().split('T')[0] }
function diasHasta(fecha) {
  if (!fecha) return null
  const f = new Date(String(fecha).split('T')[0] + 'T12:00:00')
  const h = new Date(hoy() + 'T12:00:00')
  return Math.round((f - h) / (1000 * 60 * 60 * 24))
}

const TIPOS = {
  cupon:          { label: 'Cupón / Renta',  color: '#16a085', icon: '🎟️' },
  amortizacion:   { label: 'Amortización',   color: '#2980b9', icon: '💵' },
  vto_plazo_fijo: { label: 'Vto. Colocación',color: '#8e44ad', icon: '🏦' },
}

export default function Cobros() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [pendientes, setPendientes] = useState([])
  const [historico, setHistorico]   = useState([])
  const [especies, setEspecies]     = useState([])
  const [custodios, setCustodios]   = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [cargando, setCargando]     = useState(true)
  const [guardando, setGuardando]   = useState(false)
  const [mensaje, setMensaje]       = useState(null)
  const [comafiOk, setComafiOk]     = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [verTodos, setVerTodos]     = useState(false)  // mostrar cobros lejanos

  const [form, setForm] = useState({
    ticker: '', tipo_op: 'cupon', fecha: hoy(),
    vn_cantidad: '', moneda_ajuste: 'ARS', importe_ajuste: '',
    coef_ajuste: '1', importe: '', moneda: 'ARS',
    custodio_id: '', notas: '', usuario_id: '', deposito_id: null,
  })
  const [importeManual, setImporteManual] = useState(false)
  const [cerRef, setCerRef] = useState(null)  // CER de la fecha del cobro (referencia)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = esAdmin ? '?todos=true' : ''
      const [rPend, rHist, rEsp, rCust] = await Promise.all([
        authFetch(`/api/cartera/cobros/pendientes${params}`),
        authFetch(`/api/cartera/cobros${params}`),
        authFetch('/api/cartera/especies'),
        authFetch('/api/cartera/custodios'),
      ])
      const dPend = await rPend.json()
      const dHist = await rHist.json()
      const dEsp  = await rEsp.json()
      const dCust = await rCust.json()
      setPendientes(dPend.data || [])
      setComafiOk(dPend.comafi_ok !== false)
      setHistorico(dHist.data || [])
      setEspecies(dEsp.data || [])
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

  // Autocálculo del importe: importe_ajuste × coef_ajuste
  useEffect(() => {
    if (importeManual) return
    const ia = parseFloat(form.importe_ajuste || 0)
    const co = parseFloat(form.coef_ajuste || 0)
    if (!ia || !co) { set('importe', ''); return }
    set('importe', (ia * co).toFixed(2))
  }, [form.importe_ajuste, form.coef_ajuste, importeManual])

  // CER de la fecha del cobro (referencia para calcular el coeficiente)
  useEffect(() => {
    if (!form.fecha) { setCerRef(null); return }
    authFetch(`/api/cartera/cer?fecha=${form.fecha}`)
      .then(r => r.json())
      .then(d => setCerRef(d.ok ? { valor: d.valor, fecha: d.fecha_valor } : null))
      .catch(() => setCerRef(null))
  }, [authFetch, form.fecha])

  // Precargar el formulario desde un cobro pendiente
  const cobrar = (p) => {
    setForm({
      ticker: p.ticker,
      tipo_op: p.tipo,
      fecha: String(p.fecha).split('T')[0],
      vn_cantidad: p.tipo === 'amortizacion' ? (p.vn_actual * p.valor_cada_100 / 100).toFixed(0) : '',
      moneda_ajuste: p.moneda_ajuste || 'ARS',
      importe_ajuste: p.importe_ajuste?.toString() || '',
      coef_ajuste: p.requiere_ajuste ? '' : '1',
      importe: p.requiere_ajuste ? '' : (p.importe_ajuste?.toFixed(2) || ''),
      moneda: p.moneda_cobro || 'ARS',
      custodio_id: p.custodio_id || '',
      notas: '',
      usuario_id: esAdmin && p.usuario_id !== usuario?.id ? p.usuario_id : '',
      deposito_id: p.deposito_id || null,
    })
    setImporteManual(false)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const guardar = async () => {
    if (!form.ticker)  return setMensaje({ tipo: 'error', texto: 'Seleccioná la especie' })
    if (!form.fecha)   return setMensaje({ tipo: 'error', texto: 'Ingresá la fecha' })
    if (!form.importe) return setMensaje({ tipo: 'error', texto: 'Ingresá el importe cobrado' })

    setGuardando(true)
    setMensaje(null)
    try {
      const body = {
        ticker: form.ticker, tipo_op: form.tipo_op, fecha: form.fecha,
        vn_cantidad: form.vn_cantidad ? parseFloat(form.vn_cantidad) : 0,
        moneda_ajuste: form.moneda_ajuste || null,
        importe_ajuste: form.importe_ajuste ? parseFloat(form.importe_ajuste) : null,
        coef_ajuste: form.coef_ajuste ? parseFloat(form.coef_ajuste) : null,
        importe: parseFloat(form.importe),
        moneda: form.moneda,
        custodio_id: form.custodio_id || null,
        notas: form.notas || null,
        deposito_id: form.deposito_id || null,
      }
      if (esAdmin && form.usuario_id) body.usuario_id = form.usuario_id

      const res  = await authFetch('/api/cartera/cobros', { method: 'POST', body: JSON.stringify(body) })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')

      setMensaje({ tipo: 'ok', texto: `${TIPOS[form.tipo_op].label} de ${form.ticker} registrado: ${form.moneda} ${fmt(form.importe)}` })
      setForm(f => ({ ...f, ticker: '', vn_cantidad: '', importe_ajuste: '', coef_ajuste: '1', importe: '', notas: '', deposito_id: null }))
      setImporteManual(false)
      setMostrarForm(false)
      cargar()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  // Filtrar pendientes: por defecto solo los próximos 90 días + vencidos
  const pendientesVisibles = useMemo(() => {
    if (verTodos) return pendientes
    return pendientes.filter(p => {
      const d = diasHasta(p.fecha)
      return d !== null && d <= 90
    })
  }, [pendientes, verTodos])

  // Totales proyectados por moneda
  const totales = pendientesVisibles.reduce((acc, p) => {
    const m = p.moneda_cobro || 'ARS'
    if (!acc[m]) acc[m] = 0
    acc[m] += parseFloat(p.importe_ajuste || 0) * (p.requiere_ajuste ? 0 : 1)
    return acc
  }, {})

  const requiereAjuste = form.moneda_ajuste !== form.moneda || parseFloat(form.coef_ajuste || 1) !== 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🎟️ Cobros</h1>
        <div className="flex gap-3">
          <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
          <button onClick={() => setMostrarForm(v => !v)}
            className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
            {mostrarForm ? '✕ Cerrar' : '＋ Cobro manual'}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {!comafiOk && (
        <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
          ⚠️ No se pudo conectar con Comafi. Los flujos teóricos de bonos no están disponibles, pero podés cargar cobros manualmente.
        </div>
      )}

      {/* ── FORMULARIO ── */}
      {mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          {/* Tipo */}
          <div className="flex gap-3">
            {Object.entries(TIPOS).map(([k, v]) => (
              <button key={k} onClick={() => set('tipo_op', k)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${form.tipo_op === k ? 'text-white' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                style={form.tipo_op === k ? { backgroundColor: v.color, borderColor: v.color } : {}}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* Especie + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Especie *</label>
              <select value={form.ticker} onChange={e => set('ticker', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="">Seleccionar...</option>
                {especies.map(e => <option key={e.ticker} value={e.ticker}>{e.ticker} — {e.descripcion?.slice(0,30)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fecha de cobro *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>

          {/* VN (solo amortización) */}
          {form.tipo_op === 'amortizacion' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                VN amortizado <span className="text-gray-300 normal-case">(reduce la tenencia)</span>
              </label>
              <input type="number" value={form.vn_cantidad} onChange={e => set('vn_cantidad', e.target.value)}
                placeholder="0" step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          )}

          {/* Bloque de ajuste */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase">Determinación del importe</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Moneda ajuste</label>
                <select value={form.moneda_ajuste} onChange={e => set('moneda_ajuste', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Importe ajuste</label>
                <input type="number" value={form.importe_ajuste} onChange={e => set('importe_ajuste', e.target.value)}
                  placeholder="0.00" step="any"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                  Coeficiente <span className="text-gray-300 normal-case">(TC / CER)</span>
                </label>
                <input type="number" value={form.coef_ajuste} onChange={e => set('coef_ajuste', e.target.value)}
                  placeholder="1" step="any"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400" />
                {cerRef && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    CER al {new Date(cerRef.fecha + 'T12:00:00').toLocaleDateString('es-AR')}: <span className="font-semibold text-gray-600">{Number(cerRef.valor).toFixed(4)}</span>
                  </p>
                )}
              </div>
            </div>
            {requiereAjuste && form.importe_ajuste && form.coef_ajuste && (
              <p className="text-xs text-indigo-600">
                {form.moneda_ajuste} {fmt(form.importe_ajuste, 4)} × {fmt(form.coef_ajuste, 6)} = {form.moneda} {fmt(form.importe)}
              </p>
            )}
          </div>

          {/* Importe cobrado */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Importe cobrado *</label>
              <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={importeManual} onChange={e => setImporteManual(e.target.checked)} />
                Editar manual
              </label>
            </div>
            <div className="flex items-center gap-2">
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
              <input type="number" value={form.importe} onChange={e => set('importe', e.target.value)}
                readOnly={!importeManual} placeholder="0.00" step="any"
                className={`flex-1 border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none ${importeManual ? 'border-gray-200' : 'border-gray-100 bg-gray-50 text-gray-600'}`} />
            </div>
          </div>

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
            {form.importe && (
              <div className="flex justify-between items-center mb-4 px-4 py-3 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-600">Ingreso al presupuesto:</span>
                <span className="text-lg font-bold text-green-600">+ {form.moneda} {fmt(form.importe)}</span>
              </div>
            )}
            <button onClick={guardar} disabled={guardando}
              className="w-full py-3 text-white rounded-lg font-semibold disabled:opacity-60"
              style={{ backgroundColor: TIPOS[form.tipo_op].color }}>
              {guardando ? 'Guardando...' : `Registrar ${TIPOS[form.tipo_op].label}`}
            </button>
          </div>
        </div>
      )}

      {/* ── PENDIENTES ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">📅 Cobros proyectados</h2>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={verTodos} onChange={e => setVerTodos(e.target.checked)} />
            Ver todo el calendario (no solo próximos 90 días)
          </label>
        </div>

        {/* Totales */}
        {Object.keys(totales).length > 0 && (
          <div className="flex gap-4 mb-3">
            {Object.entries(totales).map(([m, v]) => v > 0 && (
              <div key={m} className="bg-white rounded-xl border border-gray-100 px-5 py-3">
                <p className="text-xs text-gray-400">A cobrar {m}</p>
                <p className="text-lg font-bold text-green-600">+ {m} {fmt(v)}</p>
              </div>
            ))}
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
        ) : pendientesVisibles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
            No hay cobros proyectados {verTodos ? '' : 'en los próximos 90 días'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Fecha', 'Días', 'Tipo', 'Especie', 'Detalle', 'Importe estimado', esAdmin ? 'Usuario' : null, '']
                      .filter(h => h !== null).map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendientesVisibles.map((p, i) => {
                    const t = TIPOS[p.tipo] || {}
                    const dias = diasHasta(p.fecha)
                    const vencido = dias < 0
                    return (
                      <tr key={i} className={`hover:bg-gray-50 ${vencido ? 'bg-amber-50' : ''}`}>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtFecha(p.fecha)}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {vencido
                            ? <span className="text-amber-600 font-semibold">Vencido</span>
                            : dias === 0
                              ? <span className="text-green-600 font-semibold">Hoy</span>
                              : <span className="text-gray-400">{dias}d</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full text-white whitespace-nowrap"
                            style={{ backgroundColor: t.color }}>{t.icon} {t.label}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{p.ticker}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {p.origen === 'bono'
                            ? `${fmt(p.vn_actual, 0)} VN × ${fmt(p.valor_cada_100, 4)} /100`
                            : `Capital ${fmt(p.capital)} + interés ${fmt(p.interes)} (TNA ${fmt(p.tna)}%)`}
                          {p.requiere_ajuste && <span className="ml-2 text-amber-600">· requiere coef.</span>}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600 whitespace-nowrap">
                          {p.moneda_ajuste} {fmt(p.importe_ajuste)}
                          {p.requiere_ajuste && <span className="text-xs text-gray-400"> × coef</span>}
                        </td>
                        {esAdmin && <td className="px-4 py-3 text-xs text-gray-500">{p.usuario_nombre}</td>}
                        <td className="px-4 py-3">
                          <button onClick={() => cobrar(p)}
                            className="px-3 py-1 text-xs text-white rounded-lg font-semibold"
                            style={{ backgroundColor: '#16a085' }}>
                            Cobrar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
              {pendientesVisibles.length} cobro(s) proyectado(s)
            </div>
          </div>
        )}
      </div>

      {/* ── HISTÓRICO ── */}
      {historico.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">📜 Cobros realizados</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Fecha', 'Tipo', 'Especie', 'Ajuste', 'Coef.', 'Importe cobrado', esAdmin ? 'Usuario' : null]
                      .filter(h => h !== null).map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historico.map(c => {
                    const t = TIPOS[c.tipo_op] || {}
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtFecha(c.fecha)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full text-white whitespace-nowrap"
                            style={{ backgroundColor: t.color }}>{t.icon} {t.label}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{c.ticker}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {c.importe_ajuste ? `${c.moneda_ajuste} ${fmt(c.importe_ajuste, 4)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {c.coef_ajuste && parseFloat(c.coef_ajuste) !== 1 ? fmt(c.coef_ajuste, 6) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">+ {c.moneda} {fmt(c.importe)}</td>
                        {esAdmin && <td className="px-4 py-3 text-xs text-gray-500">{c.usuario_nombre}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
