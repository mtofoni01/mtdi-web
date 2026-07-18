import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Cartera from './pages/Cartera'
import Reportes from './pages/Reportes'
import Evolucion from './pages/Evolucion'
import Movimientos from './pages/Movimientos'
import CargaOperaciones from './pages/CargaOperaciones'
import Watchlist from './pages/Watchlist'
import CurvaRendimientos from './pages/CurvaRendimientos'
import CalculadoraTIR from './pages/CalculadoraTIR'
import FlujosManuales from './pages/FlujosManuales'
import CarteraObjetivo from './pages/CarteraObjetivo'
import Depositos from './pages/Depositos'
import MovimientosCaja from './pages/MovimientosCaja'
import FCI from './pages/FCI'
import Cobros from './pages/Cobros'
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
            <Route path="reportes"            element={<Reportes />} />
            <Route path="evolucion"           element={<Evolucion />} />
            <Route path="movimientos"         element={<Movimientos />} />
            <Route path="carga-operaciones"   element={<CargaOperaciones />} />
            <Route path="watchlist"           element={<Watchlist />} />
            <Route path="curva-rendimientos"  element={<CurvaRendimientos />} />
            <Route path="calculadora-tir"    element={<CalculadoraTIR />} />
            <Route path="flujos-manuales"     element={<FlujosManuales />} />
            <Route path="cartera-objetivo"    element={<CarteraObjetivo />} />
            <Route path="depositos"           element={<Depositos />} />
            <Route path="caja"                element={<MovimientosCaja />} />
            <Route path="fci"                 element={<FCI />} />
            <Route path="cobros"              element={<Cobros />} />
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
