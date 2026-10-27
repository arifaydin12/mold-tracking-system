// Axios adapter that answers requests from the in-browser mock backend instead of the network.
import { AxiosError, AxiosHeaders } from 'axios'
import { handleRequest, ApiError } from './server.js'
import { resetDemo } from './store.js'

export const demoSettings = { delayMs: [90, 220] }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function toPath(config) {
    const base = (config.baseURL || '').replace(/\/+$/, '')
    let url = config.url || ''
    if (base && url.startsWith(base)) url = url.slice(base.length)
    return url.startsWith('/') ? url : `/${url}`
}

export async function demoAdapter(config) {
    const [min, max] = demoSettings.delayMs
    if (max > 0) await sleep(min + Math.random() * (max - min))

    const headers = AxiosHeaders.from(config.headers)
    let body = config.data
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body)
        } catch {
            body = undefined
        }
    }

    const response = (status, data) => ({
        data,
        status,
        statusText: String(status),
        headers: new AxiosHeaders({ 'content-type': 'application/json' }),
        config,
        request: {},
    })

    try {
        const result = await handleRequest({
            method: config.method || 'get',
            path: toPath(config),
            query: config.params || {},
            body,
            authorization: headers.get('Authorization'),
        })
        return response(result.status, result.data === undefined ? '' : result.data)
    } catch (err) {
        if (!(err instanceof ApiError)) throw err
        const error = { error: { code: err.code, message: err.message } }
        if (err.details) error.error.details = err.details
        const res = response(err.status, error)
        throw new AxiosError(err.message, err.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, res.request, res)
    }
}

export { resetDemo }
