import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api'
import { onAuthLost, refreshSession, setAccessToken } from '../api/client.js'
import { can as roleCan } from '../utils/permissions.js'

const AuthContext = createContext(null)

// A non-secret hint that this browser had a session, so first-time visitors do not trigger a pointless (and noisy) refresh call.
const HINT_KEY = 'mts.session'
const hasHint = () => {
    try {
        return localStorage.getItem(HINT_KEY) === '1'
    } catch {
        return false
    }
}
const setHint = (on) => {
    try {
        if (on) localStorage.setItem(HINT_KEY, '1')
        else localStorage.removeItem(HINT_KEY)
    } catch {
        /* storage unavailable */
    }
}

export function AuthProvider({ children }) {
    // 'loading' while we try to resume a session from the refresh cookie, then 'authenticated' | 'anonymous'
    const [status, setStatus] = useState('loading')
    const [user, setUser] = useState(null)

    useEffect(() => {
        let cancelled = false
        onAuthLost(() => {
            setHint(false)
            setUser(null)
            setStatus('anonymous')
        })
        if (!hasHint()) {
            setStatus('anonymous')
            return undefined
        }
        refreshSession()
            .then((session) => {
                if (cancelled) return
                setUser(session.user)
                setStatus('authenticated')
            })
            .catch(() => {
                setHint(false)
                if (!cancelled) setStatus('anonymous')
            })
        return () => {
            cancelled = true
        }
    }, [])

    const login = useCallback(async (username, password) => {
        const session = await authApi.login(username, password)
        setAccessToken(session.access_token)
        setHint(true)
        setUser(session.user)
        setStatus('authenticated')
        return session.user
    }, [])

    const logout = useCallback(async () => {
        try {
            await authApi.logout()
        } catch {
            /* the cookie is cleared locally either way */
        }
        setAccessToken(null)
        setHint(false)
        setUser(null)
        setStatus('anonymous')
    }, [])

    const applySession = useCallback((session) => {
        setAccessToken(session.access_token)
        if (session.user) setUser(session.user)
    }, [])

    const value = useMemo(
        () => ({ status, user, login, logout, setUser, applySession, can: (permission) => Boolean(user) && roleCan(user.role, permission) }),
        [status, user, login, logout, applySession],
    )
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
    return ctx
}
