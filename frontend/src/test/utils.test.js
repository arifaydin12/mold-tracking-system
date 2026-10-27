import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { daysUntil, formatDate, formatMoney, formatNumber, formatRelative, initials, parseDateOnly } from '../utils/format.js'
import { PERMISSIONS, can, permissionsOf } from '../utils/permissions.js'
import { cleanPayload, isValidDate, passwordProblem, validateMaintenance, validateMold, validatePasswordChange, validateProfile, validateRevision, validateTrial, validateUser } from '../utils/validation.js'
import { pageWindow } from '../components/ui/Pagination.jsx'
import { shortAgent } from '../pages/AuditLog.jsx'
import { parseApiError } from '../api/client.js'

const root = path.resolve(__dirname, '../../..')

describe('format', () => {
    it('formats money per language', () => {
        expect(formatMoney(1234.5, 'en')).toBe('€1,234.50')
        expect(formatMoney(1234, 'en')).toBe('€1,234')
        expect(formatMoney(1234.5, 'de')).toMatch(/1\.234,50\s€/)
        expect(formatMoney(12345.5, 'pl')).toMatch(/12\s345,50\s€/)
        expect(formatMoney(1_940_000, 'en', { compact: true })).toBe('€1.9m')
        expect(formatMoney(null)).toBe('—')
        expect(formatMoney('abc')).toBe('—')
    })

    it('formats numbers per language', () => {
        expect(formatNumber(12345, 'en')).toBe('12,345')
        expect(formatNumber(12345, 'de')).toBe('12.345')
    })

    it('parses date-only values without a timezone shift', () => {
        const d = parseDateOnly('2026-03-09')
        expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 9])
        expect(parseDateOnly('')).toBeNull()
        expect(parseDateOnly('garbage')).toBeNull()
    })

    it('formats dates and never prints "Sept"', () => {
        expect(formatDate('2026-03-09', 'en')).toBe('09 Mar 2026')
        expect(formatDate('2026-09-09', 'en')).toBe('09 Sep 2026')
        expect(formatDate('2026-03-09', 'de')).toMatch(/^09\.\s?M(ä|ae)rz?\.?\s2026$/)
        expect(formatDate(null)).toBe('—')
        expect(formatDate('nope')).toBe('—')
    })

    it('counts whole days until a date', () => {
        const now = new Date(2026, 5, 15, 18, 30)
        expect(daysUntil('2026-06-15', now)).toBe(0)
        expect(daysUntil('2026-06-20', now)).toBe(5)
        expect(daysUntil('2026-06-10', now)).toBe(-5)
        expect(daysUntil(null, now)).toBeNull()
    })

    it('describes relative times', () => {
        const now = Date.parse('2026-06-15T12:00:00Z')
        expect(formatRelative('2026-06-15T11:00:00Z', 'en', now)).toBe('1 hour ago')
        expect(formatRelative('2026-06-13T12:00:00Z', 'en', now)).toBe('2 days ago')
        expect(formatRelative('2026-06-15T11:59:50Z', 'en', now)).toMatch(/now|seconds? ago/)
    })

    it('builds initials', () => {
        expect(initials('Alex Morgan')).toBe('AM')
        expect(initials('single')).toBe('S')
        expect(initials('')).toBe('')
        expect(initials('a b c')).toBe('AB')
    })
})

describe('permissions', () => {
    it('grants the documented role matrix', () => {
        expect(can('admin', 'users:manage')).toBe(true)
        expect(can('engineer', 'users:manage')).toBe(false)
        expect(can('engineer', 'molds:write')).toBe(true)
        expect(can('engineer', 'molds:restore')).toBe(false)
        expect(can('viewer', 'molds:read')).toBe(true)
        expect(can('viewer', 'molds:write')).toBe(false)
        expect(can('viewer', 'unknown:permission')).toBe(false)
        expect(permissionsOf('viewer')).toEqual(['molds:read'])
    })

    it('is identical to the server permission table', () => {
        const require = createRequire(import.meta.url)
        const server = require(path.join(root, 'src/config/permissions.js'))
        expect(PERMISSIONS).toEqual(server.PERMISSIONS)
    })
})

describe('demo validation schemas', () => {
    it('are an exact copy of the server schemas (run node scripts/sync-demo-schemas.js after editing them)', () => {
        const normalize = (s) => s.replace(/\r\n/g, '\n').trim()
        const server = normalize(fs.readFileSync(path.join(root, 'src/validation/schemas.js'), 'utf8'))
        const demo = normalize(fs.readFileSync(path.join(__dirname, '../demo/schemas.js'), 'utf8'))
        const body = demo.split('\n').slice(2).join('\n')
        expect(body).toBe(server.replace("const { z } = require('zod');", "import { z } from 'zod'").replace('module.exports = {', 'export default {'))
    })
})

describe('client-side validation', () => {
    const goodMold = { code: 'M-2026-001', name: 'Housing', project: '', material: '', notes: '', cavities: '2', cost: '100', start_date: '2026-01-01', deadline: '2026-02-01' }

    it('accepts a valid mold', () => expect(validateMold(goodMold)).toEqual({}))

    it('reports required, length and character problems', () => {
        const e = validateMold({ ...goodMold, code: '', name: 'x' })
        expect(e.code.key).toBe('required')
        expect(e.name).toEqual({ key: 'min_length', params: { count: 2 } })
        expect(validateMold({ ...goodMold, code: '<b>' }).code.key).toBe('code_chars')
    })

    it('checks numbers and dates', () => {
        expect(validateMold({ ...goodMold, cavities: '0' }).cavities.key).toBe('min_value')
        expect(validateMold({ ...goodMold, cavities: '1.5' }).cavities.key).toBe('integer')
        expect(validateMold({ ...goodMold, cost: 'abc' }).cost.key).toBe('number')
        expect(validateMold({ ...goodMold, cost: '-5' }).cost.key).toBe('min_value')
        expect(validateMold({ ...goodMold, deadline: '2026-02-30' }).deadline.key).toBe('date')
        expect(validateMold({ ...goodMold, deadline: '2025-12-31' }).deadline.key).toBe('date_order')
    })

    it('validates calendar dates strictly', () => {
        expect(isValidDate('2026-02-28')).toBe(true)
        expect(isValidDate('2026-02-30')).toBe(false)
        expect(isValidDate('2024-02-29')).toBe(true)
        expect(isValidDate('29/02/2024')).toBe(false)
    })

    it('validates trial, revision and maintenance records', () => {
        expect(validateTrial({ trial_date: '', quantity: '0' }).trial_date.key).toBe('required')
        expect(validateTrial({ trial_date: '2026-01-01', quantity: '-1' }).quantity.key).toBe('min_value')
        expect(validateTrial({ trial_date: '2026-01-01', quantity: '10' })).toEqual({})
        expect(validateRevision({ revision_date: '2026-01-01', work_done: '', cost: '0' }).work_done.key).toBe('required')
        expect(validateMaintenance({ maintenance_date: '2026-01-01', description: 'Cleaning', cost: '5' })).toEqual({})
    })

    it('enforces the password policy', () => {
        expect(passwordProblem('short1').key).toBe('password_min')
        expect(passwordProblem('onlyletters').key).toBe('password_rules')
        expect(passwordProblem('12345678').key).toBe('password_rules')
        expect(passwordProblem('Valid-pass1')).toBeNull()
        const e = validatePasswordChange({ current_password: 'a', new_password: 'Valid-pass1', confirm_password: 'Valid-pass2' })
        expect(e.confirm_password.key).toBe('passwords_match')
        expect(validatePasswordChange({ current_password: 'Valid-pass1', new_password: 'Valid-pass1', confirm_password: 'Valid-pass1' }).new_password.key).toBe('password_same')
    })

    it('validates profiles and users', () => {
        expect(validateProfile({ full_name: 'A', email: 'nope' })).toMatchObject({ full_name: { key: 'min_length' }, email: { key: 'email' } })
        expect(validateUser({ full_name: 'Ann Lee', username: 'a', password: 'x' }, { creating: true })).toMatchObject({ username: { key: 'username_rules' }, password: { key: 'password_min' } })
        expect(validateUser({ full_name: 'Ann Lee', email: '', department: '' }, { creating: false })).toEqual({})
    })

    it('cleans payloads: trims, nulls blanks, converts numbers', () => {
        const out = cleanPayload({ code: '  M-1 ', project: '  ', cavities: '4', cost: '12.5', supplier_id: '' }, { numeric: ['cavities', 'cost', 'supplier_id'], nullable: ['project', 'supplier_id'] })
        expect(out).toEqual({ code: 'M-1', project: null, cavities: 4, cost: 12.5, supplier_id: null })
    })
})

describe('helpers', () => {
    it('builds a compact page window with gaps', () => {
        expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
        expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, '…', 20])
        expect(pageWindow(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20])
        expect(pageWindow(20, 20)).toEqual([1, '…', 17, 18, 19, 20])
    })

    it('summarises user agents', () => {
        expect(shortAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36')).toBe('Chrome · Windows')
        expect(shortAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15')).toBe('Safari · macOS')
        expect(shortAgent('')).toBe('—')
    })

    it('parses API errors', () => {
        const apiError = { response: { status: 400, data: { error: { code: 'validation_error', message: 'Validation failed', details: [{ field: 'code', message: 'Too short' }, { field: 'code', message: 'again' }] } } } }
        expect(parseApiError(apiError)).toEqual({ status: 400, code: 'validation_error', message: 'Validation failed', fields: { code: 'Too short' } })
        expect(parseApiError({ code: 'ERR_NETWORK', message: 'Network Error' }).code).toBe('network_error')
    })
})
