import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="page route-error"><Compass size={38} /><p className="eyebrow">404 · Off the menu</p><h1>That page isn't here.</h1><p>The item may have moved, or the link may no longer be available to you.</p><Link className="primary-action" to="/"><ArrowLeft size={17} /> Back to Home</Link></div>
}
