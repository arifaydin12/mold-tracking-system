import axios from 'axios'

/** True in the static GitHub Pages build: requests are answered by an in-browser mock backend. */
export const isDemo = import.meta.env.VITE_DEMO === 'true'

// The access token lives in memory only. After a page reload the httpOnly refresh cookie
// (or, in the demo, the stored mock session) is exchanged for a new one - see AuthContext.
let accessToken = null
export const setAccessToken = (token) => {
    accessToken = token
}
export const getAccessToken = () => accessToken

let authLostHandler = () => {}
export const onAuthLost = (fn) => {
    authLostHandler = fn
}

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true,
    timeout: 20000,
    // `import.meta.env.VITE_DEMO` is replaced at build time, so the demo backend is dropped from normal builds.
    ...(isDemo ? { adapter: (config) => import('../demo/adapter.js').then((m) => m.demoAdapter(config)) } : {}),
})

api.interceptors.request.use((config) => {
    if (accessToken && !config.headers.Authorization) config.headers.Authorization = `Bearer ${accessToken}`
    return config
})

const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout']
let refreshing = null

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession() {
    if (!refreshing) {
        refreshing = api
            .post('/auth/refresh', null, { _skipRefresh: true })
            .then((res) => {
                setAccessToken(res.data.access_token)
                return res.data
            })
            .finally(() => {
                refreshing = null
            })
    }
    return refreshing
}

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const { response, config } = error
        const isAuthCall = config && AUTH_PATHS.some((p) => (config.url || '').startsWith(p))
        if (response?.status === 401 && config && !config._retried && !config._skipRefresh && !isAuthCall) {
            config._retried = true
            try {
                await refreshSession()
                config.headers.Authorization = `Bearer ${getAccessToken()}`
                return api(config)
            } catch {
                setAccessToken(null)
                authLostHandler()
            }
        }
        return Promise.reject(error)
    },
)

/** Extracts a readable message and per-field errors from an API (or network) error. */
export function parseApiError(error) {
    const body = error?.response?.data?.error
    if (body) {
        const fields = {}
        for (const d of body.details || []) if (!fields[d.field]) fields[d.field] = d.message
        return { status: error.response.status, code: body.code, message: body.message, fields }
    }
    if (error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK' || !error?.response) {
        return { status: 0, code: 'network_error', message: error?.message || 'Network error', fields: {} }
    }
    return { status: error.response?.status || 0, code: 'unknown', message: error?.message || 'Unknown error', fields: {} }
}
