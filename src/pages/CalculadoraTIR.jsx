// pages/CalculadoraTIR.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

// ── Newton-Raphson para calcular TIR ─────────────────────────────────
// flows: array de { t, total } donde t es tiempo en años y total es el flujo
// precio: precio sucio pagado (por cada 100 de VN)
function calcularTIR(flujos, precio) {
  if (!flujos || flujos.length === 0 || !precio) return null

  // Función valor presente dado tasa r
  const vp = (r) => flujos.reduce((s, f) => s + f.total / Math.pow(1 + r, f.t), 0)
  // Derivada
  const dvp = (r) => flujos.reduce((s, f) => s - f.t * f.total / Math.pow(1 + r, f.t + 1), 0)

  let r = 0.08 // semilla inicial 8%
  for (let i = 0; i < 200; i++) {
    const fx  = vp(r) - precio
    const dfx = dvp(r)
    if (Math.abs(dfx) < 1e-12) break
    const r1 = r - fx / dfx
    if (Math.abs(r1 - r) < 1e-8) { r = r1; break }
    r = r1
    if (r < -0.99) return null // divergió
  }
  return r * 100 // retorna en %
}

function fmtFecha(f) {
  if (!f) return '-'
  // Si viene DD/MM/YYYY
  if (f.includes('/')) return f
  // Si viene YYYY-MM-DD
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

// Calcula el tiempo en años (t) desde hoy hasta una fecha DD/MM/YYYY
function calcularT(fechaStr) {
  if (!fechaStr) return null
  let dd, mm, yyyy
  if (fechaStr.includes('/')) {
    [dd, mm, yyyy] = fechaStr.split('/')
  } else if (fechaStr.includes('-')) {
    [yyyy, mm, dd] = fechaStr.split('-')
  } else {
    return null
  }
  const fecha = new Date(`${yyyy}-${mm}-${dd}T12:00:00`)
  const hoy   = new Date()
  const dias  = (fecha - hoy) / (1000 * 60 * 60 * 24)
  return dias / 365
}

// Valor presente + duration de los flujos, valuando a una fecha (YYYY-MM-DD).
// Descuenta solo los flujos futuros a esa fecha, a la tasa tirPct.
function valuarFlujos(flujos, tirPct, fechaBaseISO) {
  const r = tirPct / 100
  const base = fechaBaseISO ? new Date(`${fechaBaseISO}T12:00:00`) : new Date()
  let precio = 0, sumtVP = 0
  for (const f of flujos) {
    const fs = f.fecha
    if (!fs) continue
    let dd, mm, yyyy
    if (fs.includes('/')) { [dd, mm, yyyy] = fs.split('/') }
    else if (fs.includes('-')) { [yyyy, mm, dd] = fs.split('-') }
    else continue
    const t = (new Date(`${yyyy}-${mm}-${dd}T12:00:00`) - base) / (1000 * 60 * 60 * 24) / 365
    if (t <= 0) continue  // solo flujos futuros a la fecha de valuación
    const vp = f.total / Math.pow(1 + r, t)
    precio += vp
    sumtVP += t * vp
  }
  const macaulay = precio > 0 ? sumtVP / precio : 0
  return { precio, macaulay, modified: macaulay / (1 + r) }
}

export default function CalculadoraTIR() {
  const { authFetch, token } = useAuth()
  const [especies, setEspecies]     = useState([])
  const [busqueda, setBusqueda]     = useState('')
  const [ticker, setTicker]         = useState('')
  const [precio, setPrecio]         = useState('')
  const [cargandoEsp, setCargandoEsp] = useState(true)
  const [cargandoFlujos, setCargandoFlujos] = useState(false)
  const [datosBono, setDatosBono]   = useState(null)
  const [tirCompra, setTirCompra]   = useState(null)
  const [guardando, setGuardando]   = useState(false)
  const [mensaje, setMensaje]       = useState(null)
  const [tienePosicion, setTienePosicion] = useState(false)
  const hoyISO = new Date().toISOString().split('T')[0]
  // Valuación técnica (precio + duration a una fecha, descontando a una TIR)
  const [valTir, setValTir]       = useState('')
  const [valFecha, setValFecha]   = useState(hoyISO)
  const [valResult, setValResult] = useState(null)
  const [cargandoVal, setCargandoVal] = useState(false)
  // Conversor TC (ARS ⇄ USD)
  const [fechaTc, setFechaTc] = useState(hoyISO)
  const [tcData, setTcData]   = useState(null)  // { valor, tipo, fecha }
  const [convArs, setConvArs] = useState('')
  const [convUsd, setConvUsd] = useState('')
  // Conversor CER (monto base ⇄ ajustado)
  const [fechaCer, setFechaCer] = useState(hoyISO)
  const [cerData, setCerData]   = useState(null)  // { valor, fecha }
  const [montoBase, setMontoBase]         = useState('')
  const [montoAjustado, setMontoAjustado] = useState('')

  const NOMBRE_DOLAR = {
    blue: 'Blue', bolsa: 'MEP', oficial: 'Oficial',
    contadoconliqui: 'CCL', mayorista: 'Mayorista', cripto: 'Cripto',
  }

  // TC de la fecha seleccionada
  useEffect(() => {
    authFetch(`/api/cartera/dolar?fecha=${fechaTc}`)
      .then(r => r.json())
      .then(d => setTcData(d.ok && d.data ? d.data : null))
      .catch(() => setTcData(null))
  }, [authFetch, fechaTc])

  // CER de la fecha seleccionada
  useEffect(() => {
    authFetch(`/api/cartera/cer?fecha=${fechaCer}`)
      .then(r => r.json())
      .then(d => setCerData(d.ok ? { valor: d.valor, fecha: d.fecha_valor } : null))
      .catch(() => setCerData(null))
  }, [authFetch, fechaCer])

  // Conversor TC: ARS ⇄ USD al dólar de la fecha elegida
  const tcCalc = tcData?.valor || null
  const onArs = (v) => { setConvArs(v); setConvUsd(tcCalc && v ? (parseFloat(v) / tcCalc).toFixed(2) : '') }
  const onUsd = (v) => { setConvUsd(v); setConvArs(tcCalc && v ? (parseFloat(v) * tcCalc).toFixed(2) : '') }

  // Conversor CER: monto base ⇄ monto ajustado (× CER de la fecha elegida)
  const cerVal = cerData?.valor || null
  const onBase = (v) => { setMontoBase(v); setMontoAjustado(cerVal && v ? (parseFloat(v) * cerVal).toFixed(2) : '') }
  const onAjustado = (v) => { setMontoAjustado(v); setMontoBase(cerVal && v ? (parseFloat(v) / cerVal).toFixed(2) : '') }

  // Cargar lista de especies Comafi
  const cargarEspecies = useCallback(async () => {
    setCargandoEsp(true)
    try {
      const res  = await authFetch('/api/cartera/comafi')
      const data = await res.json()
      setEspecies(data.data || [])
    } catch {}
    finally { setCargandoEsp(false) }
  }, [authFetch])

  useEffect(() => { cargarEspecies() }, [cargarEspecies])

  // Cargar flujos al seleccionar ticker
  const cargarFlujos = async (tk) => {
    if (!tk) return
    setCargandoFlujos(true)
    setDatosBono(null)
    setTirCompra(null)
    setMensaje(null)
    try {
      const res  = await authFetch(`/api/cartera/flujos/${tk}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setDatosBono(data)
      setTienePosicion(true)  // siempre permitimos intentar guardar; el backend valida

    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setCargandoFlujos(false)
    }
  }

  const seleccionarTicker = (tk) => {
    setTicker(tk)
    setBusqueda(tk)
    setPrecio('')
    cargarFlujos(tk)
  }

  // Calcular TIR al cambiar precio
  const calcular = () => {
    if (!datosBono || !precio) return
    const p = parseFloat(precio)
    if (isNaN(p) || p <= 0) return

    // Para cada flujo, usar el t de Comafi si existe; si no, calcularlo desde la fecha
    const flujos = datosBono.flujos
      .map(f => ({
        t:     (f.t !== null && f.t > 0) ? f.t : calcularT(f.fecha),
        total: f.total,
      }))
      .filter(f => f.t !== null && f.t > 0)

    const tir = calcularTIR(flujos, p)
    setTirCompra(tir)
    setMensaje(null)
  }

  // Guardar TIR de compra en posición
  const guardarTIR = async () => {
    if (!ticker || tirCompra === null) return
    setGuardando(true)
    setMensaje(null)
    try {
      const res  = await authFetch(`/api/cartera/posiciones/${ticker}/tir-compra`, {
        method: 'PUT',
        body: JSON.stringify({ tir_compra: parseFloat(tirCompra.toFixed(4)) }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setMensaje({ tipo: 'ok', texto: `TIR de compra ${tirCompra.toFixed(2)}% guardada en posición ${ticker}` })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  // Valuación técnica: precio + duration a una fecha, descontando a una TIR
  const valuar = () => {
    if (!datosBono?.flujos?.length) return
    const tir = parseFloat(valTir !== '' ? valTir : tirCompra)
    if (isNaN(tir)) { setMensaje({ tipo: 'error', texto: 'Ingresá una TIR, o calculala con un precio primero.' }); return }
    const r = valuarFlujos(datosBono.flujos, tir, valFecha)
    if (r.precio <= 0) { setMensaje({ tipo: 'error', texto: 'No hay flujos futuros a esa fecha.' }); return }
    setValResult({ ...r, tir })
    setMensaje(null)
  }

  const cargarValuacion = async () => {
    if (!valResult || !ticker) return
    setCargandoVal(true)
    setMensaje(null)
    try {
      const esUSD = datosBono.moneda === 'USD'
      const p = Math.round(valResult.precio * 1e4) / 1e4
      const res = await authFetch('/api/cartera/precio-manual', {
        method: 'POST',
        body: JSON.stringify({
          ticker, fecha: valFecha,
          precio_ars: esUSD ? null : p,
          precio_usd: esUSD ? p : null,
          tir: Math.round(valResult.tir * 1e4) / 1e4,
          duration: Math.round(valResult.modified * 1e4) / 1e4,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setMensaje({ tipo: 'ok', texto: `Cargado en ${ticker} al ${valFecha}: precio ${p}, duration ${valResult.modified.toFixed(2)}.` })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setCargandoVal(false)
    }
  }

  // Descargar Excel de flujos
  const descargarExcel = async () => {
    if (!ticker) return
    try {
      const params = new URLSearchParams()
      if (precio)          params.set('precio', precio)
      if (tirCompra !== null) params.set('tir', tirCompra.toFixed(4))

      const url = `https://backend-login-production-6dd0.up.railway.app/api/cartera/flujos/${ticker}/excel?${params}`
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al generar el Excel')

      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `flujos_${ticker}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(link.href)
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    }
  }

  const especiesFiltradas = especies.filter(e =>
    !busqueda ||
    e.ticker.toLowerCase().includes(busqueda.toLowerCase()) ||
    (e.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  ).slice(0, 10)

  const diferenciaTIR = tirCompra !== null && datosBono?.tir
    ? (datosBono.tir - tirCompra).toFixed(2)
    : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">🧮 Calculadora TIR</h1>

      {/* Conversores: TC (ARS⇄USD) y CER (base⇄ajustado), cada uno con su fecha */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversor TC */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">TC {NOMBRE_DOLAR[tcData?.tipo] || tcData?.tipo || ''}</span>
              {tcData && <span className="text-lg font-bold text-indigo-600">${parseFloat(tcData.valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
            </div>
            <input type="date" value={fechaTc} onChange={e => setFechaTc(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-400" />
          </div>
          {tcData ? (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">ARS</label>
                  <input type="number" value={convArs} onChange={e => onArs(e.target.value)} placeholder="0" step="any"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <span className="text-gray-300 pb-2">⇄</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">USD</label>
                  <input type="number" value={convUsd} onChange={e => onUsd(e.target.value)} placeholder="0" step="any"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              {tcData.fecha && <p className="text-[11px] text-gray-400 mt-2">TC al {new Date(tcData.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</p>}
            </>
          ) : (
            <p className="text-xs text-gray-400">Sin TC para esa fecha.</p>
          )}
        </div>

        {/* Conversor CER */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-gray-500 uppercase">CER</span>
              {cerData && <span className="text-lg font-bold text-emerald-600">{Number(cerData.valor).toFixed(4)}</span>}
            </div>
            <input type="date" value={fechaCer} onChange={e => setFechaCer(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-400" />
          </div>
          {cerData ? (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Monto base</label>
                  <input type="number" value={montoBase} onChange={e => onBase(e.target.value)} placeholder="0" step="any"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>
                <span className="text-gray-300 pb-2">⇄</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Ajustado <span className="normal-case">(× CER)</span></label>
                  <input type="number" value={montoAjustado} onChange={e => onAjustado(e.target.value)} placeholder="0" step="any"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>
              </div>
              {cerData.fecha && <p className="text-[11px] text-gray-400 mt-2">CER al {new Date(cerData.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</p>}
            </>
          ) : (
            <p className="text-xs text-gray-400">Sin CER para esa fecha.</p>
          )}
        </div>
      </div>


      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">

        {/* ── Panel izquierdo: selector + input ── */}
        <div className="space-y-4">

          {/* Buscador de ticker */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">
              Seleccionar instrumento
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setTicker('') }}
              placeholder="Buscar ticker o nombre..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 mb-2"
            />
            {cargandoEsp ? (
              <p className="text-xs text-gray-400 text-center py-2">Cargando...</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {especiesFiltradas.map(e => (
                  <div
                    key={e.ticker}
                    onClick={() => seleccionarTicker(e.ticker)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${ticker === e.ticker ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                  >
                    <div>
                      <span className="font-bold text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded mr-2">{e.ticker}</span>
                      <span className="text-gray-500 text-xs">{e.nombre?.slice(0, 25)}</span>
                    </div>
                    {e.tir_mercado && (
                      <span className="text-xs font-semibold" style={{ color: '#b5700a' }}>
                        {parseFloat(e.tir_mercado).toFixed(2)}%
                      </span>
                    )}
                  </div>
                ))}
                {especiesFiltradas.length === 0 && busqueda && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
                )}
              </div>
            )}
          </div>

          {/* Input precio */}
          {datosBono && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <label className="text-xs font-semibold text-gray-500 uppercase block">
                Precio sucio de compra
              </label>
              <p className="text-xs text-gray-400">
                Precio de mercado actual: <span className="font-semibold text-gray-700">{datosBono.precio}</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={precio}
                  onChange={e => { setPrecio(e.target.value); setTirCompra(null) }}
                  placeholder={`Ej: ${datosBono.precio}`}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                  step="0.01"
                />
                <button
                  onClick={calcular}
                  disabled={!precio}
                  className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: '#4F6EF7' }}
                >
                  Calcular
                </button>
              </div>

              {/* Resultado TIR */}
              {tirCompra !== null && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                      <p className="text-xs text-amber-600 mb-1">TIR de compra</p>
                      <p className="text-2xl font-bold text-amber-700">{tirCompra.toFixed(2)}%</p>
                    </div>
                    <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                      <p className="text-xs text-indigo-600 mb-1">TIR de mercado</p>
                      <p className="text-2xl font-bold text-indigo-700">{parseFloat(datosBono.tir).toFixed(2)}%</p>
                    </div>
                  </div>

                  {diferenciaTIR !== null && (
                    <div className={`rounded-xl p-3 border text-center ${parseFloat(diferenciaTIR) > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs text-gray-500 mb-1">
                        {parseFloat(diferenciaTIR) > 0
                          ? '📈 TIR mercado > TIR compra — precio bajó'
                          : '📉 TIR mercado < TIR compra — precio subió → posible ganancia'}
                      </p>
                      <p className={`text-lg font-bold ${parseFloat(diferenciaTIR) > 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {parseFloat(diferenciaTIR) > 0 ? '+' : ''}{diferenciaTIR} pp
                      </p>
                    </div>
                  )}

                  {tienePosicion && (
                    <button
                      onClick={guardarTIR}
                      disabled={guardando}
                      className="w-full py-2 text-sm text-white rounded-lg disabled:opacity-60"
                      style={{ backgroundColor: '#28a745' }}
                    >
                      {guardando ? 'Guardando...' : `💾 Guardar TIR en posición ${ticker}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Panel derecho: datos del bono + flujos ── */}
        <div className="col-span-2 space-y-4">
          {cargandoFlujos && (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          {datosBono && !cargandoFlujos && (
            <>
              {/* Datos del bono */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-bold text-white px-3 py-1 rounded bg-indigo-500">{datosBono.ticker}</span>
                  <span className="text-gray-600 font-semibold">{datosBono.nombre}</span>
                  <span className="text-xs text-gray-400 ml-auto">{datosBono.moneda}</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { l: 'Precio sucio', v: datosBono.precio },
                    { l: 'Precio limpio', v: datosBono.techValue },
                    { l: 'Interés corrido', v: datosBono.accInt },
                    { l: 'TIR mercado', v: `${parseFloat(datosBono.tir).toFixed(2)}%` },
                    { l: 'Duration', v: `${parseFloat(datosBono.duration || 0).toFixed(2)} años` },
                    { l: 'Vencimiento', v: fmtFecha(datosBono.vencimiento) },
                    { l: 'Próx. cupón', v: fmtFecha(datosBono.proximoCupon) },
                    { l: 'Valor cupón', v: datosBono.proximoCuponValor },
                  ].map(({ l, v }) => (
                    <div key={l}>
                      <p className="text-xs text-gray-400">{l}</p>
                      <p className="text-sm font-semibold text-gray-800">{v ?? '-'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Valuación técnica */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-700 mb-3">
                  Valuación técnica <span className="text-xs font-normal text-gray-400">(descuenta los flujos futuros a una TIR)</span>
                </h3>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">TIR %</label>
                    <input type="number" step="any" value={valTir} onChange={e => setValTir(e.target.value)}
                      placeholder={tirCompra !== null ? tirCompra.toFixed(2) : '0'}
                      className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Valuar al</label>
                    <input type="date" value={valFecha} onChange={e => setValFecha(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                  </div>
                  <button onClick={valuar} className="px-4 py-1.5 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
                    Valuar
                  </button>
                  {tirCompra !== null && (
                    <button onClick={() => setValTir(tirCompra.toFixed(4))} className="text-xs text-indigo-600 underline">
                      usar TIR calculada ({tirCompra.toFixed(2)}%)
                    </button>
                  )}
                </div>
                {valResult && (
                  <div className="mt-4 flex flex-wrap items-end gap-6 border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-xs text-gray-400">Precio técnico ({datosBono.moneda}, c/100 VN)</p>
                      <p className="text-2xl font-bold text-indigo-700">{valResult.precio.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Duration modificada</p>
                      <p className="text-2xl font-bold text-gray-800">{valResult.modified.toFixed(2)} años</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">TIR usada</p>
                      <p className="text-lg font-semibold text-amber-700">{valResult.tir.toFixed(2)}%</p>
                    </div>
                    <button onClick={cargarValuacion} disabled={cargandoVal}
                      className="ml-auto px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60" style={{ backgroundColor: '#28a745' }}>
                      {cargandoVal ? 'Cargando...' : `💾 Cargar a Cartera (${valFecha})`}
                    </button>
                  </div>
                )}
              </div>

              {/* Tabla de flujos */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Flujos futuros</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">en {datosBono.moneda} por cada 100 VN</span>
                    <button
                      onClick={descargarExcel}
                      className="px-3 py-1.5 text-xs text-white rounded-lg"
                      style={{ backgroundColor: '#16a085' }}
                    >
                      📊 Exportar Excel
                    </button>
                  </div>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Fecha', 'Amortización', 'Interés', 'Total', 't (años)'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {datosBono.flujos.map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{fmtFecha(f.fecha)}</td>
                        <td className="px-4 py-3 text-sm text-indigo-600">{f.amort?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-green-600">{f.interes?.toFixed(4)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-800">{f.total?.toFixed(4)}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{f.t?.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500">TOTAL</td>
                      <td className="px-4 py-3 text-sm font-bold text-indigo-600">
                        {datosBono.flujos.reduce((s, f) => s + (f.amort || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        {datosBono.flujos.reduce((s, f) => s + (f.interes || 0), 0).toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">
                        {datosBono.flujos.reduce((s, f) => s + (f.total || 0), 0).toFixed(4)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {!datosBono && !cargandoFlujos && (
            <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400">
              Seleccioná un instrumento para ver sus flujos
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
