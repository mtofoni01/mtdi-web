// pages/Depositos.jsx
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

function hoy() {
  return new Date().toISOString().split('T')[0]
}

// Suma días a una fecha YYYY-MM-DD
function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + parseInt(dias || 0))
  return d.toISOString().split('T')[0]
}

export default function Depositos() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [depositos, setDepositos]   = useState([])
  const [especies, setEspecies]     = useState([])
  const [custodios, setCustodios]   = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [cargando, setCargando]     = useState(true)
  const [guardando, setGuardando]   = useState(false)
  const [mensaje, setMensaje]       = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  // Vencidos SIN cobrar se muestran siempre (son plata esperando conciliación).
  // Los cobrados son historia: ocultos salvo que se pidan.
  const [verCobrados, setVerCobrados] = useState(false)

  // Modo: plazo_fijo | caucion
  const [modo, setModo] = useState('plazo_fijo')

  const [form, setForm] = useState({
    ticker: '',           // la especie que representa el PF o la caución
    capital: '',
    moneda: 'ARS',
    tna: '',
    fecha_inicio: hoy(),
    plazo_dias: '30',
    custodio_id: '',
    notas: '',
    usuario_id: '',
    // caución
    garantia_ticker: '',
    aforo_pct: '',
  })

  // Cotización de la garantía (para calcular VN)
  const [cotizGarantia, setCotizGarantia] = useState(null)

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  // Cargar depósitos y catálogos
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const qs = new URLSearchParams()
      if (esAdmin) qs.set('todos', 'true')
      if (verCobrados) qs.set('incluir_cobrados', 'true')
      const params = qs.toString() ? `?${qs}` : ''
      const [rDep, rEsp, rCust] = await Promise.all([
        authFetch(`/api/cartera/depositos${params}`),
        authFetch('/api/cartera/especies'),
        authFetch('/api/cartera/custodios'),
      ])
      const dDep  = await rDep.json()
      const dEsp  = await rEsp.json()
      const dCust = await rCust.json()
      setDepositos(dDep.data || [])
      setEspecies(dEsp.data || [])
      setCustodios(dCust.data || [])
      if (esAdmin) {
        const rU = await authFetch('/api/admin/usuarios')
        const dU = await rU.json()
        setUsuarios(dU.usuarios || [])
      }
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, esAdmin, verCobrados])

  useEffect(() => { cargar() }, [cargar])

  // Especies filtradas por tipo según modo
  const especiesPF = especies.filter(e =>
    ['plazo_fijo_ars', 'plazo_fijo_usd', 'caucion'].includes(e.tipo)
  )
  // Para garantía de caución: bonos/letras/acciones que cotizan
  const especiesGarantia = especies.filter(e =>
    ['bono_usd','bono_ars','bono_cer','bono_dv','letra_ars','letra_usd','on','accion','cedear'].includes(e.tipo)
  )

  // Cargar cotización de la garantía al elegirla
  useEffect(() => {
    if (modo !== 'caucion' || !form.garantia_ticker) { setCotizGarantia(null); return }
    authFetch(`/api/cartera/cotizacion/${form.garantia_ticker}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setCotizGarantia(d.data) })
      .catch(() => setCotizGarantia(null))
  }, [modo, form.garantia_ticker, authFetch])

  // Cálculo de VN de garantía necesarios
  const calculoAforo = useMemo(() => {
    if (modo !== 'caucion') return null
    const capital = parseFloat(form.capital || 0)
    const aforo   = parseFloat(form.aforo_pct || 0)
    if (!capital || !aforo || !cotizGarantia) return null

    // Precio según moneda de la garantía
    const precio = form.moneda === 'USD'
      ? parseFloat(cotizGarantia.precio_cierre_usd || 0)
      : parseFloat(cotizGarantia.precio_cierre_ars || 0)
    if (!precio) return { error: 'La especie en garantía no tiene cotización cargada' }

    // Valor de garantía necesario = capital / (aforo/100)
    const valorGarantia = capital / (aforo / 100)

    // VN necesarios: acciones por unidad, bonos cada 100
    const porUnidad = ['accion','cedear'].includes(cotizGarantia.tipo)
    const vnNecesarios = porUnidad
      ? valorGarantia / precio
      : valorGarantia * 100 / precio

    return { valorGarantia, vnNecesarios, precio, porUnidad }
  }, [modo, form.capital, form.aforo_pct, form.moneda, cotizGarantia])

  const fechaVto = useMemo(
    () => form.fecha_inicio && form.plazo_dias ? sumarDias(form.fecha_inicio, form.plazo_dias) : '',
    [form.fecha_inicio, form.plazo_dias]
  )

  const guardar = async () => {
    if (!form.ticker)       return setMensaje({ tipo: 'error', texto: 'Seleccioná la especie del depósito' })
    if (!form.capital)      return setMensaje({ tipo: 'error', texto: 'Ingresá el capital' })
    if (form.tna === '')    return setMensaje({ tipo: 'error', texto: 'Ingresá la TNA (puede ser 0)' })
    if (!form.plazo_dias)   return setMensaje({ tipo: 'error', texto: 'Ingresá el plazo en días' })
    if (modo === 'caucion') {
      if (!form.garantia_ticker) return setMensaje({ tipo: 'error', texto: 'Seleccioná la especie en garantía' })
      if (!form.aforo_pct)       return setMensaje({ tipo: 'error', texto: 'Ingresá el % de aforo' })
    }

    setGuardando(true)
    setMensaje(null)
    try {
      const body = {
        ticker:       form.ticker,
        capital:      parseFloat(form.capital),
        moneda:       form.moneda,
        tna:          parseFloat(form.tna),
        fecha_inicio: form.fecha_inicio,
        fecha_vto:    fechaVto,
        custodio_id:  form.custodio_id || null,
        notas:        form.notas || null,
        subtipo:      modo,
      }
      if (modo === 'caucion') {
        body.subyacente    = form.garantia_ticker
        body.aforo_pct     = parseFloat(form.aforo_pct)
        body.vn_subyacente = calculoAforo?.vnNecesarios ? Math.ceil(calculoAforo.vnNecesarios) : null
      }
      if (esAdmin && form.usuario_id) body.usuario_id = form.usuario_id

      const res  = await authFetch('/api/cartera/depositos', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')

      setMensaje({ tipo: 'ok', texto: `${modo === 'caucion' ? 'Caución' : 'Plazo fijo'} registrado correctamente` })
      setForm(f => ({ ...f, ticker: '', capital: '', tna: '', notas: '', garantia_ticker: '', aforo_pct: '' }))
      setMostrarForm(false)
      cargar()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este depósito?')) return
    try {
      await authFetch(`/api/cartera/depositos/${id}`, { method: 'DELETE' })
      cargar()
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🏦 Depósitos a Plazo</h1>
        <div className="flex items-center gap-3">
          {/* Los vencidos SIN cobrar se ven siempre: son plata esperando
              conciliación. Los cobrados son historia y se piden aparte. */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={verCobrados}
              onChange={e => setVerCobrados(e.target.checked)} />
            Ver también los cobrados
          </label>
          <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
          <button onClick={() => setMostrarForm(v => !v)}
            className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
            {mostrarForm ? '✕ Cerrar' : '＋ Nuevo depósito'}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          {/* Modo */}
          <div className="flex gap-3">
            <button onClick={() => setModo('plazo_fijo')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${modo === 'plazo_fijo' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
              🏦 Plazo Fijo
            </button>
            <button onClick={() => setModo('caucion')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${modo === 'caucion' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
              🔒 Caución
            </button>
          </div>

          {/* Especie del depósito */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
              {modo === 'caucion' ? 'Especie caución *' : 'Especie plazo fijo *'}
            </label>
            <select value={form.ticker} onChange={e => set('ticker', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Seleccionar...</option>
              {especiesPF.map(e => <option key={e.ticker} value={e.ticker}>{e.ticker} — {e.descripcion}</option>)}
            </select>
            {especiesPF.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No hay especies tipo plazo fijo o caución cargadas. Creá una en la hoja Especies.</p>
            )}
          </div>

          {/* Capital + Moneda + TNA */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Capital *</label>
              <input type="number" value={form.capital} onChange={e => set('capital', e.target.value)}
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
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">TNA % *</label>
              <input type="number" value={form.tna} onChange={e => set('tna', e.target.value)}
                placeholder="0 = sin interés" step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>

          {/* Fecha inicio + Plazo + Vto calculado */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Plazo (días) *</label>
              <input type="number" value={form.plazo_dias} onChange={e => set('plazo_dias', e.target.value)}
                placeholder="30" step="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Vencimiento</label>
              <input type="text" value={fechaVto ? fmtFecha(fechaVto) : '-'} readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
            </div>
          </div>

          {/* Campos de caución */}
          {modo === 'caucion' && (
            <div className="bg-purple-50 rounded-xl p-4 space-y-4 border border-purple-100">
              <p className="text-xs font-semibold text-purple-600 uppercase">Garantía de la caución</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Especie en garantía *</label>
                  <select value={form.garantia_ticker} onChange={e => set('garantia_ticker', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white">
                    <option value="">Seleccionar...</option>
                    {especiesGarantia.map(e => <option key={e.ticker} value={e.ticker}>{e.ticker} — {e.descripcion?.slice(0,25)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">% Aforo *</label>
                  <input type="number" value={form.aforo_pct} onChange={e => set('aforo_pct', e.target.value)}
                    placeholder="Ej: 80" step="any"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white" />
                </div>
              </div>

              {/* Resultado del cálculo de garantía */}
              {cotizGarantia && (
                <div className="text-xs text-gray-500">
                  Cotización {form.garantia_ticker} ({fmtFecha(cotizGarantia.fecha)}):
                  <span className="font-semibold ml-1">
                    {form.moneda} {fmt(form.moneda === 'USD' ? cotizGarantia.precio_cierre_usd : cotizGarantia.precio_cierre_ars, 4)}
                  </span>
                </div>
              )}
              {calculoAforo?.error && (
                <p className="text-xs text-red-500">⚠️ {calculoAforo.error}</p>
              )}
              {calculoAforo && !calculoAforo.error && (
                <div className="bg-white rounded-lg p-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Valor garantía necesario</p>
                    <p className="text-sm font-bold text-purple-700">{form.moneda} {fmt(calculoAforo.valorGarantia)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{calculoAforo.porUnidad ? 'Cantidad' : 'VN'} de garantía necesarios</p>
                    <p className="text-sm font-bold text-purple-700">{fmt(Math.ceil(calculoAforo.vnNecesarios), 0)}</p>
                  </div>
                </div>
              )}
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

          {/* Notas */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notas</label>
            <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Opcional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>

          {/* Impacto presupuesto + Guardar */}
          <div className="pt-4 border-t border-gray-100">
            {form.capital && (
              <div className="flex justify-between items-center mb-4 px-4 py-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-500">Egreso del presupuesto (inmoviliza fondos):</span>
                <span className="text-lg font-bold text-red-500">− {form.moneda} {fmt(form.capital)}</span>
              </div>
            )}
            <button onClick={guardar} disabled={guardando}
              className="w-full py-3 text-white rounded-lg font-semibold disabled:opacity-60"
              style={{ backgroundColor: modo === 'caucion' ? '#8e44ad' : '#4F6EF7' }}>
              {guardando ? 'Guardando...' : `Registrar ${modo === 'caucion' ? 'Caución' : 'Plazo Fijo'}`}
            </button>
          </div>
        </div>
      )}

      {/* Lista de depósitos */}
      {cargando ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
      ) : depositos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay depósitos {verCobrados ? '' : 'vigentes'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Tipo', 'Especie', 'Capital', 'TNA', 'Inicio', 'Vto', 'Plazo rest.', 'Devengado', 'Valor actual', 'Garantía', esAdmin ? 'Usuario' : null, '']
                    .filter(h => h !== null)
                    .map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {depositos.map(d => {
                  const plazoRest = d.dias_plazo - d.dias_transcurridos
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${d.subtipo === 'caucion' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          {d.subtipo === 'caucion' ? '🔒 Caución' : '🏦 PF'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-700">{d.ticker}</td>
                      <td className="px-3 py-3 text-sm">{d.moneda} {fmt(d.capital)}</td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#b5700a' }}>{fmt(d.tna)}%</td>
                      <td className="px-3 py-3 text-xs text-gray-400">{fmtFecha(d.fecha_inicio)}</td>
                      <td className="px-3 py-3 text-xs text-gray-400">{fmtFecha(d.fecha_vto)}</td>
                      <td className="px-3 py-3 text-sm">
                        {d.vencido ? (
                          <span className="text-red-600 font-semibold" title="Vencido y todavía sin cobrar: hay que conciliar el pago">
                            ⚠️ Vencido{d.dias_vencido > 0 ? ` hace ${d.dias_vencido} d` : ''}
                          </span>
                        ) : `${plazoRest} días`}
                      </td>
                      <td className="px-3 py-3 text-sm text-green-600">{d.moneda} {fmt(d.interes_devengado)}</td>
                      <td className="px-3 py-3 text-sm font-semibold">{d.moneda} {fmt(d.valor_actual)}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {d.subtipo === 'caucion' && d.subyacente
                          ? `${d.subyacente} (${fmt(d.vn_subyacente, 0)} VN, aforo ${fmt(d.aforo_pct, 0)}%)`
                          : '-'}
                      </td>
                      {esAdmin && <td className="px-3 py-3 text-xs text-gray-500">{d.usuario_nombre}</td>}
                      <td className="px-3 py-3">
                        {esAdmin && <button onClick={() => eliminar(d.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
