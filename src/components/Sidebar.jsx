import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AZUL = '#4F6EF7'

const navItems = [
  { to: '/cartera',    label: '📈 Mi cartera',       always: true },
  { to: '/watchlist',  label: '👁️ Watchlist',         always: true },
  { to: '/depositos',  label: '🏦 Depósitos',          always: true },
  { to: '/saldo',      label: '💰 Mi saldo',           always: true },
  { to: '/documentos', label: '📄 Documentos',         always: true },
  { to: '/gastos',     label: '💸 Gastos',             always: true },
  { to: '/usuarios',   label: '👥 Usuarios',           admin: true },
  { to: '/comisiones', label: '💹 Comisiones',         admin: true },
  { to: '/custodios',  label: '🏛️ Custodios',          admin: true },
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

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter(item => !item.admin || usuario?.rol === 'admin')
          .map(item => (
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
          ))
        }
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
