import { useEffect } from 'react'

export function usePageTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} · Mold Tracking System` : 'Mold Tracking System'
    }, [title])
}
