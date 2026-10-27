import { Children, cloneElement, isValidElement, useId } from 'react'
import { useTranslation } from 'react-i18next'

/** Resolves a validation error ({ key, params } from utils/validation, or a plain server string) into text. */
export function useErrorText() {
    const { t } = useTranslation()
    return (error) => {
        if (!error) return null
        if (typeof error === 'string') return error
        return t(`validation.${error.key}`, error.params)
    }
}

/**
 * Label + control + error/hint wrapper. The single child receives id, aria-invalid and aria-describedby
 * so screen readers announce validation messages.
 */
export default function Field({ label, error, hint, required = false, children, className = '' }) {
    const id = useId()
    const errorText = useErrorText()(error)
    const { t } = useTranslation()
    const describedBy = [errorText && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

    const child = Children.only(children)
    const control = isValidElement(child)
        ? cloneElement(child, { id, 'aria-invalid': errorText ? 'true' : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })
        : child

    return (
        <div className={className}>
            <label htmlFor={id} className="label">
                {label}
                {required && (
                    <span className="ml-0.5 text-red-500" aria-hidden="true">
                        *
                    </span>
                )}
                {required && <span className="sr-only"> ({t('common.required')})</span>}
            </label>
            {control}
            {hint && !errorText && (
                <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {hint}
                </p>
            )}
            {errorText && (
                <p id={`${id}-error`} className="field-error" role="alert">
                    {errorText}
                </p>
            )}
        </div>
    )
}
