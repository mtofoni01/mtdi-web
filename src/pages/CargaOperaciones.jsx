// pages/CargaOperaciones.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

function fmt(n, dec = 2) {
  return parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// Tipos de especie que son títulos/valores negociables (excluye FCI, PF, cauciones, etc.)
const TIPOS_TITULO = [
  'bono_usd', 'bono_ars', 'bono_cer', 'bono_dv',
  'letra_ars', 'letra_usd', 'on', 'ff', 'accion', 'cedear',
]

// Los que cotizan por unidad (no cada 100 VN)
const COTIZAN_POR_UNIDAD = ['accion', 'cedear']

export default function CargaOperaciones() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [especies, setEspecies]   = useState([])
  const [custodios, setCustodios] = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [mensaje, setMensaje]     = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [importeManual, setImporteManual] = useState(false)

  const hoy = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    ticker: '',
    tipo_op: 'compra',
    fecha: hoy,
    vn_cantidad: '',
    precio: '',
    importe: '',
    moneda: 'ARS',
    custodio_id: '',
    comision_bonificada: false,
    tir_compra: '',
    notas: '',
    usuario_id: '',  // solo admin
  })

  // Búsqueda de ticker
  const [busqueda, setBusqueda] = useState('')
  const [mostrarLista, setMostrarLista] = useState(false)

  // Cargar catálogos
  const cargarDatos = useCallback(async () => {
    try {
      const [rEsp, rCust] = await Promise.all([
        authFetch('/api/cartera/especies'),
        authFetch('/api/cartera/custodios'),
      ])
      const dEsp  = await rEsp.json()
      const dCust = await rCust.json()
      // Solo títulos negociables
      setEspecies((dEsp.data || []).filter(e => TIPOS_TITULO.includes(e.tipo)))
      setCustodios(dCust.data || [])

      if (esAdmin) {
        const rU = await authFetch('/api/admin/usuarios')
        const dU = await rU.json()
        setUsuarios(dU.usuarios || [])
      }
    } catch {}
  }, [authFetch, esAdmin])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // Especie seleccionada
  const especieSel = useMemo(
    () => especies.find(e => e.ticker === form.ticker),
    [especies, form.ticker]
  )

  // Autocálculo de importe
  useEffect(() => {
    if (importeManual) return
    const vn = parseFloat(form.vn_cantidad || 0)
    const pr = parseFloat(form.precio || 0)
    if (!vn || !pr || !especieSel) {
      setForm(f => ({ ...f, importe: '' }))
      return
    }
    const porUnidad = COTIZAN_POR_UNIDAD.includes(especieSel.tipo)
    const imp = porUnidad ? vn * pr : vn * pr / 100
    setForm(f => ({ ...f, importe: imp.toFixed(2) }))
  }, [form.vn_cantidad, form.precio, especieSel, importeManual])

  // Al elegir especie, setear moneda automáticamente
  const seleccionarEspecie = (esp) => {
    setForm(f => ({ ...f, ticker: esp.ticker, moneda: esp.moneda }))
    setBusqueda(esp.ticker)
    setMostrarLista(false)
  }

  const especiesFiltradas = especies.filter(e =>
    !busqueda ||
    e.ticker.toLowerCase().includes(busqueda.toLowerCase()) ||
    (e.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  ).slice(0, 8)

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const guardar = async () => {
    // Validaciones
    if (!form.ticker)      return setMensaje({ tipo: 'error', texto: 'Seleccioná un instrumento' })
    if (!form.fecha)       return setMensaje({ tipo: 'error', texto: 'Ingresá la fecha' })
    if (!form.vn_cantidad) return setMensaje({ tipo: 'error', texto: 'Ingresá VN / cantidad' })
    if (!form.precio)      return setMensaje({ tipo: 'error', texto: 'Ingresá el precio' })
    if (!form.importe)     return setMensaje({ tipo: 'error', texto: 'El importe no puede estar vacío' })

    setGuardando(true)
    setMensaje(null)
    try {
      const body = {
        ticker:      form.ticker,
        tipo_op:     form.tipo_op,
        fecha:       form.fecha,
        vn_cantidad: parseFloat(form.vn_cantidad),
        precio:      parseFloat(form.precio),
        importe:     parseFloat(form.importe),
        moneda:      form.moneda,
        custodio_id: form.custodio_id || null,
        comision_bonificada: form.comision_bonificada,
        notas:       form.notas || null,
      }
      if (esAdmin && form.usuario_id) body.usuario_id = form.usuario_id

      const res  = await authFetch('/api/cartera/operaciones', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')

      // Si es compra y hay TIR de compra, guardarla en la posición
      if (form.tipo_op === 'compra' && form.tir_compra) {
        try {
          await authFetch(`/api/cartera/posiciones/${form.ticker}/tir-compra`, {
            method: 'PUT',
            body: JSON.stringify({ tir_compra: parseFloat(form.tir_compra) }),
          })
        } catch {}
      }

      // Mensaje de éxito con resultado si fue venta
      let texto = `${form.tipo_op === 'compra' ? 'Compra' : 'Venta'} de ${form.ticker} registrada`
      if (form.tipo_op === 'venta' && data.resultado_importe !== null && data.resultado_importe !== undefined) {
        const signo = parseFloat(data.resultado_importe) >= 0 ? 'Ganancia' : 'Pérdida'
        texto += ` — ${signo}: ${form.moneda} ${fmt(Math.abs(data.resultado_importe))} (${fmt(data.resultado_pct)}%)`
      }
      setMensaje({ tipo: 'ok', texto })

      // Resetear form (mantener fecha, moneda, custodio)
      setForm(f => ({
        ...f,
        ticker: '', vn_cantidad: '', precio: '', importe: '',
        tir_compra: '', notas: '',
      }))
      setBusqueda('')
      setImporteManual(false)

    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const esCompra = form.tipo_op === 'compra'
  const esBono   = especieSel && !COTIZAN_POR_UNIDAD.includes(especieSel.tipo)

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800">📝 Carga de Operaciones</h1>
      <p className="text-sm text-gray-400 -mt-4">Compra y venta de títulos, bonos, acciones y CEDEARs</p>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">

        {/* Tipo de operación: toggle */}
        <div className="flex gap-3">
          <button
            onClick={() => set('tipo_op', 'compra')}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${esCompra ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
          >
            🟢 COMPRA
          </button>
          <button
            onClick={() => set('tipo_op', 'venta')}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${!esCompra ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
          >
            🔴 VENTA
          </button>
        </div>

        {/* Selector de ticker */}
        <div className="relative">
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Instrumento *</label>
          <input
            type="text"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value.toUpperCase()); setMostrarLista(true); set('ticker', '') }}
            onFocus={() => setMostrarLista(true)}
            placeholder="Buscar ticker o descripción..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
          />
          {mostrarLista && busqueda && especiesFiltradas.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {especiesFiltradas.map(e => (
                <div
                  key={e.ticker}
                  onClick={() => seleccionarEspecie(e)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                >
                  <div>
                    <span className="font-bold text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded mr-2">{e.ticker}</span>
                    <span className="text-gray-500 text-xs">{e.descripcion?.slice(0, 30)}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.moneda === 'USD' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {e.moneda}
                  </span>
                </div>
              ))}
            </div>
          )}
          {especieSel && (
            <p className="text-xs text-gray-400 mt-1">
              {especieSel.descripcion} · {especieSel.tipo?.replace(/_/g, ' ')} · {especieSel.moneda}
              {esBono ? ' · cotiza cada 100 VN' : ' · cotiza por unidad'}
            </p>
          )}
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

        {/* VN + Precio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
              {esBono ? 'Valor Nominal (VN) *' : 'Cantidad *'}
            </label>
            <input type="number" value={form.vn_cantidad} onChange={e => set('vn_cantidad', e.target.value)}
              placeholder="0" step="any"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Precio *</label>
            <input type="number" value={form.precio} onChange={e => set('precio', e.target.value)}
              placeholder="0.00" step="any"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
        </div>

        {/* Importe (autocalculado, editable) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Importe *</label>
            <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={importeManual} onChange={e => setImporteManual(e.target.checked)} />
              Editar manual
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{form.moneda}</span>
            <input type="number" value={form.importe}
              onChange={e => set('importe', e.target.value)}
              readOnly={!importeManual}
              placeholder="0.00" step="any"
              className={`flex-1 border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-400 ${importeManual ? 'border-gray-200' : 'border-gray-100 bg-gray-50 text-gray-600'}`} />
          </div>
          {!importeManual && especieSel && (
            <p className="text-xs text-gray-400 mt-1">
              Calculado: {esBono ? 'VN × precio / 100' : 'cantidad × precio'}
            </p>
          )}
        </div>

        {/* Custodio + Comisión */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Custodio</label>
            <select value={form.custodio_id} onChange={e => set('custodio_id', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Sin custodio</option>
              {custodios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-2">
              <input type="checkbox" checked={form.comision_bonificada}
                onChange={e => set('comision_bonificada', e.target.checked)} />
              Bonificar comisión
            </label>
          </div>
        </div>

        {/* TIR de compra (solo compras de bonos) */}
        {esCompra && esBono && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
              TIR de compra <span className="text-gray-300 normal-case">(opcional — podés calcularla en la Calculadora TIR)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="number" value={form.tir_compra} onChange={e => set('tir_compra', e.target.value)}
                placeholder="Ej: 8.42" step="any"
                className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              <span className="text-gray-400 text-sm">%</span>
            </div>
          </div>
        )}

        {/* Usuario (solo admin) */}
        {esAdmin && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
              Operar para usuario <span className="text-gray-300 normal-case">(vacío = tu propia cuenta)</span>
            </label>
            <select value={form.usuario_id} onChange={e => set('usuario_id', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Mi cuenta</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notas</label>
          <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        </div>

        {/* Resumen + Guardar */}
        <div className="pt-4 border-t border-gray-100">
          {form.importe && (
            <div className="flex justify-between items-center mb-4 px-4 py-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">
                {esCompra ? 'Egreso del presupuesto' : 'Ingreso al presupuesto'}:
              </span>
              <span className="text-lg font-bold" style={{ color: esCompra ? '#c5183c' : '#16a085' }}>
                {esCompra ? '−' : '+'} {form.moneda} {fmt(form.importe)}
              </span>
            </div>
          )}
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full py-3 text-white rounded-lg font-semibold disabled:opacity-60"
            style={{ backgroundColor: esCompra ? '#2d7d46' : '#c5183c' }}
          >
            {guardando ? 'Guardando...' : `Registrar ${esCompra ? 'Compra' : 'Venta'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
