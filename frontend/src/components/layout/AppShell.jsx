import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Boxes, ChevronDown, LayoutDashboard, LogOut, Menu, ScrollText, Settings, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { initials } from '../../utils/format.js'
import { RoleBadge } from '../ui/Badge.jsx'
import { LanguageSwitcher, ThemeToggle } from './Controls.jsx'
import DemoBanner from './DemoBanner.jsx'

function NavItem({ to, icon: Icon, label, onNavigate, end }) {
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`
            }
        >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {label}
        </NavLink>
    )
}

function Brand() {
    const { t } = useTranslation()
    return (
        <div className="flex items-center gap-3 px-3">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8 rounded-lg" />
            <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('app.short_name')}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('app.tagline_short')}</p>
            </div>
        </div>
    )
}

function SidebarNav({ onNavigate }) {
    const { t } = useTranslation()
    const { can } = useAuth()
    return (
        <nav aria-label={t('nav.main')} className="flex flex-1 flex-col gap-1 px-3">
            <NavItem to="/" end icon={LayoutDashboard} label={t('nav.dashboard')} onNavigate={onNavigate} />
            <NavItem to="/molds" icon={Boxes} label={t('nav.molds')} onNavigate={onNavigate} />
            {can('users:manage') && <NavItem to="/users" icon={Users} label={t('nav.users')} onNavigate={onNavigate} />}
            {can('logs:read') && <NavItem to="/audit" icon={ScrollText} label={t('nav.audit_log')} onNavigate={onNavigate} />}
            <div className="mt-auto pt-4">
                <NavItem to="/settings" icon={Settings} label={t('nav.settings')} onNavigate={onNavigate} />
            </div>
        </nav>
    )
}

function UserMenu() {
    const { t } = useTranslation()
    const { user, logout } = useAuth()
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!open) return undefined
        const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
        const onKey = (e) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-haspopup="menu"
                aria-expanded={open}
                data-testid="user-menu"
                title={t('nav.user_menu')}
                className="flex items-center gap-2 rounded-lg p-1.5 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white" aria-hidden="true">
                    {initials(user.full_name)}
                </span>
                <span className="sr-only text-left leading-tight sm:not-sr-only sm:block">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">{user.full_name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{t(`roles.${user.role}`)}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 z-40 mt-2 w-64 animate-pop-in rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <div className="px-3 py-2">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user.full_name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email || `@${user.username}`}</p>
                        <div className="mt-2">
                            <RoleBadge value={user.role} />
                        </div>
                    </div>
                    <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                    <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                        onClick={logout}
                    >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        {t('nav.sign_out')}
                    </button>
                </div>
            )}
        </div>
    )
}

export default function AppShell() {
    const { t } = useTranslation()
    const [drawer, setDrawer] = useState(false)
    const location = useLocation()
    const mainRef = useRef(null)

    useEffect(() => setDrawer(false), [location.pathname])
    // Move keyboard focus to the page content after navigating (screen reader / keyboard users).
    useEffect(() => {
        mainRef.current?.focus({ preventScroll: true })
    }, [location.pathname])
    useEffect(() => {
        if (!drawer) return undefined
        const onKey = (e) => e.key === 'Escape' && setDrawer(false)
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [drawer])

    return (
        <div className="min-h-screen">
            <a href="#main" className="sr-only z-[70] rounded-lg bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
                {t('nav.skip_to_content')}
            </a>

            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-slate-200 bg-white py-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
                <Brand />
                <SidebarNav />
            </aside>

            {/* Mobile drawer */}
            {drawer && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={() => setDrawer(false)} aria-hidden="true" />
                    <aside className="absolute inset-y-0 left-0 flex w-72 animate-slide-in-right flex-col gap-6 bg-white py-5 shadow-xl dark:bg-slate-900" aria-label={t('nav.main')}>
                        <div className="flex items-center justify-between pr-3">
                            <Brand />
                            <button type="button" className="btn-icon" onClick={() => setDrawer(false)} aria-label={t('nav.close_menu')}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <SidebarNav onNavigate={() => setDrawer(false)} />
                    </aside>
                </div>
            )}

            <div className="lg:pl-64">
                <DemoBanner />
                <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 sm:px-6">
                    <button type="button" className="btn-icon lg:hidden" onClick={() => setDrawer(true)} aria-label={t('nav.open_menu')} aria-expanded={drawer}>
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1">
                        <LanguageSwitcher />
                        <ThemeToggle />
                        <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
                        <UserMenu />
                    </div>
                </header>
                <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto max-w-[1440px] px-4 py-6 outline-none focus:outline-none focus-visible:!ring-0 sm:px-6 lg:px-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
