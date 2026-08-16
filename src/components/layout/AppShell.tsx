import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Bot,
  ChefHat,
  Clock3,
  Compass,
  Home,
  Leaf,
  LogOut,
  PackageOpen,
  Plus,
  Search,
  ShoppingBasket,
  UserRound,
  Users,
  Utensils,
} from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>
type NavigationItem = { to: string; label: string; icon: Icon; end?: boolean }

const primaryNavigation: NavigationItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/saved', label: 'Saved', icon: Bookmark },
]

const toolNavigation: NavigationItem[] = [
  { to: '/shopping-lists', label: 'Shopping', icon: ShoppingBasket },
  { to: '/inventory', label: 'Inventory', icon: PackageOpen },
  { to: '/history', label: 'History', icon: Clock3 },
  { to: '/dashboard', label: 'Insights', icon: BarChart3 },
]

const mobileNavigation: NavigationItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/me', label: 'Me', icon: UserRound },
]

function Navigation({ className, items, label }: { className: string; items: NavigationItem[]; label: string }) {
  return (
    <nav className={className} aria-label={label}>
      {items.map(({ to, label: itemLabel, icon: NavigationIcon, end }) => (
        <NavLink className={({ isActive }) => isActive ? 'active' : ''} aria-label={itemLabel} to={to} end={end} key={to}>
          <NavigationIcon size={19} strokeWidth={2.05} /><span>{itemLabel}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [online, setOnline] = useState(navigator.onLine)
  const [globalQuery, setGlobalQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isCooking = /^\/(cooking|inventory|shopping-lists)(\/|$)/.test(location.pathname)
  const showMobileRecordAction = !/^\/(cooking|inventory|shopping-lists|chat|records|saved\/recipes)(\/|$)/.test(location.pathname)
  const displayName = user?.displayName || 'FoodMind user'
  const initial = displayName.slice(0, 1).toUpperCase()

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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const searchFoodMind = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = globalQuery.trim()
    navigate(query ? `/explore?q=${encodeURIComponent(query)}` : '/explore?search=true')
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <aside className="app-sidebar">
        <Link className="brand" to="/" aria-label="Go to FoodMind home">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.6} /></span>
          <span>FoodMind</span>
        </Link>

        <div className="sidebar-scroll">
          <p className="sidebar-label">Discover</p>
          <Navigation className="sidebar-navigation" items={primaryNavigation} label="Primary navigation" />

          <Link className="sidebar-create" to="/records/new">
            <Plus size={18} /><span>Add a record</span><ArrowRight size={16} />
          </Link>

          <p className="sidebar-label">Your FoodMind</p>
          <Navigation className="sidebar-navigation sidebar-tools" items={toolNavigation} label="FoodMind tools" />
        </div>

        <Link className="sidebar-profile" to="/me" aria-label={`Open ${displayName}'s profile`}>
          <span className="sidebar-avatar">{initial}</span>
          <span><strong>{displayName}</strong><small>{user?.email || 'Open your profile'}</small></span>
          <ArrowRight size={16} />
        </Link>
      </aside>

      <div className="app-workspace">
        {!online && <div className="offline-banner" role="status">You are offline. Saved content remains available while you reconnect.</div>}
        <header className="app-header">
          <Link className="brand mobile-brand" to="/" aria-label="Go to FoodMind home">
            <span className="brand-mark"><Leaf size={18} strokeWidth={2.6} /></span>
            <span>FoodMind</span>
          </Link>

          <form className="global-search" role="search" onSubmit={searchFoodMind}>
            <Search size={18} />
            <label className="sr-only" htmlFor="global-search">Search FoodMind</label>
            <input id="global-search" value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="Search meals, places, products…" />
            <button type="submit" aria-label="Submit search"><ArrowRight size={15} /></button>
          </form>

          <div className="mode-switch" aria-label="Choose FoodMind mode">
            <Link className={!isCooking ? 'active' : ''} aria-current={!isCooking ? 'page' : undefined} to="/">
              <Utensils size={16} /><span>Eat out</span>
            </Link>
            <Link className={isCooking ? 'active' : ''} aria-current={isCooking ? 'page' : undefined} to="/cooking">
              <ChefHat size={16} /><span>Cook</span>
            </Link>
          </div>

          <div className="header-actions">
            <button className="header-icon mobile-search-action" type="button" aria-label="Search FoodMind" onClick={() => navigate('/explore?search=true')}>
              <Search size={19} />
            </button>
            <NavLink className={({ isActive }) => `header-icon assistant-button${isActive ? ' active' : ''}`} to="/chat" aria-label="Ask FoodMind chatbot">
              <Bot size={19} /><span>Ask</span>
            </NavLink>

            <div className="avatar-menu" ref={menuRef}>
              <button className="avatar-button" type="button" aria-label={`${displayName}'s account menu`} onClick={() => setMenuOpen((open) => !open)}>
                {initial}
              </button>
              {menuOpen && <div className="avatar-dropdown">
                <Link to="/me" onClick={() => setMenuOpen(false)}><UserRound size={16} /> Profile</Link>
                <button type="button" onClick={() => { setMenuOpen(false); void logout(false) }}><LogOut size={16} /> Sign out</button>
              </div>}
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}><Outlet /></main>
      </div>

      {showMobileRecordAction && <Link className="mobile-record-fab" to="/records/new" aria-label="Add a food or drink record"><Plus size={19} /><span>Record</span></Link>}
      <Navigation className="bottom-navigation" items={mobileNavigation} label="Primary navigation" />
    </div>
  )
}
