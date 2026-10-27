const CURRENCY = 'EUR'

const localeOf = (lng) => (lng && lng.startsWith('de') ? 'de-DE' : lng && lng.startsWith('pl') ? 'pl-PL' : 'en-GB')

/** "1 234,50 €" / "€1,234.50" depending on the UI language. */
export function formatMoney(value, lng = 'en', { compact = false } = {}) {
    const n = Number(value)
    if (value === null || value === undefined || Number.isNaN(n)) return '—'
    return new Intl.NumberFormat(localeOf(lng), {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: compact ? 1 : Number.isInteger(n) ? 0 : 2,
        notation: compact ? 'compact' : 'standard',
    }).format(n)
}

// Some ICU versions print "Sept" for September in en-GB; "Sep" is the conventional short form.
const tidy = (s) => s.replace('Sept', 'Sep')

export const formatNumber = (value, lng = 'en') => new Intl.NumberFormat(localeOf(lng)).format(Number(value) || 0)

/** Parses "YYYY-MM-DD" as a local calendar date (no timezone shift). */
export function parseDateOnly(value) {
    if (!value) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

/** Formats a date-only value ("2026-03-09") or an ISO timestamp. */
export function formatDate(value, lng = 'en') {
    if (!value) return '—'
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateOnly(value) : new Date(value)
    if (!d || Number.isNaN(d.getTime())) return '—'
    return tidy(new Intl.DateTimeFormat(localeOf(lng), { day: '2-digit', month: 'short', year: 'numeric' }).format(d))
}

export function formatDateTime(value, lng = 'en') {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return tidy(new Intl.DateTimeFormat(localeOf(lng), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d))
}

/** Whole days from today (local) until the date; negative when it is in the past. */
export function daysUntil(dateStr, now = new Date()) {
    const d = parseDateOnly(dateStr)
    if (!d) return null
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Math.round((d - today) / 86400000)
}

/** "3 min ago" / "yesterday" style text via Intl.RelativeTimeFormat. */
export function formatRelative(value, lng = 'en', now = Date.now()) {
    const t = new Date(value).getTime()
    if (Number.isNaN(t)) return '—'
    const diff = t - now
    const rtf = new Intl.RelativeTimeFormat(localeOf(lng), { numeric: 'auto' })
    const abs = Math.abs(diff)
    const units = [
        ['year', 365 * 86400000],
        ['month', 30 * 86400000],
        ['week', 7 * 86400000],
        ['day', 86400000],
        ['hour', 3600000],
        ['minute', 60000],
    ]
    for (const [unit, ms] of units) {
        if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
    }
    return rtf.format(0, 'second')
}

export const todayISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const initials = (name = '') =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('')
