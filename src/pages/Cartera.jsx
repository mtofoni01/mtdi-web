import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import EspecieDetalle from '../components/EspecieDetalle'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function fmt(n, dec = 0) {
  return parseFloat(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec })
}

// Evalúa la frescura del precio: días de antigüedad y estado de alerta.
// Considera solo días hábiles aproximados (fin de semana no cuenta como atraso).
function estadoPrecio(fechaPrecio) {
  if (!fechaPrecio) return { dias: null, nivel: 'sin', texto: 'Sin precio' }
  const f = new Date(String(fechaPrecio).split('T')[0] + 'T12:00:00')
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)
  const diffMs = hoy - f
  const dias = Math.floor(diffMs / 86400000)
  // Descontar fines de semana del atraso (aprox)
  let habiles = 0
  for (let d = 1; d <= dias; d++) {
    const dd = new Date(f); dd.setDate(f.getDate() + d)
    const dow = dd.getDay()
    if (dow !== 0 && dow !== 6) habiles++
  }
  let nivel = 'ok'
  if (habiles >= 3) nivel = 'alerta'
  else if (habiles >= 1) nivel = 'aviso'
  return { dias, habiles, nivel, texto: fechaPrecio }
}

function abreviarVol(vol) {
  if (!vol) return '-'
  const n = parseFloat(vol)
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)} MM`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)} M`
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

const colorTipo = (tipo) => {
  const map = {
    bono_usd: '#1a6eb5', bono_ars: '#2d7d46', bono_cer: '#1a7a4a',
    bono_dv: '#0d6e8a', letra_ars: '#3a7d44', letra_usd: '#1a5f8a',
    on: '#2c5f8a', fci_mm: '#6c3fc5', fci_rf: '#5a32a8',
    fci_rv: '#7d1fa8', fci_mix: '#8a3fc5', accion: '#c5183c',
    cedear: '#a8142e', plazo_fijo_ars: '#b5700a', plazo_fijo_usd: '#8a5200',
  }
  return map[tipo] || '#555'
}

// ── Colores para tortas ───────────────────────────────────────────
const COLORES_TIPO = {
  bono_usd:       '#1a6eb5', bono_ars:       '#e67e22', bono_cer:  '#27ae60',
  bono_dv:        '#8e44ad', letra_ars:      '#e74c3c', letra_usd: '#2980b9',
  on:             '#16a085', fci_mm:         '#6c3fc5', fci_rf:    '#5a32a8',
  fci_rv:         '#7d1fa8', fci_mix:        '#8a3fc5', accion:    '#c5183c',
  cedear:         '#a8142e', plazo_fijo_ars: '#b5700a', plazo_fijo_usd: '#8a5200',
}
const COLORES_MONEDA  = { ARS: '#e67e22', USD: '#1a6eb5' }
const COLORES_CUSTODIO = ['#4F6EF7','#27ae60','#e67e22','#8e44ad','#e74c3c','#16a085','#f39c12','#2980b9']

const LABEL_TIPO = {
  bono_usd: 'Bono USD', bono_ars: 'Bono ARS', bono_cer: 'Bono CER',
  bono_dv: 'Dólar Linked', letra_ars: 'LECAP', letra_usd: 'LETE',
  on: 'ON', fci_mm: 'FCI MM', fci_rf: 'FCI RF', fci_rv: 'FCI RV',
  fci_mix: 'FCI Mix', accion: 'Acción', cedear: 'CEDEAR',
  plazo_fijo_ars: 'PF ARS', plazo_fijo_usd: 'PF USD',
}

const fmtTooltip = (value) => `$${parseFloat(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

function TortaCard({ titulo, datos, colorKey, colorMap }) {
  if (!datos || datos.length === 0) return null
  const total = datos.reduce((s, d) => s + d.value, 0)
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{titulo}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={datos}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {datos.map((entry, i) => (
              <Cell
                key={i}
                fill={colorMap ? (colorMap[entry[colorKey]] || COLORES_CUSTODIO[i % COLORES_CUSTODIO.length]) : COLORES_CUSTODIO[i % COLORES_CUSTODIO.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [fmtTooltip(v), name]}
            contentStyle={{ fontSize: 11 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-gray-400 mt-1">Total: ${parseFloat(total).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
    </div>
  )
}

// ── Componente de informes ─────────────────────────────────────────
function Informes({ posiciones }) {
  const [custodioFiltro, setCustodioFiltro] = useState('Todos')

  const custodios = ['Todos', ...new Set(
    posiciones.map(p => p.custodio_nombre).filter(Boolean)
  )]

  const items = custodioFiltro === 'Todos'
    ? posiciones
    : posiciones.filter(p => p.custodio_nombre === custodioFiltro)

  const totalARS = items.reduce((s, p) => s + parseFloat(p.valuacion_ars || 0), 0)
  const totalARSTodos = posiciones.reduce((s, p) => s + parseFloat(p.valuacion_ars || 0), 0)

  // ── Datos para tortas ─────────────────────────────────────────────

  // Por tipo
  const porTipoMap = items.reduce((acc, p) => {
    const t = p.tipo || 'otro'
    acc[t] = (acc[t] || 0) + parseFloat(p.valuacion_ars || 0)
    return acc
  }, {})
  const datosTipo = Object.entries(porTipoMap)
    .map(([tipo, value]) => ({ name: LABEL_TIPO[tipo] || tipo, value, tipo }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  // Por moneda
  const porMonedaMap = items.reduce((acc, p) => {
    const m = p.moneda || 'ARS'
    acc[m] = (acc[m] || 0) + parseFloat(p.valuacion_ars || 0)
    return acc
  }, {})
  const datosMoneda = Object.entries(porMonedaMap)
    .map(([moneda, value]) => ({ name: moneda, value, moneda }))
    .filter(d => d.value > 0)

  // Por custodio (solo cuando filtro = Todos)
  const porCustodioMap = posiciones.reduce((acc, p) => {
    const c = p.custodio_nombre || 'Sin custodio'
    acc[c] = (acc[c] || 0) + parseFloat(p.valuacion_ars || 0)
    return acc
  }, {})
  const datosCustodio = Object.entries(porCustodioMap)
    .map(([custodio, value]) => ({ name: custodio, value, custodio }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  // ── Tablas de detalle ─────────────────────────────────────────────
  const porMonedaDetalle = items.reduce((acc, p) => {
    const m = p.moneda || 'ARS'
    if (!acc[m]) acc[m] = { moneda: m, valuacion_ars: 0, valuacion_usd: 0, cantidad: 0 }
    acc[m].valuacion_ars += parseFloat(p.valuacion_ars || 0)
    acc[m].valuacion_usd += parseFloat(p.valuacion_usd || 0)
    acc[m].cantidad++
    return acc
  }, {})

  const porCustodioDetalle = posiciones.reduce((acc, p) => {
    const c = p.custodio_nombre || 'Sin custodio'
    if (!acc[c]) acc[c] = { custodio: c, valuacion_ars: 0, valuacion_usd: 0, cantidad: 0 }
    acc[c].valuacion_ars += parseFloat(p.valuacion_ars || 0)
    acc[c].valuacion_usd += parseFloat(p.valuacion_usd || 0)
    acc[c].cantidad++
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-700">📊 Informes de cartera</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Custodio</label>
          <select
            value={custodioFiltro}
            onChange={e => setCustodioFiltro(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          >
            {custodios.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Gráficos de torta */}
      <div className={`grid gap-4 ${custodioFiltro === 'Todos' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <TortaCard
          titulo={`Por tipo${custodioFiltro !== 'Todos' ? ` — ${custodioFiltro}` : ''}`}
          datos={datosTipo}
          colorKey="tipo"
          colorMap={COLORES_TIPO}
        />
        <TortaCard
          titulo={`Por moneda${custodioFiltro !== 'Todos' ? ` — ${custodioFiltro}` : ''}`}
          datos={datosMoneda}
          colorKey="moneda"
          colorMap={COLORES_MONEDA}
        />
        {custodioFiltro === 'Todos' && (
          <TortaCard
            titulo="Por custodio"
            datos={datosCustodio}
            colorKey="custodio"
            colorMap={null}
          />
        )}
      </div>

      {/* Tablas de detalle */}
      <div className="grid grid-cols-2 gap-6 pt-2 border-t border-gray-100">

        {/* Por moneda */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Detalle por moneda
            {custodioFiltro !== 'Todos' && <span className="text-indigo-400 ml-1">— {custodioFiltro}</span>}
          </p>
          <div className="space-y-2">
            {Object.values(porMonedaDetalle).map(m => {
              const pct = totalARS > 0 ? (m.valuacion_ars / totalARS * 100) : 0
              return (
                <div key={m.moneda}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-semibold">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-1 ${m.moneda === 'USD' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {m.moneda}
                      </span>
                      {m.cantidad} especie{m.cantidad !== 1 ? 's' : ''}
                    </span>
                    <span className="font-bold text-gray-700">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORES_MONEDA[m.moneda] || '#4F6EF7' }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>${fmt(m.valuacion_ars)}</span>
                    <span>USD {fmt(m.valuacion_usd, 2)}</span>
                  </div>
                </div>
              )
            })}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500 font-semibold">Total</span>
              <p className="font-bold text-gray-800">${fmt(totalARS)}</p>
            </div>
          </div>
        </div>

        {/* Por custodio */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Detalle por custodio</p>
          <div className="space-y-2">
            {Object.values(porCustodioDetalle)
              .sort((a, b) => b.valuacion_ars - a.valuacion_ars)
              .map((c, idx) => {
                const pct = totalARSTodos > 0 ? (c.valuacion_ars / totalARSTodos * 100) : 0
                const isActivo = custodioFiltro === c.custodio
                return (
                  <div
                    key={c.custodio}
                    className={`cursor-pointer rounded-lg p-1 -mx-1 transition-colors ${isActivo ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setCustodioFiltro(prev => prev === c.custodio ? 'Todos' : c.custodio)}
                  >
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className={`font-semibold ${isActivo ? 'text-indigo-600' : ''}`}>
                        🏛️ {c.custodio} <span className="text-gray-400 font-normal">({c.cantidad})</span>
                      </span>
                      <span className="font-bold text-gray-700">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORES_CUSTODIO[idx % COLORES_CUSTODIO.length] }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>${fmt(c.valuacion_ars)}</span>
                      <span>USD {fmt(c.valuacion_usd, 2)}</span>
                    </div>
                  </div>
                )
              })}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500 font-semibold">Total</span>
              <p className="font-bold text-gray-800">${fmt(totalARSTodos)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* TIR y Duration ponderadas */}
      {(() => {
        // Solo especies con tir y duration y valuacion > 0
        const conTir = items.filter(p => p.tir && parseFloat(p.tir) > 0 && parseFloat(p.valuacion_ars) > 0)
        const conDur = items.filter(p => p.duration && parseFloat(p.duration) > 0 && parseFloat(p.valuacion_ars) > 0)

        const sumValTir = conTir.reduce((s, p) => s + parseFloat(p.valuacion_ars), 0)
        const sumValDur = conDur.reduce((s, p) => s + parseFloat(p.valuacion_ars), 0)

        const tirPond = sumValTir > 0
          ? conTir.reduce((s, p) => s + parseFloat(p.tir) * parseFloat(p.valuacion_ars), 0) / sumValTir
          : null

        const durPond = sumValDur > 0
          ? conDur.reduce((s, p) => s + parseFloat(p.duration) * parseFloat(p.valuacion_ars), 0) / sumValDur
          : null

        if (!tirPond && !durPond) return null

        return (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Métricas ponderadas por valuación
              {custodioFiltro !== 'Todos' && <span className="text-indigo-400 ml-1">— {custodioFiltro}</span>}
            </p>
            <div className="grid grid-cols-2 gap-4">
              {tirPond !== null && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs text-amber-600 mb-1">TIR promedio ponderada</p>
                  <p className="text-2xl font-bold text-amber-700">{tirPond.toFixed(2)}%</p>
                  <p className="text-xs text-amber-500 mt-1">{conTir.length} especie{conTir.length !== 1 ? 's' : ''} con TIR</p>
                </div>
              )}
              {durPond !== null && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <p className="text-xs text-indigo-600 mb-1">Duration promedio ponderada</p>
                  <p className="text-2xl font-bold text-indigo-700">{durPond.toFixed(2)} <span className="text-sm font-normal">años</span></p>
                  <p className="text-xs text-indigo-400 mt-1">{conDur.length} especie{conDur.length !== 1 ? 's' : ''} con Duration</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

    </div>
  )
}

// ── Cartera principal ──────────────────────────────────────────────
export default function Cartera() {
  const { authFetch, usuario } = useAuth()
  const [posiciones, setPosiciones] = useState([])
  const [resumen, setResumen]       = useState(null)
  const [cargando, setCargando]     = useState(true)
  const [sortCol, setSortCol]       = useState('ticker')
  const [sortDir, setSortDir]       = useState('asc')
  const [seleccionado, setSeleccionado] = useState(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [estadoCierre, setEstadoCierre] = useState('')
  const [mostrarInformes, setMostrarInformes] = useState(false)
  const [dolar, setDolar] = useState(null)
  // Carga manual de precio
  const [modalPrecio, setModalPrecio] = useState(null)  // ticker en edición
  const [formPrecio, setFormPrecio] = useState({ fecha: '', precio_ars: '', precio_usd: '', tir: '', duration: '', volumen: '' })
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  // Nombres amigables de tipos de dólar
  const NOMBRE_DOLAR = {
    blue: 'Blue', bolsa: 'MEP', oficial: 'Oficial',
    contadoconliqui: 'CCL', mayorista: 'Mayorista', cripto: 'Cripto',
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const esAdmin = usuario?.rol === 'admin'
      const url = esAdmin ? '/api/cartera/posiciones?todos=true' : '/api/cartera/posiciones'
      const res  = await authFetch(url)
      const data = await res.json()
      const items = data.data || []
      setPosiciones(items)
      let totalARS = 0, totalUSD = 0
      items.forEach(p => {
        if (p.valuacion_ars) totalARS += parseFloat(p.valuacion_ars)
        if (p.valuacion_usd) totalUSD += parseFloat(p.valuacion_usd)
      })
      setResumen({ totalARS, totalUSD, cantidad: items.length })

      // Cargar el TC de valuación
      try {
        const rD = await authFetch('/api/cartera/dolar')
        const dD = await rD.json()
        if (dD.ok && dD.data) setDolar(dD.data)
      } catch {}
    } catch {}
    finally { setCargando(false) }
  }, [authFetch, usuario])

  useEffect(() => { cargar() }, [cargar])

  const verDetalle = (item) => {
    setSeleccionado(prev => prev?.ticker === item.ticker ? null : item)
  }

  // Abrir modal de carga manual, precargando lo que haya
  const abrirModalPrecio = (item, e) => {
    if (e) e.stopPropagation()
    const hoy = new Date().toISOString().split('T')[0]
    setFormPrecio({
      fecha: hoy,
      precio_ars: item.precio_cierre_ars || '',
      precio_usd: item.precio_cierre_usd || '',
      tir: item.tir || '',
      duration: item.duration || '',
      volumen: '',
    })
    setModalPrecio(item.ticker)
  }

  const guardarPrecioManual = async () => {
    setGuardandoPrecio(true)
    try {
      const res = await authFetch('/api/cartera/precio-manual', {
        method: 'POST',
        body: JSON.stringify({
          ticker: modalPrecio,
          fecha: formPrecio.fecha,
          precio_ars: formPrecio.precio_ars || null,
          precio_usd: formPrecio.precio_usd || null,
          tir: formPrecio.tir || null,
          duration: formPrecio.duration || null,
          volumen: formPrecio.volumen || null,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error')
      setModalPrecio(null)
      cargar()
    } catch (e) {
      alert(e.message)
    } finally {
      setGuardandoPrecio(false)
    }
  }

  const sort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...posiciones].sort((a, b) => {
    const va = a[sortCol] ?? ''
    const vb = b[sortCol] ?? ''
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb), undefined, { numeric: true })
      : String(vb).localeCompare(String(va), undefined, { numeric: true })
  })

  const ejecutarCierres = async () => {
    setEjecutando(true)
    setEstadoCierre('Iniciando actualización...')
    try {
      const res  = await authFetch('/api/cartera/ejecutar-cierres', { method: 'POST' })
      const data = await res.json()

      if (!data.ok) {
        setEstadoCierre('Error al iniciar')
        setEjecutando(false)
        return
      }

      // Polling del estado cada 4 segundos
      setEstadoCierre('Actualizando precios en segundo plano...')
      const intervalo = setInterval(async () => {
        try {
          const rEst = await authFetch('/api/cartera/estado-cierres')
          const est  = await rEst.json()

          if (est.status === 'done') {
            clearInterval(intervalo)
            const ins = est.resultado?.insertados ?? 0
            setEstadoCierre(`✓ Listo: ${ins} precios actualizados`)
            await cargar()
            setEjecutando(false)
            setTimeout(() => setEstadoCierre(''), 5000)
          } else if (est.status === 'error') {
            clearInterval(intervalo)
            setEstadoCierre(`Error: ${est.error || 'desconocido'}`)
            setEjecutando(false)
          } else if (est.status === 'running') {
            setEstadoCierre('Actualizando precios... (puede tardar ~1 min)')
          }
        } catch {
          // Si falla una consulta puntual, seguimos intentando
        }
      }, 4000)

      // Corte de seguridad a los 3 minutos
      setTimeout(() => {
        clearInterval(intervalo)
        if (ejecutando) {
          setEjecutando(false)
          setEstadoCierre('')
          cargar()
        }
      }, 180000)

    } catch {
      setEstadoCierre('Error de conexión')
      setEjecutando(false)
    }
  }

  const Th = ({ col, label }) => (
    <th onClick={() => sort(col)}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📈 Mi cartera</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setMostrarInformes(v => !v)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${mostrarInformes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            📊 Informes
          </button>
          <button onClick={cargar}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            ↻ Actualizar
          </button>
          {usuario?.rol === 'admin' && (
            <div className="flex items-center gap-2">
              {estadoCierre && (
                <span className="text-xs text-gray-500 max-w-xs">{estadoCierre}</span>
              )}
              <button onClick={ejecutarCierres} disabled={ejecutando}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60"
                style={{ backgroundColor: '#28a745' }}>
                {ejecutando ? 'Actualizando...' : '🔄 Actualizar precios'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-indigo-600 rounded-xl p-5 text-white">
            <p className="text-indigo-200 text-sm">Valuación ARS</p>
            <p className="text-2xl font-bold mt-1">${fmt(resumen.totalARS)}</p>
          </div>
          <div className="bg-indigo-500 rounded-xl p-5 text-white">
            <p className="text-indigo-200 text-sm">Valuación USD</p>
            <p className="text-2xl font-bold mt-1">USD {fmt(resumen.totalUSD)}</p>
            {dolar && (
              <p className="text-indigo-200 text-xs mt-2 pt-2 border-t border-indigo-400">
                Valuado a dólar {NOMBRE_DOLAR[dolar.tipo] || dolar.tipo}: ${fmt(dolar.valor, 2)}
                <span className="opacity-70"> · {new Date(String(dolar.fecha).split('T')[0] + 'T12:00:00').toLocaleDateString('es-AR')}</span>
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-gray-400 text-sm">Especies en cartera</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{resumen.cantidad}</p>
          </div>
        </div>
      )}

      {/* Alerta de precios desactualizados */}
      {(() => {
        const desact = posiciones.filter(p => {
          const ep = estadoPrecio(p.fecha_precio)
          return ep.nivel === 'alerta' || ep.nivel === 'sin'
        })
        if (desact.length === 0) return null
        return (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-sm text-red-700">
              <strong>{desact.length}</strong> tenencia(s) con precio desactualizado o sin precio:
              <span className="font-medium"> {desact.map(d => d.ticker).join(', ')}</span>.
              Revisá la columna "Actualizado" o cargá el precio manualmente.
            </span>
          </div>
        )
      })()}

      {/* Informes colapsables */}
      {mostrarInformes && posiciones.length > 0 && (
        <Informes posiciones={posiciones} />
      )}

      <div className="flex gap-6">
        {/* Tabla */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {cargando ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <Th col="ticker"             label="Ticker" />
                    <Th col="tipo"               label="Tipo" />
                    <Th col="vn_actual"          label="VN" />
                    <Th col="precio_promedio"    label="P. Compra" />
                    <Th col="precio_cierre_ars"  label="P. Mercado ARS" />
                    <Th col="precio_cierre_usd"  label="P. Mercado USD" />
                    <Th col="valuacion_ars"      label="Val. ARS" />
                    <Th col="valuacion_usd"      label="Val. USD" />
                    <Th col="resultado_pct"      label="Result. %" />
                    <Th col="tir"                label="TIR Mdo" />
                    <Th col="tir_compra"         label="TIR Compra" />
                    <Th col="duration"           label="MD" />
                    <Th col="volumen_operado"    label="Volumen" />
                    <Th col="custodio_nombre"    label="Custodio" />
                    <Th col="fecha_precio"       label="Actualizado" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((item, i) => {
                    const pct = parseFloat(item.resultado_pct || 0)
                    const isSelected = seleccionado?.ticker === item.ticker
                    return (
                      <tr key={i} onClick={() => verDetalle(item)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-white px-2 py-1 rounded"
                            style={{ backgroundColor: colorTipo(item.tipo) }}>
                            {item.ticker}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.tipo?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm">{fmt(item.vn_actual)}</td>
                        <td className="px-4 py-3 text-sm">{parseFloat(item.precio_promedio || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">{item.precio_cierre_ars ? fmt(item.precio_cierre_ars) : '-'}</td>
                        <td className="px-4 py-3 text-sm">{item.precio_cierre_usd ? parseFloat(item.precio_cierre_usd).toFixed(2) : '-'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-indigo-600">${fmt(item.valuacion_ars)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-indigo-600">USD {fmt(item.valuacion_usd)}</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: pct >= 0 ? '#27ae60' : '#e74c3c' }}>
                          {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#b5700a' }}>
                          {item.tir ? `${parseFloat(item.tir).toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.tir_compra ? (() => {
                            const tirC = parseFloat(item.tir_compra)
                            const tirM = item.tir ? parseFloat(item.tir) : null
                            // Señal: TIR mercado < TIR compra → precio subió → oportunidad de venta
                            const oportunidad = tirM !== null && tirM < tirC
                            const dif = tirM !== null ? (tirM - tirC).toFixed(2) : null
                            return (
                              <div className="flex items-center gap-1">
                                <span style={{ color: '#8e44ad' }} className="font-semibold">
                                  {tirC.toFixed(2)}%
                                </span>
                                {dif !== null && (
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: oportunidad ? '#d4edda' : '#f8d7da',
                                      color: oportunidad ? '#155724' : '#721c24',
                                    }}
                                    title={oportunidad
                                      ? 'TIR mercado bajó → precio subió → oportunidad de venta con ganancia'
                                      : 'TIR mercado subió → precio bajó'}
                                  >
                                    {oportunidad ? '↑💰' : '↓'} {dif > 0 ? '+' : ''}{dif}
                                  </span>
                                )}
                              </div>
                            )
                          })() : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#b5700a' }}>
                          {item.duration ? parseFloat(item.duration).toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{abreviarVol(item.volumen_operado)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.custodio_nombre || '-'}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const ep = estadoPrecio(item.fecha_precio)
                            if (ep.nivel === 'sin') {
                              return (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold">Sin precio</span>
                                  {usuario?.rol === 'admin' && (
                                    <button onClick={(e) => abrirModalPrecio(item, e)}
                                      className="text-gray-300 hover:text-indigo-500 text-xs" title="Cargar precio manual">✏️</button>
                                  )}
                                </span>
                              )
                            }
                            const colores = {
                              ok:     { bg: 'transparent', tx: '#9ca3af', label: '' },
                              aviso:  { bg: '#fef3c7', tx: '#92400e', label: '⚠' },
                              alerta: { bg: '#fee2e2', tx: '#b91c1c', label: '⚠' },
                            }
                            const c = colores[ep.nivel]
                            const fechaTxt = new Date(String(item.fecha_precio).split('T')[0] + 'T12:00:00').toLocaleDateString('es-AR')
                            const esManual = (item.fuente || '').toLowerCase().includes('manual')
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1"
                                    style={{ backgroundColor: c.bg, color: c.tx }}
                                    title={ep.nivel === 'ok' ? 'Precio actualizado' : `Desactualizado hace ${ep.habiles} día(s) hábil(es)`}>
                                    {c.label} {fechaTxt}
                                  </span>
                                  {usuario?.rol === 'admin' && (
                                    <button onClick={(e) => abrirModalPrecio(item, e)}
                                      className="text-gray-300 hover:text-indigo-500 text-xs" title="Cargar precio manual">✏️</button>
                                  )}
                                </span>
                                {item.fuente && (
                                  <span className="text-[10px] px-1.5 rounded"
                                    style={esManual
                                      ? { backgroundColor: '#ede9fe', color: '#7c3aed' }
                                      : { color: '#cbd5e1' }}>
                                    {esManual ? '✎ manual' : item.fuente}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel de detalle */}
        {seleccionado && (
          <EspecieDetalle
            ticker={seleccionado.ticker}
            datosBasicos={seleccionado}
            onCerrar={() => setSeleccionado(null)}
          />
        )}
      </div>

      {/* Modal de carga manual de precio */}
      {modalPrecio && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setModalPrecio(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Cargar precio: {modalPrecio}</h3>
              <button onClick={() => setModalPrecio(null)} className="text-gray-300 hover:text-gray-500">✕</button>
            </div>
            <p className="text-xs text-gray-400">
              Carga manual (fuente: manual). Ingresá al menos un precio. La otra moneda se completa con el TC si la dejás vacía.
            </p>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fecha de cotización *</label>
              <input type="date" value={formPrecio.fecha} onChange={e => setFormPrecio(f => ({ ...f, fecha: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Precio ARS</label>
                <input type="number" step="any" value={formPrecio.precio_ars} onChange={e => setFormPrecio(f => ({ ...f, precio_ars: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Precio USD</label>
                <input type="number" step="any" value={formPrecio.precio_usd} onChange={e => setFormPrecio(f => ({ ...f, precio_usd: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">TIR %</label>
                <input type="number" step="any" value={formPrecio.tir} onChange={e => setFormPrecio(f => ({ ...f, tir: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Duration</label>
                <input type="number" step="any" value={formPrecio.duration} onChange={e => setFormPrecio(f => ({ ...f, duration: e.target.value }))}
                  placeholder="años"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Volumen</label>
                <input type="number" step="any" value={formPrecio.volumen} onChange={e => setFormPrecio(f => ({ ...f, volumen: e.target.value }))}
                  placeholder="opc."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalPrecio(null)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={guardarPrecioManual} disabled={guardandoPrecio}
                className="flex-1 py-2 text-sm text-white rounded-lg disabled:opacity-60" style={{ backgroundColor: '#4F6EF7' }}>
                {guardandoPrecio ? 'Guardando...' : 'Guardar precio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
