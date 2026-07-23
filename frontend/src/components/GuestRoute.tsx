import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'

export function GuestRoute() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/welcome" replace />
  }

  return <Outlet />
}
