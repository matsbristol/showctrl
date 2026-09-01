import { Outlet } from 'react-router-dom'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import './App.css'

export default function App() {
  return (
    <div className="app-container">
      <Header />
      <div className="app-content">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
