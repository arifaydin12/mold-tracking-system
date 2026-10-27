import { useCallback, useEffect, useRef, useState } from 'react'
import { parseApiError } from '../api/client.js'

/**
 * Runs `fn` whenever `deps` change and exposes { data, error, loading, reload }.
 * Out-of-order responses are ignored, and `data` from the previous request stays visible while
 * a new one loads (so tables do not flash back to skeletons on every keystroke).
 */
export function useAsync(fn, deps) {
    const [state, setState] = useState({ data: null, error: null, loading: true })
    const counter = useRef(0)
    const fnRef = useRef(fn)
    fnRef.current = fn

    const run = useCallback(() => {
        const id = ++counter.current
        setState((s) => ({ ...s, loading: true, error: null }))
        return fnRef
            .current()
            .then((data) => {
                if (id === counter.current) setState({ data, error: null, loading: false })
            })
            .catch((err) => {
                if (id === counter.current) setState((s) => ({ data: s.data, error: parseApiError(err), loading: false }))
            })
    }, [])

    useEffect(() => {
        run()
        return () => {
            counter.current++
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)

    return { ...state, reload: run }
}

/** Debounces a fast-changing value (search boxes). */
export function useDebounced(value, delay = 300) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debounced
}
