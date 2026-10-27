// Small client-side validators. Each returns { fieldName: { key, params } } where key is an i18n key
// under "validation.*". The server (or the demo backend) still validates everything again.

const isBlank = (v) => v === undefined || v === null || String(v).trim() === ''
const err = (key, params) => ({ key, params })

export const isValidDate = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

const required = (errors, values, field) => {
    if (isBlank(values[field])) errors[field] = err('required')
}
const maxLen = (errors, values, field, max) => {
    if (!errors[field] && !isBlank(values[field]) && String(values[field]).trim().length > max) errors[field] = err('max_length', { count: max })
}
const minLen = (errors, values, field, min) => {
    if (!errors[field] && !isBlank(values[field]) && String(values[field]).trim().length < min) errors[field] = err('min_length', { count: min })
}
const dateField = (errors, values, field, { requiredField = false } = {}) => {
    if (isBlank(values[field])) {
        if (requiredField) errors[field] = err('required')
    } else if (!isValidDate(values[field])) errors[field] = err('date')
}
const numberField = (errors, values, field, { min = 0, max = Infinity, integer = false } = {}) => {
    const raw = values[field]
    if (isBlank(raw)) return
    const n = Number(raw)
    if (Number.isNaN(n)) errors[field] = err('number')
    else if (integer && !Number.isInteger(n)) errors[field] = err('integer')
    else if (n < min) errors[field] = err('min_value', { count: min })
    else if (n > max) errors[field] = err('max_value', { count: max })
}

export function validateMold(v) {
    const e = {}
    required(e, v, 'code')
    minLen(e, v, 'code', 2)
    maxLen(e, v, 'code', 50)
    if (!e.code && !/^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/.test(String(v.code).trim())) e.code = err('code_chars')
    required(e, v, 'name')
    minLen(e, v, 'name', 2)
    maxLen(e, v, 'name', 150)
    maxLen(e, v, 'project', 100)
    maxLen(e, v, 'material', 100)
    maxLen(e, v, 'notes', 5000)
    numberField(e, v, 'cavities', { min: 1, max: 128, integer: true })
    required(e, v, 'cavities')
    numberField(e, v, 'cost', { min: 0, max: 1_000_000_000 })
    dateField(e, v, 'start_date')
    dateField(e, v, 'deadline')
    if (!e.start_date && !e.deadline && v.start_date && v.deadline && v.deadline < v.start_date) e.deadline = err('date_order')
    return e
}

export function validateTrial(v) {
    const e = {}
    dateField(e, v, 'trial_date', { requiredField: true })
    numberField(e, v, 'quantity', { min: 0, max: 10_000_000, integer: true })
    maxLen(e, v, 'material', 100)
    maxLen(e, v, 'color', 50)
    maxLen(e, v, 'operator', 100)
    maxLen(e, v, 'result', 5000)
    return e
}

export function validateRevision(v) {
    const e = {}
    dateField(e, v, 'revision_date', { requiredField: true })
    required(e, v, 'work_done')
    minLen(e, v, 'work_done', 2)
    maxLen(e, v, 'work_done', 5000)
    maxLen(e, v, 'vendor', 100)
    maxLen(e, v, 'notes', 5000)
    numberField(e, v, 'cost', { min: 0, max: 1_000_000_000 })
    return e
}

export function validateMaintenance(v) {
    const e = {}
    dateField(e, v, 'maintenance_date', { requiredField: true })
    required(e, v, 'description')
    minLen(e, v, 'description', 2)
    maxLen(e, v, 'description', 5000)
    maxLen(e, v, 'technician', 100)
    numberField(e, v, 'cost', { min: 0, max: 1_000_000_000 })
    return e
}

export const passwordProblem = (pw) => {
    if (!pw || pw.length < 8) return err('password_min')
    if (pw.length > 72) return err('max_length', { count: 72 })
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return err('password_rules')
    return null
}

export function validatePasswordChange(v) {
    const e = {}
    if (isBlank(v.current_password)) e.current_password = err('required')
    const problem = passwordProblem(v.new_password)
    if (problem) e.new_password = problem
    else if (v.new_password === v.current_password) e.new_password = err('password_same')
    if (!e.new_password && v.new_password !== v.confirm_password) e.confirm_password = err('passwords_match')
    return e
}

export function validateProfile(v) {
    const e = {}
    required(e, v, 'full_name')
    minLen(e, v, 'full_name', 2)
    maxLen(e, v, 'full_name', 100)
    maxLen(e, v, 'department', 60)
    if (!isBlank(v.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = err('email')
    return e
}

export function validateUser(v, { creating }) {
    const e = validateProfile(v)
    if (creating) {
        required(e, v, 'username')
        if (!e.username && !/^[a-zA-Z0-9._-]{3,50}$/.test(v.username.trim())) e.username = err('username_rules')
        const problem = passwordProblem(v.password)
        if (problem) e.password = problem
    }
    return e
}

export function validateSupplierName(name) {
    if (isBlank(name)) return err('required')
    if (String(name).trim().length < 2) return err('min_length', { count: 2 })
    return null
}

/** Removes empty strings so optional fields are sent as null and numbers are numbers. */
export function cleanPayload(values, { numeric = [], nullable = [] } = {}) {
    const out = { ...values }
    for (const key of Object.keys(out)) {
        if (typeof out[key] === 'string') out[key] = out[key].trim()
    }
    for (const key of nullable) if (out[key] === '' || out[key] === undefined) out[key] = null
    for (const key of numeric) if (out[key] !== '' && out[key] !== null && out[key] !== undefined) out[key] = Number(out[key])
    return out
}
