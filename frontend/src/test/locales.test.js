import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en from '../locales/en.json'
import de from '../locales/de.json'
import pl from '../locales/pl.json'

const srcDir = path.resolve(__dirname, '..')

/** Flattens {a:{b:'x'}} into { 'a.b': 'x' }. */
function flatten(obj, prefix = '') {
    return Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]))
}

/** Plural suffixes are language specific, so compare the base keys. */
const baseKey = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '')
const baseKeys = (obj) => new Set(flatten(obj).map(([k]) => baseKey(k)))

function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) return ['test', 'locales', 'demo'].includes(e.name) ? [] : sourceFiles(p)
        return /\.jsx?$/.test(e.name) ? [p] : []
    })
}

describe('locales', () => {
    it('German and Polish define exactly the same keys as English', () => {
        const reference = baseKeys(en)
        for (const [name, locale] of [['de', de], ['pl', pl]]) {
            const keys = baseKeys(locale)
            expect([...reference].filter((k) => !keys.has(k)), `${name} is missing keys`).toEqual([])
            expect([...keys].filter((k) => !reference.has(k)), `${name} has extra keys`).toEqual([])
        }
    })

    it('defines every plural form each language needs', () => {
        const required = { en: ['one', 'other'], de: ['one', 'other'], pl: ['one', 'few', 'many', 'other'] }
        for (const [name, locale] of [['en', en], ['de', de], ['pl', pl]]) {
            const flat = Object.fromEntries(flatten(locale))
            const bases = new Set(Object.keys(flat).filter((k) => /_(one|other)$/.test(k)).map(baseKey))
            for (const base of bases) {
                for (const form of required[name]) expect(flat, `${name}: ${base}_${form}`).toHaveProperty(`${base}_${form}`)
            }
        }
    })

    it('has no empty strings and keeps interpolation placeholders in sync', () => {
        const ref = Object.fromEntries(flatten(en))
        for (const [name, locale] of [['de', de], ['pl', pl]]) {
            for (const [k, v] of flatten(locale)) {
                expect(v.trim(), `${name}.${k} is empty`).not.toBe('')
                const base = baseKey(k)
                const enKey = ref[k] !== undefined ? k : `${base}_other`
                const placeholders = (s) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort()
                if (ref[enKey] !== undefined && !/_(one|few|many)$/.test(k)) {
                    expect(placeholders(v), `${name}.${k} placeholders`).toEqual(placeholders(ref[enKey]))
                }
            }
        }
    })

    it('contains no Turkish text', () => {
        // dotless i, dotted capital I, g-breve and s-cedilla only occur in Turkish (written as escapes on purpose)
        const turkish = /[\u011f\u011e\u015f\u015e\u0131\u0130]/
        for (const [name, locale] of [['en', en], ['de', de], ['pl', pl]]) {
            for (const [k, v] of flatten(locale)) expect(turkish.test(v), `${name}.${k}`).toBe(false)
        }
    })

    it('has every statically referenced translation key in English', () => {
        const known = baseKeys(en)
        const missing = []
        for (const file of sourceFiles(srcDir)) {
            const text = fs.readFileSync(file, 'utf8')
            for (const m of text.matchAll(/\bt\(\s*['`]([^'`]+)['`]/g)) {
                const key = m[1]
                if (key.includes('${')) continue // dynamic keys are covered below
                if (!known.has(key)) missing.push(`${path.relative(srcDir, file)}: ${key}`)
            }
        }
        expect(missing).toEqual([])
    })

    it('covers dynamic key families', () => {
        const known = baseKeys(en)
        const families = {
            status: ['trial', 'active', 'revision', 'maintenance', 'retired'],
            payment: ['unpaid', 'partial', 'paid'],
            outcome: ['pass', 'conditional', 'fail'],
            maintenance_status: ['planned', 'in_progress', 'completed'],
            roles: ['admin', 'engineer', 'viewer', 'admin_desc', 'engineer_desc', 'viewer_desc'],
            'audit.entities': ['mold', 'trial', 'revision', 'maintenance', 'supplier', 'user'],
            theme: ['light', 'dark', 'system'],
            'detail.filter': ['all', 'trials', 'revisions', 'maintenance'],
            'records.type': ['trial', 'revision', 'maintenance'],
            'records.f': ['trial_date', 'outcome', 'material', 'color', 'quantity', 'operator', 'result', 'revision_date', 'vendor', 'work_done', 'cost', 'payment_status', 'notes', 'maintenance_date', 'status', 'description', 'technician'],
            'settings.perm': ['molds_read', 'molds_write', 'molds_archive', 'molds_restore', 'records_write', 'records_delete', 'suppliers_write', 'users_manage', 'logs_read'],
        }
        const missing = []
        for (const [prefix, names] of Object.entries(families)) {
            for (const n of names) {
                const key = prefix.includes('.') && !['audit.entities'].includes(prefix) ? `${prefix}_${n}` : `${prefix}.${n}`
                if (!known.has(key)) missing.push(key)
            }
        }
        for (const kind of ['trial', 'revision', 'maintenance']) {
            for (const suffix of ['add', 'edit', 'add_short']) if (!known.has(`records.${kind}_${suffix}`)) missing.push(`records.${kind}_${suffix}`)
        }
        expect(missing).toEqual([])
    })

    it('has a label for every audit action the server can write', () => {
        const serverActions = [
            'mold.create', 'mold.update', 'mold.archive', 'mold.restore',
            'trial.create', 'trial.update', 'trial.delete',
            'revision.create', 'revision.update', 'revision.delete',
            'maintenance.create', 'maintenance.update', 'maintenance.delete',
            'supplier.create', 'supplier.update',
            'user.create', 'user.update', 'user.update_profile', 'user.deactivate', 'user.activate', 'user.reset_password',
            'auth.change_password',
        ]
        for (const a of serverActions) expect(en.audit.actions, a).toHaveProperty(a.replace('.', '_'))
    })
})
