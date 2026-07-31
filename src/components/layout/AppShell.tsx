import { Bookmark, ChefHat, Compass, Home, Leaf, Search, UserRound, Users, Utensils } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>
const navigation: Array<{ to: string; label: string; icon: Icon }> = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/me', label: 'Me', icon: UserRound },
]

function PrimaryNavigation({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="Primary navigation">
      {navigation.map(({ to, label, icon: NavigationIcon }) => (
        <NavLink to={to} end={to === '/'} key={to}>
          <NavigationIcon size={18} strokeWidth={2.1} /><span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [online, setOnline] = useState(navigator.onLine)
  const isCooking = location.pathname.startsWith('/cooking')

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {!online && <div className="offline-banner" role="status">You are offline. Saved page content remains available while you reconnect.</div>}
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Go to FoodMind home">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.6} /></span>
          <span>FoodMind</span>
        </Link>

        <div className="header-center">
          <div className="mode-switch" aria-label="Choose FoodMind mode">
            <Link className={!isCooking ? 'active' : ''} aria-current={!isCooking ? 'page' : undefined} to="/">
              <Utensils size={16} /><span>Eat out &amp; delivery</span>
            </Link>
            <Link className={isCooking ? 'active' : ''} aria-current={isCooking ? 'page' : undefined} to="/cooking">
              <ChefHat size={16} /><span>Cooking</span>
            </Link>
          </div>
          <PrimaryNavigation className="desktop-navigation" />
        </div>

        <div className="header-actions">
          <button className="header-icon" type="button" aria-label="Search FoodMind" onClick={() => navigate('/explore?search=true')}>
            <Search size={19} />
          </button>
          <Link className="avatar-button" to="/me" aria-label={`Open ${user?.displayName || 'your'} profile`}>
            {(user?.displayName || 'F').slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}><Outlet /></main>

      <PrimaryNavigation className="bottom-navigation" />
      <ScrollRestoration />
    </div>
  )
}
