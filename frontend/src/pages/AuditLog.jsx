import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, ScrollText, Search, SearchX } from 'lucide-react'
import { logsApi } from '../api'
import { useAsync, useDebounced } from '../hooks/useAsync.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { formatDateTime } from '../utils/format.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import { TableSkeleton } from '../components/ui/Skeleton.jsx'
import { EmptyState, ErrorState } from '../components/ui/States.jsx'
import { Badge } from '../components/ui/Badge.jsx'

const ENTITY_TYPES = ['mold', 'trial', 'revision', 'maintenance', 'supplier', 'user']

/** "Chrome on Windows" from a user-agent string (good enough for an audit table). */
export function shortAgent(ua = '') {
    if (!ua) return '—'
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : null
    return browser && os ? `${browser} · ${os}` : browser || os || ua.slice(0, 40)
}

function useLogQuery(extra) {
    const [search, setSearch] = useState('')
    const debounced = useDebounced(search.trim(), 300)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    useEffect(() => setPage(1), [debounced, pageSize, JSON.stringify(extra)]) // eslint-disable-line react-hooks/exhaustive-deps
    const query = useMemo(() => ({ search: debounced || undefined, page, page_size: pageSize, ...extra }), [debounced, page, pageSize, extra])
    return { search, setSearch, page, setPage, setPageSize, query, hasSearch: Boolean(debounced) }
}

function ActivityTab() {
    const { t, i18n } = useTranslation()
    const lng = i18n.language
    const [entity, setEntity] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const extra = useMemo(
        () => ({ entity_type: entity || undefined, from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined }),
        [entity, from, to],
    )
    const { search, setSearch, setPage, setPageSize, query, hasSearch } = useLogQuery(extra)
    const { data, error, loading, reload } = useAsync(() => logsApi.activity(query), [query])
    const rows = data?.data || []
    const filtered = hasSearch || entity || from || to

    return (
        <div className="card">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row" role="search">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input type="search" className="input !pl-9" placeholder={t('audit.search_placeholder')} aria-label={t('audit.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="input lg:!w-44" aria-label={t('audit.f_entity')} value={entity} onChange={(e) => setEntity(e.target.value)}>
                    <option value="">{t('audit.all_entities')}</option>
                    {ENTITY_TYPES.map((e) => (
                        <option key={e} value={e}>
                            {t(`audit.entities.${e}`)}
                        </option>
                    ))}
                </select>
                <input type="date" className="input lg:!w-40" aria-label={t('audit.from')} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                <input type="date" className="input lg:!w-40" aria-label={t('audit.to')} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="relative overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                    <caption className="sr-only">{t('audit.tab_activity')}</caption>
                    <thead className="bg-slate-50 dark:bg-slate-900/60">
                        <tr>
                            <th scope="col" className="th">{t('audit.f_time')}</th>
                            <th scope="col" className="th">{t('audit.f_user')}</th>
                            <th scope="col" className="th">{t('audit.f_action')}</th>
                            <th scope="col" className="th">{t('audit.f_details')}</th>
                        </tr>
                    </thead>
                    {loading && !data ? (
                        <TableSkeleton rows={10} cols={4} />
                    ) : (
                        <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? 'opacity-60' : ''}`}>
                            {rows.map((a) => (
                                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="td whitespace-nowrap text-slate-500 dark:text-slate-400">{formatDateTime(a.created_at, lng)}</td>
                                    <td className="td whitespace-nowrap font-medium text-slate-900 dark:text-white">{a.user_name || <span className="font-normal text-slate-500 dark:text-slate-400">{t('common.system')}</span>}</td>
                                    <td className="td whitespace-nowrap">
                                        <Badge tone={a.action.endsWith('delete') || a.action.endsWith('archive') || a.action.endsWith('deactivate') ? 'red' : a.action.endsWith('create') ? 'green' : 'blue'}>
                                            {t(`audit.actions.${a.action.replace('.', '_')}`, { defaultValue: a.action })}
                                        </Badge>
                                    </td>
                                    <td className="td max-w-[480px] truncate" title={a.description || ''}>{a.description || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    )}
                </table>
            </div>
            {error && !data && <ErrorState error={error} onRetry={reload} />}
            {!loading && !error && rows.length === 0 && <EmptyState icon={filtered ? SearchX : ScrollText} title={t('audit.empty_title')} message={filtered ? t('molds.empty_filtered_message') : undefined} />}
            {data && rows.length > 0 && <Pagination meta={data.meta} onPage={setPage} onPageSize={setPageSize} />}
        </div>
    )
}

function LoginsTab() {
    const { t, i18n } = useTranslation()
    const lng = i18n.language
    const [result, setResult] = useState('')
    const extra = useMemo(() => ({ success: result || undefined }), [result])
    const { search, setSearch, setPage, setPageSize, query, hasSearch } = useLogQuery(extra)
    const { data, error, loading, reload } = useAsync(() => logsApi.logins(query), [query])
    const rows = data?.data || []

    return (
        <div className="card">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row" role="search">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input type="search" className="input !pl-9" placeholder={t('audit.login_search_placeholder')} aria-label={t('audit.login_search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="input sm:!w-44" aria-label={t('audit.f_result')} value={result} onChange={(e) => setResult(e.target.value)}>
                    <option value="">{t('audit.all_results')}</option>
                    <option value="true">{t('audit.success')}</option>
                    <option value="false">{t('audit.failed')}</option>
                </select>
            </div>
            <div className="relative overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                    <caption className="sr-only">{t('audit.tab_logins')}</caption>
                    <thead className="bg-slate-50 dark:bg-slate-900/60">
                        <tr>
                            <th scope="col" className="th">{t('audit.f_time')}</th>
                            <th scope="col" className="th">{t('audit.f_username')}</th>
                            <th scope="col" className="th">{t('audit.f_result')}</th>
                            <th scope="col" className="th">{t('audit.f_ip')}</th>
                            <th scope="col" className="th">{t('audit.f_client')}</th>
                        </tr>
                    </thead>
                    {loading && !data ? (
                        <TableSkeleton rows={10} cols={5} />
                    ) : (
                        <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? 'opacity-60' : ''}`}>
                            {rows.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="td whitespace-nowrap text-slate-500 dark:text-slate-400">{formatDateTime(l.created_at, lng)}</td>
                                    <td className="td font-medium text-slate-900 dark:text-white">{l.username}</td>
                                    <td className="td"><Badge tone={l.success ? 'green' : 'red'}>{l.success ? t('audit.success') : t('audit.failed')}</Badge></td>
                                    <td className="td font-mono text-xs">{l.ip_address || '—'}</td>
                                    <td className="td whitespace-nowrap text-slate-500 dark:text-slate-400" title={l.user_agent || ''}>{shortAgent(l.user_agent)}</td>
                                </tr>
                            ))}
                        </tbody>
                    )}
                </table>
            </div>
            {error && !data && <ErrorState error={error} onRetry={reload} />}
            {!loading && !error && rows.length === 0 && <EmptyState icon={hasSearch || result ? SearchX : KeyRound} title={t('audit.empty_title')} message={hasSearch || result ? t('molds.empty_filtered_message') : undefined} />}
            {data && rows.length > 0 && <Pagination meta={data.meta} onPage={setPage} onPageSize={setPageSize} />}
        </div>
    )
}

export default function AuditLog() {
    const { t } = useTranslation()
    usePageTitle(t('nav.audit_log'))
    const [tab, setTab] = useState('activity')
    const tabs = [
        ['activity', t('audit.tab_activity')],
        ['logins', t('audit.tab_logins')],
    ]
    return (
        <>
            <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
            <div role="tablist" aria-label={t('audit.title')} className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {tabs.map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`tab-${key}`}
                        aria-selected={tab === key}
                        aria-controls={`panel-${key}`}
                        tabIndex={tab === key ? 0 : -1}
                        onClick={() => setTab(key)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                                const next = tab === 'activity' ? 'logins' : 'activity'
                                setTab(next)
                                document.getElementById(`tab-${next}`)?.focus()
                            }
                        }}
                        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === 'activity' ? <ActivityTab /> : <LoginsTab />}
            </div>
        </>
    )
}
