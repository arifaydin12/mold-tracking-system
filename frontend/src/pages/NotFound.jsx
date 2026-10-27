import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileQuestion, ShieldAlert } from 'lucide-react'
import { EmptyState } from '../components/ui/States.jsx'
import { usePageTitle } from '../hooks/usePageTitle.js'

export default function NotFound({ forbidden = false }) {
    const { t } = useTranslation()
    usePageTitle(forbidden ? t('errors.forbidden_title') : t('errors.not_found_title'))
    return (
        <div className="card">
            <EmptyState
                icon={forbidden ? ShieldAlert : FileQuestion}
                title={forbidden ? t('errors.forbidden_title') : t('errors.not_found_title')}
                message={forbidden ? t('errors.forbidden_message') : t('errors.not_found_message')}
                action={
                    <Link to="/" className="btn-primary">
                        {t('errors.back_to_dashboard')}
                    </Link>
                }
            />
        </div>
    )
}
