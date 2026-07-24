// pages/MovimientosCaja.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function hoy() {
  return new Date().toISOString().split('T')[0]
}

export default function MovimientosCaja() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  // modo: caja (depósito/extracción) | pase
  const [modo, setModo] = useState('caja')
  const [usuarios, setUsuarios] = useState([])
  const [especiesVista, setEspeciesVista] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  // Form caja
  const [caja, setCaja] = useState({
    operacion: 'aporte',  // aporte | retiro | deposito_saldo | extraccion_saldo
    importe: '',
    moneda: 'ARS',
    fecha: hoy(),
    notas: '',
    usuario_id: '',
    especie_ticker: '',   // cuenta a la vista (para depósito/extracción)
  })

  // Form pase
  const [pase, setPase] = useState({
    moneda_origen: 'ARS',
    monto_origen: '',
    tc_pase: '',
    fecha: hoy(),
    notas: '',
  })

  const setC = (k, v) => setCaja(f => ({ ...f, [k]: v }))
  const setP = (k, v) => setPase(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!esAdmin) return
    authFetch('/api/admin/usuarios').then(r => r.json()).then(d => setUsuarios(d.usuarios || [])).catch(() => {})
  }, [authFetch, esAdmin])

  // Cuentas a la vista disponibles (especies tipo 'vista')
  useEffect(() => {
    authFetch('/api/cartera/especies')
      .then(r => r.json())
      .then(d => setEspeciesVista((d.data || []).filter(e => e.tipo === 'saldo_vista' && e.ticker !== 'CAJA')))
      .catch(() => {})
  }, [authFetch])

  // Cálculo del pase
  const monedaDestino = pase.moneda_origen === 'ARS' ? 'USD' : 'ARS'
  const montoDestino = useMemo(() => {
    const mo = parseFloat(pase.monto_origen || 0)
    const tc = parseFloat(pase.tc_pase || 0)
    if (!mo || !tc) return null
    // ARS→USD: divide por TC. USD→ARS: multiplica por TC.
    return pase.moneda_origen === 'ARS' ? mo / tc : mo * tc
  }, [pase.monto_origen, pase.tc_pase, pase.moneda_origen])

  // Metadata de cada operación de caja
  const OPS_CAJA = {
    aporte:           { label: 'Aporte de capital',    tipo_op: 'aporte',           efecto: 'suma', desc: 'Aporte de capital (ingreso desde el exterior)' },
    retiro:           { label: 'Retiro de capital',    tipo_op: 'retiro',           efecto: 'resta', desc: 'Retiro de capital (egreso al exterior)' },
    deposito_saldo:   { label: 'Depósito a la vista',  tipo_op: 'deposito_saldo',   efecto: 'resta', desc: 'Colocación en cuenta a la vista' },
    extraccion_saldo: { label: 'Extracción a la vista',tipo_op: 'extraccion_saldo', efecto: 'suma', desc: 'Liberación de cuenta a la vista' },
  }

  // ── Guardar caja ──
  const guardarCaja = async () => {
    if (!caja.importe) return setMensaje({ tipo: 'error', texto: 'Ingresá el importe' })

    setGuardando(true)
    setMensaje(null)
    try {
      const op = OPS_CAJA[caja.operacion]
      const esVista = ['deposito_saldo', 'extraccion_saldo'].includes(caja.operacion)
      if (esVista && !caja.especie_ticker) {
        setGuardando(false)
        return setMensaje({ tipo: 'error', texto: 'Elegí la cuenta a la vista' })
      }
      const body = {
        ticker: esVista ? caja.especie_ticker : 'CAJA',
        tipo_op: op.tipo_op,
        fecha: caja.fecha,
        vn_cantidad: 0,
        precio: 0,
        importe: parseFloat(caja.importe),
        moneda: caja.moneda,
        notas: caja.notas || op.desc,
      }
      if (esAdmin && caja.usuario_id) body.usuario_id = caja.usuario_id

      const res = await authFetch('/api/cartera/operaciones', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')

      setMensaje({ tipo: 'ok', texto: `${op.label} de ${caja.moneda} ${fmt(caja.importe)} registrado` })
      setCaja(f => ({ ...f, importe: '', notas: '' }))
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  // ── Guardar pase de moneda ──
  const guardarPase = async () => {
    if (!pase.monto_origen) return setMensaje({ tipo: 'error', texto: 'Ingresá el monto a convertir' })
    if (!pase.tc_pase)      return setMensaje({ tipo: 'error', texto: 'Ingresá el tipo de cambio' })
    if (!montoDestino)      return setMensaje({ tipo: 'error', texto: 'No se pudo calcular el monto destino' })

    setGuardando(true)
    setMensaje(null)
    try {
      const body = {
        moneda_origen:  pase.moneda_origen,
        monto_origen:   parseFloat(pase.monto_origen),
        moneda_destino: monedaDestino,
        monto_destino:  parseFloat(montoDestino.toFixed(2)),
        tc_pase:        parseFloat(pase.tc_pase),
        fecha:          pase.fecha,
        notas:          pase.notas || null,
      }
      const res = await authFetch('/api/pase-moneda', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')

      setMensaje({
        tipo: 'ok',
        texto: `Pase registrado: ${pase.moneda_origen} ${fmt(pase.monto_origen)} → ${monedaDestino} ${fmt(montoDestino)}`
      })
      setPase(f => ({ ...f, monto_origen: '', notas: '' }))
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">💵 Movimientos de Caja</h1>
      <p className="text-sm text-gray-400 -mt-4">Depósitos y extracciones a la vista · Pases de moneda</p>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Selector de modo */}
      <div className="flex gap-3">
        <button onClick={() => { setModo('caja'); setMensaje(null) }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${modo === 'caja' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
          💵 Depósito / Extracción
        </button>
        <button onClick={() => { setModo('pase'); setMensaje(null) }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${modo === 'pase' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
          🔄 Pase de Moneda
        </button>
      </div>

      {/* ── FORM CAJA ── */}
      {modo === 'caja' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          {/* Grupo 1: Aporte / Retiro (flujo con el exterior) */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Flujo de capital (con el exterior)</p>
            <div className="flex gap-3">
              <button onClick={() => setC('operacion', 'aporte')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${caja.operacion === 'aporte' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                ⬆️ Aporte (+)
              </button>
              <button onClick={() => setC('operacion', 'retiro')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${caja.operacion === 'retiro' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                ⬇️ Retiro (−)
              </button>
            </div>
          </div>

          {/* Grupo 2: Depósito / Extracción a la vista (dentro del sistema) */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Cuenta a la vista (dentro del sistema)</p>
            <div className="flex gap-3">
              <button onClick={() => setC('operacion', 'deposito_saldo')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${caja.operacion === 'deposito_saldo' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                🔒 Depósito (−)
              </button>
              <button onClick={() => setC('operacion', 'extraccion_saldo')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${caja.operacion === 'extraccion_saldo' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                🔓 Extracción (+)
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 italic">{OPS_CAJA[caja.operacion].desc}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Importe *</label>
              <input type="number" value={caja.importe} onChange={e => setC('importe', e.target.value)}
                placeholder="0.00" step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Moneda *</label>
              <select value={caja.moneda} onChange={e => setC('moneda', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fecha *</label>
              <input type="date" value={caja.fecha} onChange={e => setC('fecha', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            {esAdmin && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Para usuario</label>
                <select value={caja.usuario_id} onChange={e => setC('usuario_id', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                  <option value="">Mi cuenta</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            )}
          </div>

          {['deposito_saldo', 'extraccion_saldo'].includes(caja.operacion) && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cuenta a la vista *</label>
              <select value={caja.especie_ticker} onChange={e => setC('especie_ticker', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                <option value="">Elegí la cuenta...</option>
                {especiesVista.map(e => <option key={e.id} value={e.ticker}>{e.ticker} — {e.descripcion} ({e.moneda})</option>)}
              </select>
              {especiesVista.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay cuentas a la vista creadas. Creá una especie tipo "vista" en Especies (ej. CCBLP).</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notas</label>
            <input type="text" value={caja.notas} onChange={e => setC('notas', e.target.value)}
              placeholder="Opcional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>

          <div className="pt-4 border-t border-gray-100">
            {caja.importe && (
              <div className="flex justify-between items-center mb-4 px-4 py-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-500">
                  {OPS_CAJA[caja.operacion].efecto === 'suma' ? 'Ingreso al' : 'Egreso del'} presupuesto:
                </span>
                <span className="text-lg font-bold" style={{ color: OPS_CAJA[caja.operacion].efecto === 'suma' ? '#16a085' : '#c5183c' }}>
                  {OPS_CAJA[caja.operacion].efecto === 'suma' ? '+' : '−'} {caja.moneda} {fmt(caja.importe)}
                </span>
              </div>
            )}
            <button onClick={guardarCaja} disabled={guardando}
              className="w-full py-3 text-white rounded-lg font-semibold disabled:opacity-60"
              style={{ backgroundColor: OPS_CAJA[caja.operacion].efecto === 'suma' ? '#16a085' : '#c5183c' }}>
              {guardando ? 'Guardando...' : `Registrar ${OPS_CAJA[caja.operacion].label}`}
            </button>
          </div>
        </div>
      )}

      {/* ── FORM PASE ── */}
      {modo === 'pase' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Moneda origen *</label>
              <select value={pase.moneda_origen} onChange={e => setP('moneda_origen', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
                <option value="ARS">ARS → USD</option>
                <option value="USD">USD → ARS</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fecha *</label>
              <input type="date" value={pase.fecha} onChange={e => setP('fecha', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                Monto a convertir ({pase.moneda_origen}) *
              </label>
              <input type="number" value={pase.monto_origen} onChange={e => setP('monto_origen', e.target.value)}
                placeholder="0.00" step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Tipo de cambio *</label>
              <input type="number" value={pase.tc_pase} onChange={e => setP('tc_pase', e.target.value)}
                placeholder="Ej: 1200" step="any"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
            </div>
          </div>

          {/* Resultado del pase */}
          {montoDestino !== null && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-400">Egresa</p>
                  <p className="text-lg font-bold text-red-500">− {pase.moneda_origen} {fmt(pase.monto_origen)}</p>
                </div>
                <div className="text-2xl text-purple-400">→</div>
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-400">Ingresa</p>
                  <p className="text-lg font-bold text-green-600">+ {monedaDestino} {fmt(montoDestino)}</p>
                </div>
              </div>
              <p className="text-center text-xs text-gray-400 mt-2">
                TC: {fmt(pase.tc_pase)} · {pase.moneda_origen === 'ARS' ? 'divide' : 'multiplica'} por el tipo de cambio
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notas</label>
            <input type="text" value={pase.notas} onChange={e => setP('notas', e.target.value)}
              placeholder="Opcional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
          </div>

          <button onClick={guardarPase} disabled={guardando}
            className="w-full py-3 text-white rounded-lg font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#8e44ad' }}>
            {guardando ? 'Guardando...' : 'Registrar Pase de Moneda'}
          </button>
        </div>
      )}
    </div>
  )
}
