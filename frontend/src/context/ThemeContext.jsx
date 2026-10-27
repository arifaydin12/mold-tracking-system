import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'mts.theme'
const ThemeContext = createContext(null)

const systemPrefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

function readStored() {
    try {
        const v = localStorage.getItem(STORAGE_KEY)
        return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
    } catch {
        return 'system'
    }
}

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(readStored)
    const [systemDark, setSystemDark] = useState(systemPrefersDark)

    useEffect(() => {
        const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
        if (!mq) return undefined
        const onChange = (e) => setSystemDark(e.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

    useEffect(() => {
        document.documentElement.classList.toggle('dark', resolved === 'dark')
    }, [resolved])

    const setTheme = useCallback((next) => {
        setThemeState(next)
        try {
            localStorage.setItem(STORAGE_KEY, next)
        } catch {
            /* storage unavailable */
        }
    }, [])

    const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme])

    const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle])
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
    return ctx
}
