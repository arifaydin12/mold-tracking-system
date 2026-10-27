import { useTranslation } from 'react-i18next'

const TONES = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
    red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25',
    sky: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/25',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/25',
    slate: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/25',
}

export function Badge({ tone = 'slate', children, className = '' }) {
    return <span className={`badge ${TONES[tone]} ${className}`}>{children}</span>
}

export const STATUS_TONE = { trial: 'amber', active: 'green', revision: 'violet', maintenance: 'sky', retired: 'slate' }
export const STATUS_HEX = { trial: '#f59e0b', active: '#10b981', revision: '#8b5cf6', maintenance: '#0ea5e9', retired: '#94a3b8' }
const PAYMENT_TONE = { unpaid: 'red', partial: 'amber', paid: 'green' }
const OUTCOME_TONE = { pass: 'green', conditional: 'amber', fail: 'red' }
const MAINT_TONE = { planned: 'blue', in_progress: 'amber', completed: 'green' }
const ROLE_TONE = { admin: 'violet', engineer: 'blue', viewer: 'slate' }

const make = (ns, tones) =>
    function Translated({ value, className }) {
        const { t } = useTranslation()
        return (
            <Badge tone={tones[value] || 'slate'} className={className}>
                {t(`${ns}.${value}`, { defaultValue: value })}
            </Badge>
        )
    }

export const StatusBadge = make('status', STATUS_TONE)
export const PaymentBadge = make('payment', PAYMENT_TONE)
export const OutcomeBadge = make('outcome', OUTCOME_TONE)
export const MaintenanceStatusBadge = make('maintenance_status', MAINT_TONE)
export const RoleBadge = make('roles', ROLE_TONE)
