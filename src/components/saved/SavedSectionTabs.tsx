import { Bookmark, NotebookTabs } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export function SavedSectionTabs() {
  return (
    <nav className="saved-section-tabs" aria-label="Saved sections">
      <NavLink to="/saved" end><Bookmark size={16} /> Want to Try</NavLink>
      <NavLink to="/saved/recipes"><NotebookTabs size={16} /> My recipes</NavLink>
    </nav>
  )
}
