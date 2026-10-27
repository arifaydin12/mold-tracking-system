import { useTranslation } from 'react-i18next'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'

export default function ConfirmDialog({ open, title, message, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) {
    const { t } = useTranslation()
    return (
        <Modal
            open={open}
            onClose={onCancel}
            title={title}
            size="sm"
            busy={busy}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
                        {busy && <Spinner />}
                        {confirmLabel || t('common.confirm')}
                    </button>
                </>
            }
        >
            <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        </Modal>
    )
}
