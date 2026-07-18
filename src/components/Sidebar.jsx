import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AZUL = '#4F6EF7'

// Menú agrupado en 3 secciones: Operación · Análisis · Administración
const secciones = [
  {
    titulo: 'Operación',
    items: [
      { to: '/cartera',           label: '📈 Mi cartera' },
      { to: '/reportes',          label: '📊 Reportes' },
      { to: '/movimientos',       label: '🔄 Movimientos' },
      { to: '/carga-operaciones', label: '📝 Cargar Operación' },
      { to: '/depositos',         label: '🏦 Depósitos' },
      { to: '/caja',              label: '💵 Movimientos de Caja' },
      { to: '/fci',               label: '📊 FCI' },
      { to: '/cobros',            label: '🎟️ Cobros' },
      { to: '/saldo',             label: '💰 Mi saldo' },
    ],
  },
  {
    titulo: 'Análisis',
    items: [
      { to: '/watchlist',          label: '👁️ Watchlist' },
      { to: '/evolucion',          label: '📈 Evolución', admin: true },
      { to: '/curva-rendimientos', label: '📉 Curva de Rendimientos' },
      { to: '/calculadora-tir',    label: '🧮 Calculadora TIR' },
      { to: '/flujos-manuales',    label: '🧾 Flujos manuales', admin: true },
      { to: '/cartera-objetivo',   label: '🎯 Cartera Objetivo', admin: true },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { to: '/documentos', label: '📄 Documentos' },
      { to: '/gastos',     label: '💸 Gastos' },
      { to: '/usuarios',   label: '👥 Usuarios',   admin: true },
      { to: '/comisiones', label: '💹 Comisiones', admin: true },
      { to: '/custodios',  label: '🏛️ Custodios',  admin: true },
      { to: '/especies',   label: '🏷️ Especies',   admin: true },
    ],
  },
]

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="w-64 min-h-screen bg-white shadow-lg flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="rounded-2xl flex items-center justify-center py-3 px-4" style={{ backgroundColor: AZUL }}>
          <span className="text-white text-2xl font-bold tracking-widest">MTDI</span>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">Inversiones & Gestión</p>
      </div>

      {/* Usuario */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="font-semibold text-gray-800 text-sm">{usuario?.nombre}</p>
        <p className="text-xs text-gray-400">{usuario?.email}</p>
        {usuario?.rol === 'admin' && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full mt-1 inline-block">
            Administrador
          </span>
        )}
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {secciones.map(seccion => {
          const visibles = seccion.items.filter(item => !item.admin || usuario?.rol === 'admin')
          if (visibles.length === 0) return null
          return (
            <div key={seccion.titulo}>
              <p className="px-3 mb-1 text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                {seccion.titulo}
              </p>
              <div className="space-y-1">
                {visibles.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full text-sm text-red-500 border border-red-200 rounded-lg py-2 hover:bg-red-50 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
