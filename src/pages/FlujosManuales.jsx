// pages/FlujosManuales.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const fmt = (n, dec = 2) => parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const round6 = (x) => Math.round((Number(x) || 0) * 1e6) / 1e6

// Suma meses a una fecha ISO sin corrimiento por zona horaria
function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().split('T')[0]
}

const PERIODICIDADES = [
  { v: 1, l: 'Mensual' }, { v: 3, l: 'Trimestral' }, { v: 6, l: 'Semestral' }, { v: 12, l: 'Anual' },
]
const SISTEMAS = [
  { v: 'frances', l: 'Francés' }, { v: 'aleman', l: 'Alemán' }, { v: 'bullet', l: 'Bullet / Americano' },
]

export default function FlujosManuales() {
  const { authFetch, usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [especies, setEspecies]   = useState([])
  const [busqueda, setBusqueda]   = useState('')
  const [ticker, setTicker]       = useState('')
  const [nombreSel, setNombreSel] = useState('')
  const [unidad, setUnidad]       = useState('vn100')
  const [flujos, setFlujos]       = useState([])
  const [cargando, setCargando]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]     = useState(null)

  const [gen, setGen] = useState({
    capital: '', tasa: '', periodicidad: 6, cuotas: '', fechaInicio: '', sistema: 'frances',
  })

  useEffect(() => {
    authFetch('/api/cartera/especies')
      .then(r => r.json())
      .then(d => setEspecies(d.data || []))
      .catch(() => {})
  }, [authFetch])

  const especiesFiltradas = especies.filter(e =>
    !busqueda ||
    e.ticker.toLowerCase().includes(busqueda.toLowerCase()) ||
    (e.descripcion || e.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  ).slice(0, 30)

  const seleccionar = async (e) => {
    setTicker(e.ticker)
    setNombreSel(e.descripcion || e.nombre || '')
    setBusqueda('')
    setMensaje(null)
    setCargando(true)
    try {
      const res = await authFetch(`/api/cartera/flujos-manuales/${e.ticker}`)
      const d = await res.json()
      if (d.ok) {
        setUnidad(d.flujo_unidad || 'vn100')
        setFlujos((d.flujos || []).map(f => ({ fecha: f.fecha, amortizacion: f.amortizacion, renta: f.renta, nota: f.nota || '' })))
      } else {
        setUnidad('vn100'); setFlujos([])
      }
    } catch {
      setUnidad('vn100'); setFlujos([])
    } finally {
      setCargando(false)
    }
  }

  // ── Generador de cronograma ──────────────────────────────
  const generar = () => {
    const C = parseFloat(gen.capital), tna = parseFloat(gen.tasa)
    const n = parseInt(gen.cuotas), per = parseInt(gen.periodicidad)
    if (!C || !n || !gen.fechaInicio || isNaN(tna)) {
      return setMensaje({ tipo: 'error', texto: 'Completá capital/VN, tasa, cantidad de cuotas y fecha de inicio.' })
    }
    const i = (tna / 100) * (per / 12)  // tasa nominal proporcional al período
    const filas = []

    if (gen.sistema === 'frances') {
      const cuota = i === 0 ? C / n : C * i / (1 - Math.pow(1 + i, -n))
      let saldo = C
      for (let k = 1; k <= n; k++) {
        const interes = saldo * i
        const amort = k === n ? saldo : cuota - interes
        saldo -= amort
        filas.push({ fecha: addMonths(gen.fechaInicio, k * per), amortizacion: round6(amort), renta: round6(interes), nota: `Cuota ${k}/${n}` })
      }
    } else if (gen.sistema === 'aleman') {
      const amortFija = C / n
      let saldo = C
      for (let k = 1; k <= n; k++) {
        const interes = saldo * i
        const amort = k === n ? saldo : amortFija
        saldo -= amort
        filas.push({ fecha: addMonths(gen.fechaInicio, k * per), amortizacion: round6(amort), renta: round6(interes), nota: `Cuota ${k}/${n}` })
      }
    } else { // bullet / americano
      for (let k = 1; k <= n; k++) {
        filas.push({
          fecha: addMonths(gen.fechaInicio, k * per),
          amortizacion: k === n ? round6(C) : 0,
          renta: round6(C * i),
          nota: k === n ? 'Vencimiento' : `Renta ${k}/${n}`,
        })
      }
    }
    setFlujos(filas)
    setMensaje({ tipo: 'ok', texto: `Cronograma generado (${filas.length} cuotas). Editalo si hace falta y guardá.` })
  }

  // ── Edición de tabla ─────────────────────────────────────
  const setFila = (idx, campo, valor) => setFlujos(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f))
  const borrarFila = (idx) => setFlujos(prev => prev.filter((_, i) => i !== idx))
  const agregarFila = () => setFlujos(prev => [...prev, { fecha: '', amortizacion: 0, renta: 0, nota: '' }])

  const totales = flujos.reduce((a, f) => ({
    amort: a.amort + (parseFloat(f.amortizacion) || 0),
    renta: a.renta + (parseFloat(f.renta) || 0),
  }), { amort: 0, renta: 0 })

  const guardar = async () => {
    if (!ticker) return setMensaje({ tipo: 'error', texto: 'Elegí una especie primero.' })
    for (const f of flujos) {
      if (!f.fecha) return setMensaje({ tipo: 'error', texto: 'Todas las filas necesitan una fecha.' })
    }
    setGuardando(true); setMensaje(null)
    try {
      const res = await authFetch(`/api/cartera/flujos-manuales/${ticker}`, {
        method: 'POST',
        body: JSON.stringify({
          flujo_unidad: unidad,
          flujos: flujos.map(f => ({
            fecha: f.fecha,
            amortizacion: parseFloat(f.amortizacion) || 0,
            renta: parseFloat(f.renta) || 0,
            nota: f.nota || null,
          })),
        }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error || 'Error al guardar')
      setMensaje({ tipo: 'ok', texto: `Guardado: ${d.guardados} flujos para ${ticker}.` })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const borrarTodo = async () => {
    if (!ticker || !confirm(`¿Borrar todos los flujos guardados de ${ticker}?`)) return
    try {
      await authFetch(`/api/cartera/flujos-manuales/${ticker}`, { method: 'DELETE' })
      setFlujos([])
      setMensaje({ tipo: 'ok', texto: `Flujos de ${ticker} borrados.` })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    }
  }

  const unidadLabel = unidad === 'vn100' ? 'cada 100 VN' : 'montos absolutos'

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🧾 Flujos manuales</h1>
        <p className="text-sm text-gray-400 mt-1">
          Cronograma de pagos para especies fuera de Comafi (préstamos, fideicomisos con caída de cuotas propia).
        </p>
      </div>

      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Selector de especie */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Especie</label>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder={ticker ? `${ticker} — ${nombreSel}` : 'Buscar ticker o nombre...'}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
        />
        {busqueda && (
          <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {especiesFiltradas.map(e => (
              <button key={e.ticker} onClick={() => seleccionar(e)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-indigo-500">{e.ticker}</span>
                <span className="text-sm text-gray-600">{e.descripcion || e.nombre || ''}</span>
              </button>
            ))}
            {especiesFiltradas.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
            )}
          </div>
        )}
      </div>

      {cargando && (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      )}

      {ticker && !cargando && (
        <>
          {/* Unidad */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center gap-4">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase">{ticker}</span>
              <span className="text-sm text-gray-500 ml-2">{nombreSel}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-400">Unidad de los flujos:</span>
              <select value={unidad} onChange={e => setUnidad(e.target.value)} disabled={!esAdmin}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-indigo-400">
                <option value="vn100">Cada 100 VN</option>
                <option value="absoluto">Montos absolutos ($)</option>
              </select>
            </div>
          </div>

          {/* Generador */}
          {esAdmin && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Generar cronograma</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{unidad === 'vn100' ? 'VN (100)' : 'Capital'}</label>
                  <input type="number" step="any" value={gen.capital} onChange={e => setGen({ ...gen, capital: e.target.value })}
                    placeholder={unidad === 'vn100' ? '100' : '0'} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tasa nominal anual %</label>
                  <input type="number" step="any" value={gen.tasa} onChange={e => setGen({ ...gen, tasa: e.target.value })}
                    placeholder="0" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Periodicidad</label>
                  <select value={gen.periodicidad} onChange={e => setGen({ ...gen, periodicidad: parseInt(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                    {PERIODICIDADES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Cuotas</label>
                  <input type="number" value={gen.cuotas} onChange={e => setGen({ ...gen, cuotas: e.target.value })}
                    placeholder="12" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fecha 1ª cuota</label>
                  <input type="date" value={gen.fechaInicio} onChange={e => setGen({ ...gen, fechaInicio: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Sistema</label>
                  <select value={gen.sistema} onChange={e => setGen({ ...gen, sistema: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                    {SISTEMAS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button onClick={generar} className="px-4 py-2 text-sm text-white rounded-lg" style={{ backgroundColor: '#4F6EF7' }}>
                  Generar
                </button>
                <span className="text-xs text-gray-400">Reemplaza la tabla de abajo. Después podés editar fila por fila.</span>
              </div>
            </div>
          )}

          {/* Tabla editable */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Flujos <span className="text-xs font-normal text-gray-400">({unidadLabel})</span></h2>
              {esAdmin && (
                <button onClick={agregarFila} className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1 hover:bg-indigo-50">
                  + Agregar fila
                </button>
              )}
            </div>
            {flujos.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Sin flujos. Generá un cronograma o agregá filas a mano.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amortización</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Renta</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Nota</th>
                      {esAdmin && <th className="px-4 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {flujos.map((f, i) => {
                      const total = (parseFloat(f.amortizacion) || 0) + (parseFloat(f.renta) || 0)
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input type="date" value={f.fecha} disabled={!esAdmin} onChange={e => setFila(i, 'fecha', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-indigo-400" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" step="any" value={f.amortizacion} disabled={!esAdmin} onChange={e => setFila(i, 'amortizacion', e.target.value)}
                              className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-indigo-400" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" step="any" value={f.renta} disabled={!esAdmin} onChange={e => setFila(i, 'renta', e.target.value)}
                              className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-indigo-400" />
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-semibold text-gray-700">{fmt(total, 4)}</td>
                          <td className="px-4 py-2">
                            <input type="text" value={f.nota || ''} disabled={!esAdmin} onChange={e => setFila(i, 'nota', e.target.value)}
                              placeholder="—" className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-indigo-400" />
                          </td>
                          {esAdmin && (
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => borrarFila(i)} className="text-red-400 hover:text-red-600 text-sm">🗑️</button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-100">
                    <tr>
                      <td className="px-4 py-2 text-sm font-bold text-gray-700">Total</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-800">{fmt(totales.amort, 4)}</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-800">{fmt(totales.renta, 4)}</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-800">{fmt(totales.amort + totales.renta, 4)}</td>
                      <td colSpan={esAdmin ? 2 : 1}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Acciones */}
          {esAdmin && (
            <div className="flex items-center justify-between">
              <button onClick={borrarTodo} className="px-4 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                Borrar todos los flujos
              </button>
              <button onClick={guardar} disabled={guardando}
                className="px-6 py-2.5 text-white rounded-lg font-semibold disabled:opacity-60" style={{ backgroundColor: '#2d7d46' }}>
                {guardando ? 'Guardando...' : `Guardar flujos de ${ticker}`}
              </button>
            </div>
          )}

          {!esAdmin && (
            <p className="text-xs text-gray-400 text-center">Solo un administrador puede editar los flujos.</p>
          )}
        </>
      )}
    </div>
  )
}
