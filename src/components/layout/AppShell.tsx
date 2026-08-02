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
  Plus,
  Search,
  UserRound,
  Users,
  Utensils,
} from 'lucide-react'
import { useEffect, useState, type ComponentType, type FormEvent } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>
type NavigationItem = { to: string; label: string; icon: Icon; end?: boolean; featured?: boolean }

const primaryNavigation: NavigationItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/saved', label: 'Saved', icon: Bookmark },
]

const toolNavigation: NavigationItem[] = [
  // { to: '/chat', label: 'Ask FoodMind', icon: Bot },
  // { to: '/cooking', label: 'Cooking', icon: ChefHat },
  { to: '/history', label: 'History', icon: Clock3 },
  { to: '/dashboard', label: 'Insights', icon: BarChart3 },
]

const mobileNavigation: NavigationItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/records/new', label: 'Add', icon: Plus, featured: true },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/me', label: 'Me', icon: UserRound },
]

function Navigation({ className, items, label }: { className: string; items: NavigationItem[]; label: string }) {
  return (
    <nav className={className} aria-label={label}>
      {items.map(({ to, label: itemLabel, icon: NavigationIcon, end, featured }) => (
        <NavLink className={({ isActive }) => `${featured ? 'featured ' : ''}${isActive ? 'active' : ''}`.trim()} to={to} end={end} key={to}>
          <NavigationIcon size={19} strokeWidth={2.05} /><span>{itemLabel}</span>
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
  const [globalQuery, setGlobalQuery] = useState('')
  const isCooking = location.pathname.startsWith('/cooking')
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
            <Link className="header-icon add-action" to="/records/new" aria-label="Add a food or drink record">
              <Plus size={19} />
            </Link>
            <Link className="avatar-button" to="/me" aria-label={`Open ${displayName}'s profile`}>
              {initial}
            </Link>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}><Outlet /></main>
      </div>

      <Navigation className="bottom-navigation" items={mobileNavigation} label="Primary navigation" />
      <ScrollRestoration />
    </div>
  )
}
