// pages/Especies.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const TIPOS_ESPECIE = [
  { v: 'bono_usd',       l: 'Bono USD' },
  { v: 'bono_ars',       l: 'Bono ARS' },
  { v: 'bono_cer',       l: 'Bono CER' },
  { v: 'bono_dv',        l: 'Bono Dollar Linked' },
  { v: 'letra_ars',      l: 'Letra ARS (LECAP)' },
  { v: 'letra_usd',      l: 'Letra USD (LETE)' },
  { v: 'on',             l: 'Obligación Negociable' },
  { v: 'fci_mm',         l: 'FCI Money Market' },
  { v: 'fci_rf',         l: 'FCI Renta Fija' },
  { v: 'fci_rv',         l: 'FCI Renta Variable' },
  { v: 'fci_mix',        l: 'FCI Mixto' },
  { v: 'accion',         l: 'Acción' },
  { v: 'cedear',         l: 'CEDEAR' },
  { v: 'plazo_fijo_ars', l: 'Plazo Fijo ARS' },
  { v: 'plazo_fijo_usd', l: 'Plazo Fijo USD' },
  { v: 'caucion',        l: 'Caución' },
  { v: 'futuro',         l: 'Futuro' },
  { v: 'opcion',         l: 'Opción' },
  { v: 'saldo_vista',    l: 'Saldo Vista' },
  { v: 'crypto',         l: 'Crypto' },
  { v: 'otro',           l: 'Otro' },
]

const MONEDAS = ['ARS', 'USD']

export default function Especies() {
  const { authFetch } = useAuth()
  const [especies, setEspecies]   = useState([])
  const [cargando, setCargando]   = useState(true)
  const [editando, setEditando]   = useState(null)
  const [form, setForm]           = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]     = useState(null)
  const [busqueda, setBusqueda]   = useState('')
  const [formNueva, setFormNueva] = useState({
    ticker: '', descripcion: '', tipo: 'bono_usd', moneda: 'USD', fecha_vto: ''
  })
  const [agregando, setAgregando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res  = await authFetch('/api/cartera/especies')
      const data = await res.json()
      setEspecies(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }, [authFetch])

  useEffect(() => { cargar() }, [cargar])

  const abrirEdicion = (especie) => {
    setEditando(especie.ticker)
    setForm({
      tipo:        especie.tipo,
      moneda:      especie.moneda,
      descripcion: especie.descripcion,
      fecha_vto:   especie.fecha_vto ? especie.fecha_vto.split('T')[0] : '',
    })
    setMensaje(null)
  }

  const cancelar = () => {
    setEditando(null)
    setForm({})
    setMensaje(null)
  }

  const guardar = async (ticker) => {
    setGuardando(true)
    setMensaje(null)
    try {
      const res  = await authFetch(`/api/cartera/especies/${ticker}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al guardar')
      setMensaje({ tipo: 'ok', texto: 'Guardado correctamente' })
      setEditando(null)
      cargar()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const agregarEspecie = async () => {
    const { ticker, descripcion, tipo, moneda } = formNueva
    if (!ticker || !descripcion || !tipo || !moneda) {
      setMensaje({ tipo: 'error', texto: 'Ticker, descripción, tipo y moneda son obligatorios' })
      return
    }
    setAgregando(true)
    setMensaje(null)
    try {
      const res  = await authFetch('/api/cartera/especies', {
        method: 'POST',
        body: JSON.stringify({
          ticker:      ticker.toUpperCase().trim(),
          descripcion: descripcion.trim(),
          tipo,
          moneda,
          fecha_vto:   formNueva.fecha_vto || null,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al agregar')
      setMensaje({ tipo: 'ok', texto: `Especie ${ticker.toUpperCase()} agregada correctamente` })
      setFormNueva({ ticker: '', descripcion: '', tipo: 'bono_usd', moneda: 'USD', fecha_vto: '' })
      cargar()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setAgregando(false)
    }
  }

  const toggleSeguimiento = async (ticker, valorActual) => {
    try {
      await authFetch(`/api/cartera/especies/${ticker}/seguimiento`, {
        method: 'PUT',
        body: JSON.stringify({ en_seguimiento: !valorActual }),
      })
      setEspecies(prev => prev.map(e =>
        e.ticker === ticker ? { ...e, en_seguimiento: !valorActual } : e
      ))
    } catch {}
  }

  const filtradas = especies.filter(e =>
    !busqueda ||
    e.ticker.toLowerCase().includes(busqueda.toLowerCase()) ||
    (e.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🏷️ Especies</h1>
        <button onClick={cargar} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">↻</button>
      </div>

      {/* Mensaje global */}
      {mensaje && (
        <div className={`px-4 py-3 rounded-lg text-sm ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
        </div>
      )}

      {/* Formulario nueva especie */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Nueva especie</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ticker *</label>
            <input
              type="text"
              value={formNueva.ticker}
              onChange={e => setFormNueva(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
              placeholder="Ej: GD35"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción *</label>
            <input
              type="text"
              value={formNueva.descripcion}
              onChange={e => setFormNueva(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Global 2035"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo *</label>
            <select
              value={formNueva.tipo}
              onChange={e => setFormNueva(f => ({ ...f, tipo: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            >
              {TIPOS_ESPECIE.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Moneda *</label>
            <select
              value={formNueva.moneda}
              onChange={e => setFormNueva(f => ({ ...f, moneda: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            >
              {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vencimiento</label>
            <input
              type="date"
              value={formNueva.fecha_vto}
              onChange={e => setFormNueva(f => ({ ...f, fecha_vto: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <button
            onClick={agregarEspecie}
            disabled={agregando}
            className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60"
            style={{ backgroundColor: '#4F6EF7' }}
          >
            {agregando ? 'Agregando...' : '＋ Agregar'}
          </button>
        </div>
      </div>

      {/* Buscador */}
      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por ticker o descripción..."
        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
      />

      {cargando ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Ticker', 'Descripción', 'Tipo', 'Moneda', 'Vencimiento', 'Activo', 'Seguimiento', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map((esp) => (
                <React.Fragment key={esp.ticker}>
                  {/* Fila normal */}
                  <tr className={`hover:bg-gray-50 ${editando === esp.ticker ? 'bg-indigo-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-white px-2 py-1 rounded bg-indigo-500">
                        {esp.ticker}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{esp.descripcion}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {TIPOS_ESPECIE.find(t => t.v === esp.tipo)?.l || esp.tipo}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${esp.moneda === 'USD' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {esp.moneda}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {esp.fecha_vto ? new Date(esp.fecha_vto).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${esp.activo ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {esp.activo ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSeguimiento(esp.ticker, esp.en_seguimiento)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          esp.en_seguimiento
                            ? 'bg-indigo-100 text-indigo-600 border-indigo-200 hover:bg-indigo-200'
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-indigo-50 hover:text-indigo-400'
                        }`}
                        title={esp.en_seguimiento ? 'Quitar del seguimiento' : 'Agregar al seguimiento'}
                      >
                        {esp.en_seguimiento ? '👁️ Sí' : '＋ No'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {editando !== esp.ticker && (
                        <button
                          onClick={() => abrirEdicion(esp)}
                          className="text-xs text-indigo-500 border border-indigo-200 rounded px-2 py-1 hover:bg-indigo-50"
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Fila de edición inline */}
                  {editando === esp.ticker && (
                    <tr className="bg-indigo-50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="flex flex-wrap gap-4 items-end">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                            <input
                              type="text"
                              value={form.descripcion || ''}
                              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-indigo-400 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                            <select
                              value={form.tipo || ''}
                              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
                            >
                              {TIPOS_ESPECIE.map(t => (
                                <option key={t.v} value={t.v}>{t.l}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Moneda</label>
                            <select
                              value={form.moneda || ''}
                              onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
                            >
                              {MONEDAS.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Vencimiento</label>
                            <input
                              type="date"
                              value={form.fecha_vto || ''}
                              onChange={e => setForm(f => ({ ...f, fecha_vto: e.target.value }))}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => guardar(esp.ticker)}
                              disabled={guardando}
                              className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60"
                              style={{ backgroundColor: '#4F6EF7' }}
                            >
                              {guardando ? 'Guardando...' : '✓ Guardar'}
                            </button>
                            <button
                              onClick={cancelar}
                              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-white"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
