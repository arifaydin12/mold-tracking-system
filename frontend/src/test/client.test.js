import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { api, getAccessToken, onAuthLost, setAccessToken } from '../api/client.js'

// Exercises the response interceptor: an expired access token is refreshed once (even for parallel requests)
// and the original request is replayed; a failed refresh signs the user out.

const original = api.defaults.adapter
let calls

const respond = (config, status, data) => {
    const response = { data, status, statusText: String(status), headers: new AxiosHeaders(), config, request: {} }
    if (status >= 400) throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, {}, response)
    return response
}

beforeEach(() => {
    calls = []
    setAccessToken(null)
})
afterEach(() => {
    api.defaults.adapter = original
    onAuthLost(() => {})
})

describe('api client token refresh', () => {
    it('attaches the in-memory access token', async () => {
        setAccessToken('token-1')
        api.defaults.adapter = async (config) => {
            calls.push(config.headers.get('Authorization'))
            return respond(config, 200, { ok: true })
        }
        await api.get('/molds')
        expect(calls).toEqual(['Bearer token-1'])
    })

    it('refreshes once on 401 and replays the request with the new token', async () => {
        setAccessToken('expired')
        api.defaults.adapter = async (config) => {
            calls.push(`${config.method} ${config.url} ${config.headers.get('Authorization') || '-'}`)
            if (config.url === '/auth/refresh') return respond(config, 200, { access_token: 'fresh' })
            return config.headers.get('Authorization') === 'Bearer fresh' ? respond(config, 200, { data: [1] }) : respond(config, 401, {})
        }
        const res = await api.get('/molds')
        expect(res.data).toEqual({ data: [1] })
        expect(getAccessToken()).toBe('fresh')
        expect(calls).toEqual(['get /molds Bearer expired', 'post /auth/refresh Bearer expired', 'get /molds Bearer fresh'])
    })

    it('shares a single refresh between parallel requests', async () => {
        setAccessToken('expired')
        let refreshes = 0
        api.defaults.adapter = async (config) => {
            if (config.url === '/auth/refresh') {
                refreshes++
                await new Promise((r) => setTimeout(r, 20))
                return respond(config, 200, { access_token: 'fresh' })
            }
            return config.headers.get('Authorization') === 'Bearer fresh' ? respond(config, 200, { url: config.url }) : respond(config, 401, {})
        }
        const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])
        expect(results.map((r) => r.data.url)).toEqual(['/a', '/b', '/c'])
        expect(refreshes).toBe(1)
    })

    it('signs the user out when the refresh fails', async () => {
        setAccessToken('expired')
        const lost = vi.fn()
        onAuthLost(lost)
        api.defaults.adapter = async (config) => respond(config, 401, { error: { code: 'unauthorized', message: 'nope' } })
        await expect(api.get('/molds')).rejects.toMatchObject({ response: { status: 401 } })
        expect(lost).toHaveBeenCalledTimes(1)
        expect(getAccessToken()).toBeNull()
    })

    it('does not try to refresh failed logins and does not loop', async () => {
        api.defaults.adapter = async (config) => {
            calls.push(config.url)
            return respond(config, 401, { error: { code: 'unauthorized', message: 'Invalid username or password' } })
        }
        await expect(api.post('/auth/login', { username: 'a', password: 'b' })).rejects.toMatchObject({ response: { status: 401 } })
        expect(calls).toEqual(['/auth/login'])
        calls = []
        await expect(api.get('/molds')).rejects.toBeTruthy()
        expect(calls.filter((c) => c === '/molds')).toHaveLength(1) // the replay is skipped because the refresh itself failed
    })
})
