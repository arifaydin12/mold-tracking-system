import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { recordsApi } from '../api'
import { parseApiError } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { todayISO } from '../utils/format.js'
import { cleanPayload, validateMaintenance, validateRevision, validateTrial } from '../utils/validation.js'
import Modal from './ui/Modal.jsx'
import Field from './ui/Field.jsx'
import Spinner from './ui/Spinner.jsx'

const OUTCOMES = ['pass', 'conditional', 'fail']
const PAYMENTS = ['unpaid', 'partial', 'paid']
const MAINT = ['planned', 'in_progress', 'completed']

/** Field definitions per record kind. `type` drives the rendered control. */
export const KINDS = {
    trials: {
        entity: 'trial',
        dateField: 'trial_date',
        validate: validateTrial,
        defaults: () => ({ trial_date: todayISO(), material: '', color: '', quantity: '0', outcome: 'pass', result: '', operator: '' }),
        numeric: ['quantity'],
        nullable: ['material', 'color', 'result', 'operator'],
        fields: [
            { name: 'trial_date', type: 'date', required: true },
            { name: 'outcome', type: 'select', options: OUTCOMES, ns: 'outcome' },
            { name: 'material', type: 'text', max: 100 },
            { name: 'color', type: 'text', max: 50 },
            { name: 'quantity', type: 'number', min: 0, step: 1 },
            { name: 'operator', type: 'text', max: 100 },
            { name: 'result', type: 'textarea', wide: true },
        ],
    },
    revisions: {
        entity: 'revision',
        dateField: 'revision_date',
        validate: validateRevision,
        defaults: () => ({ revision_date: todayISO(), vendor: '', work_done: '', cost: '0', payment_status: 'unpaid', notes: '' }),
        numeric: ['cost'],
        nullable: ['vendor', 'notes'],
        fields: [
            { name: 'revision_date', type: 'date', required: true },
            { name: 'vendor', type: 'text', max: 100 },
            { name: 'work_done', type: 'textarea', wide: true, required: true },
            { name: 'cost', type: 'number', min: 0, step: 0.01 },
            { name: 'payment_status', type: 'select', options: PAYMENTS, ns: 'payment' },
            { name: 'notes', type: 'textarea', wide: true },
        ],
    },
    maintenance: {
        entity: 'maintenance',
        dateField: 'maintenance_date',
        validate: validateMaintenance,
        defaults: () => ({ maintenance_date: todayISO(), description: '', technician: '', status: 'completed', cost: '0' }),
        numeric: ['cost'],
        nullable: ['technician'],
        fields: [
            { name: 'maintenance_date', type: 'date', required: true },
            { name: 'status', type: 'select', options: MAINT, ns: 'maintenance_status' },
            { name: 'description', type: 'textarea', wide: true, required: true },
            { name: 'technician', type: 'text', max: 100 },
            { name: 'cost', type: 'number', min: 0, step: 0.01 },
        ],
    },
}

const toForm = (kind, record) => {
    const base = KINDS[kind].defaults()
    return Object.fromEntries(Object.keys(base).map((k) => [k, record[k] === null || record[k] === undefined ? '' : String(record[k])]))
}

/** Add / edit dialog for a trial, revision or maintenance record. `record` is null when adding. */
export default function RecordFormModal({ open, kind, moldId, record, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [values, setValues] = useState({})
    const [errors, setErrors] = useState({})
    const [busy, setBusy] = useState(false)
    const cfg = KINDS[kind]
    const editing = Boolean(record)

    useEffect(() => {
        if (!open) return
        setValues(record ? toForm(kind, record) : cfg.defaults())
        setErrors({})
    }, [open, kind, record, cfg])

    if (!cfg) return null
    const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))
    const title = editing ? t(`records.${cfg.entity}_edit`) : t(`records.${cfg.entity}_add`)

    const submit = async (e) => {
        e.preventDefault()
        const found = cfg.validate(values)
        setErrors(found)
        if (Object.keys(found).length) return
        setBusy(true)
        try {
            const payload = cleanPayload(values, { numeric: cfg.numeric, nullable: cfg.nullable })
            const res = editing ? await recordsApi.update(moldId, kind, record.id, payload) : await recordsApi.create(moldId, kind, payload)
            toast.success(editing ? t('records.saved_toast') : t('records.added_toast'))
            onSaved(res.data)
        } catch (err) {
            const parsed = parseApiError(err)
            if (Object.keys(parsed.fields).length) setErrors(parsed.fields)
            else toast.error(parsed.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={busy}
            title={title}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" form="record-form" className="btn-primary" disabled={busy}>
                        {busy && <Spinner />}
                        {editing ? t('common.save_changes') : t('common.add')}
                    </button>
                </>
            }
        >
            <form id="record-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
                {cfg.fields.map((f) => (
                    <Field key={f.name} label={t(`records.f_${f.name}`)} error={errors[f.name]} required={f.required} className={f.wide ? 'sm:col-span-2' : ''}>
                        {f.type === 'select' ? (
                            <select className="input" value={values[f.name] ?? ''} onChange={set(f.name)}>
                                {f.options.map((o) => (
                                    <option key={o} value={o}>
                                        {t(`${f.ns}.${o}`)}
                                    </option>
                                ))}
                            </select>
                        ) : f.type === 'textarea' ? (
                            <textarea className="input min-h-[80px]" rows={3} value={values[f.name] ?? ''} onChange={set(f.name)} maxLength={5000} />
                        ) : (
                            <input
                                className="input"
                                type={f.type}
                                value={values[f.name] ?? ''}
                                onChange={set(f.name)}
                                min={f.min}
                                step={f.step}
                                maxLength={f.max}
                                inputMode={f.type === 'number' ? 'decimal' : undefined}
                            />
                        )}
                    </Field>
                ))}
            </form>
        </Modal>
    )
}
