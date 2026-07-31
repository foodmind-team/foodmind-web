import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers/AppProviders'
import { router } from './app/router/router'
import './App.css'

export default function App() {
  return <AppProviders><RouterProvider router={router} /></AppProviders>
}
