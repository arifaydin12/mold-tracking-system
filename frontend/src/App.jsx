import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isDemo } from './api/client.js'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import AppShell from './components/layout/AppShell.jsx'
import Spinner from './components/ui/Spinner.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Molds from './pages/Molds.jsx'
import MoldDetail from './pages/MoldDetail.jsx'
import UsersPage from './pages/Users.jsx'
import AuditLog from './pages/AuditLog.jsx'
import SettingsPage from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'

// GitHub Pages cannot rewrite deep links, so the static demo uses hash routing.
const Router = isDemo ? HashRouter : BrowserRouter

function FullScreenSpinner() {
    const { t } = useTranslation()
    return (
        <div className="flex min-h-screen items-center justify-center text-slate-500" role="status">
            <Spinner className="h-6 w-6" label={t('common.loading')} />
        </div>
    )
}

function RequireAuth({ permission, children }) {
    const { status, can } = useAuth()
    const location = useLocation()
    if (status === 'loading') return <FullScreenSpinner />
    if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    if (permission && !can(permission)) return <NotFound forbidden />
    return children
}

function AppRoutes() {
    const { status } = useAuth()
    return (
        <Routes>
            <Route path="/login" element={status === 'loading' ? <FullScreenSpinner /> : <Login />} />
            <Route
                element={
                    <RequireAuth>
                        <AppShell />
                    </RequireAuth>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="molds" element={<Molds />} />
                <Route path="molds/:id" element={<MoldDetail />} />
                <Route
                    path="users"
                    element={
                        <RequireAuth permission="users:manage">
                            <UsersPage />
                        </RequireAuth>
                    }
                />
                <Route
                    path="audit"
                    element={
                        <RequireAuth permission="logs:read">
                            <AuditLog />
                        </RequireAuth>
                    }
                />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
    )
}

export default function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <Router>
                        <AppRoutes />
                    </Router>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    )
}
