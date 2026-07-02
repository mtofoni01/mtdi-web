import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Cartera from './pages/Cartera'
import Watchlist from './pages/Watchlist'
import CurvaRendimientos from './pages/CurvaRendimientos'
import Depositos from './pages/Depositos'
import Saldo from './pages/Saldo'
import Documentos from './pages/Documentos'
import Gastos from './pages/Gastos'
import Usuarios from './pages/Usuarios'
import Comisiones from './pages/Comisiones'
import Custodios from './pages/Custodios'
import Especies from './pages/Especies'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/cartera" replace />} />
            <Route path="cartera"             element={<Cartera />} />
            <Route path="watchlist"           element={<Watchlist />} />
            <Route path="curva-rendimientos"  element={<CurvaRendimientos />} />
            <Route path="depositos"           element={<Depositos />} />
            <Route path="saldo"               element={<Saldo />} />
            <Route path="documentos"          element={<Documentos />} />
            <Route path="gastos"              element={<Gastos />} />
            <Route path="usuarios"            element={<Usuarios />} />
            <Route path="comisiones"          element={<Comisiones />} />
            <Route path="custodios"           element={<Custodios />} />
            <Route path="especies"            element={<Especies />} />
          </Route>
          <Route path="*" element={<Navigate to="/cartera" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
