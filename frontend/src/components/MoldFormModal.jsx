import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { moldsApi, suppliersApi } from '../api'
import { parseApiError } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { cleanPayload, validateMold, validateSupplierName } from '../utils/validation.js'
import Modal from './ui/Modal.jsx'
import Field from './ui/Field.jsx'
import Spinner from './ui/Spinner.jsx'

export const MOLD_STATUSES = ['trial', 'active', 'revision', 'maintenance', 'retired']
export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid']
const NEW_SUPPLIER = '__new__'

const EMPTY = { code: '', name: '', project: '', status: 'trial', supplier_id: '', cavities: '1', material: '', start_date: '', deadline: '', cost: '0', payment_status: 'unpaid', notes: '' }

const fromMold = (m) => ({
    code: m.code,
    name: m.name,
    project: m.project ?? '',
    status: m.status,
    supplier_id: m.supplier_id ? String(m.supplier_id) : '',
    cavities: String(m.cavities),
    material: m.material ?? '',
    start_date: m.start_date ?? '',
    deadline: m.deadline ?? '',
    cost: String(m.cost),
    payment_status: m.payment_status,
    notes: m.notes ?? '',
})

/** Create / edit dialog for a mold. `mold` is null when creating. */
export default function MoldFormModal({ open, mold, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [values, setValues] = useState(EMPTY)
    const [newSupplier, setNewSupplier] = useState('')
    const [errors, setErrors] = useState({})
    const [suppliers, setSuppliers] = useState([])
    const [busy, setBusy] = useState(false)
    const editing = Boolean(mold)

    useEffect(() => {
        if (!open) return
        setValues(mold ? fromMold(mold) : EMPTY)
        setNewSupplier('')
        setErrors({})
        suppliersApi
            .list()
            .then((r) => setSuppliers(r.data))
            .catch(() => setSuppliers([]))
    }, [open, mold])

    const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        const found = validateMold(values)
        if (values.supplier_id === NEW_SUPPLIER) {
            const problem = validateSupplierName(newSupplier)
            if (problem) found.new_supplier = problem
        }
        setErrors(found)
        if (Object.keys(found).length) return

        setBusy(true)
        try {
            let supplierId = values.supplier_id
            if (supplierId === NEW_SUPPLIER) {
                const created = await suppliersApi.create({ name: newSupplier.trim() })
                supplierId = String(created.data.id)
            }
            const payload = cleanPayload({ ...values, supplier_id: supplierId }, { numeric: ['cavities', 'cost', 'supplier_id'], nullable: ['project', 'material', 'start_date', 'deadline', 'notes', 'supplier_id'] })
            const res = editing ? await moldsApi.update(mold.id, payload) : await moldsApi.create(payload)
            toast.success(editing ? t('molds.saved_toast', { code: res.data.code }) : t('molds.created_toast', { code: res.data.code }))
            onSaved(res.data)
        } catch (err) {
            const parsed = parseApiError(err)
            if (Object.keys(parsed.fields).length) setErrors(parsed.fields)
            else if (parsed.status === 409) setErrors({ code: parsed.message })
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
            size="lg"
            title={editing ? t('molds.edit_title') : t('molds.new_title')}
            description={editing ? mold.code : t('molds.new_description')}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" form="mold-form" className="btn-primary" disabled={busy}>
                        {busy && <Spinner />}
                        {editing ? t('common.save_changes') : t('molds.create')}
                    </button>
                </>
            }
        >
            <form id="mold-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
                <Field label={t('molds.f_code')} error={errors.code} required>
                    <input className="input" value={values.code} onChange={set('code')} maxLength={50} placeholder="M-2026-041" />
                </Field>
                <Field label={t('molds.f_name')} error={errors.name} required>
                    <input className="input" value={values.name} onChange={set('name')} maxLength={150} />
                </Field>
                <Field label={t('molds.f_project')} error={errors.project}>
                    <input className="input" value={values.project} onChange={set('project')} maxLength={100} />
                </Field>
                <Field label={t('molds.f_status')} error={errors.status}>
                    <select className="input" value={values.status} onChange={set('status')}>
                        {MOLD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {t(`status.${s}`)}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={t('molds.f_supplier')} error={errors.supplier_id}>
                    <select className="input" value={values.supplier_id} onChange={set('supplier_id')}>
                        <option value="">{t('common.none')}</option>
                        {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                        <option value={NEW_SUPPLIER}>{t('molds.new_supplier')}</option>
                    </select>
                </Field>
                <Field label={t('molds.f_material')} error={errors.material}>
                    <input className="input" value={values.material} onChange={set('material')} maxLength={100} placeholder="PA66-GF30" />
                </Field>
                {values.supplier_id === NEW_SUPPLIER && (
                    <Field label={t('molds.f_new_supplier')} error={errors.new_supplier} required className="sm:col-span-2">
                        <input className="input" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} maxLength={100} />
                    </Field>
                )}
                <Field label={t('molds.f_cavities')} error={errors.cavities} required>
                    <input className="input" type="number" min="1" max="128" step="1" inputMode="numeric" value={values.cavities} onChange={set('cavities')} />
                </Field>
                <Field label={t('molds.f_start')} error={errors.start_date}>
                    <input className="input" type="date" value={values.start_date} onChange={set('start_date')} />
                </Field>
                <Field label={t('molds.f_deadline')} error={errors.deadline}>
                    <input className="input" type="date" value={values.deadline} onChange={set('deadline')} />
                </Field>
                <Field label={t('molds.f_cost')} error={errors.cost}>
                    <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={values.cost} onChange={set('cost')} />
                </Field>
                <Field label={t('molds.f_payment')} error={errors.payment_status}>
                    <select className="input" value={values.payment_status} onChange={set('payment_status')}>
                        {PAYMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {t(`payment.${s}`)}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={t('molds.f_notes')} error={errors.notes} className="sm:col-span-2">
                    <textarea className="input min-h-[88px]" rows={3} value={values.notes} onChange={set('notes')} maxLength={5000} />
                </Field>
            </form>
        </Modal>
    )
}
