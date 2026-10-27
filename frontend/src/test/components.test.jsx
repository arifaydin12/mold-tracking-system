import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../i18n.js'
import Modal from '../components/ui/Modal.jsx'
import Field from '../components/ui/Field.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import { StatusBadge, PaymentBadge } from '../components/ui/Badge.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'
import CostBars from '../components/charts/CostBars.jsx'
import { ErrorState, EmptyState } from '../components/ui/States.jsx'
import { LanguageSwitcher } from '../components/layout/Controls.jsx'
import { ThemeProvider } from '../context/ThemeContext.jsx'
import { ToastProvider, useToast } from '../context/ToastContext.jsx'

vi.mock('../api', () => ({
    moldsApi: { list: vi.fn(), get: vi.fn(), archive: vi.fn(), restore: vi.fn() },
    suppliersApi: { list: vi.fn(async () => ({ data: [{ id: 1, name: 'Apex Toolworks' }] })) },
    authApi: { login: vi.fn() },
}))
vi.mock('../context/AuthContext.jsx', () => ({
    useAuth: () => ({ status: 'anonymous', can: () => true, user: { id: 1, role: 'admin', full_name: 'Test Admin' }, login: vi.fn() }),
}))

import { moldsApi } from '../api'
import Molds from '../pages/Molds.jsx'
import Login from '../pages/Login.jsx'

describe('Modal', () => {
    function Harness() {
        const [open, setOpen] = useState(false)
        return (
            <>
                <button onClick={() => setOpen(true)}>Open dialog</button>
                <Modal open={open} onClose={() => setOpen(false)} title="Edit thing" description="Some help text">
                    <input aria-label="First" />
                    <input aria-label="Second" />
                </Modal>
            </>
        )
    }

    it('is an accessible dialog: labelled, focuses the first field, traps Tab, closes on Escape and restores focus', async () => {
        const user = userEvent.setup()
        render(<Harness />)
        const trigger = screen.getByRole('button', { name: 'Open dialog' })
        await user.click(trigger)

        const dialog = screen.getByRole('dialog', { name: 'Edit thing' })
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAccessibleDescription('Some help text')
        expect(screen.getByLabelText('First')).toHaveFocus()

        await user.tab()
        expect(screen.getByLabelText('Second')).toHaveFocus()
        await user.tab()
        expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus() // wraps around inside the dialog
        await user.tab()
        expect(screen.getByLabelText('First')).toHaveFocus()
        await user.tab({ shift: true })
        expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()

        await user.keyboard('{Escape}')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()
    })

    it('does not close while busy', async () => {
        const onClose = vi.fn()
        render(
            <Modal open onClose={onClose} title="Busy" busy>
                <p>content</p>
            </Modal>,
        )
        await userEvent.setup().keyboard('{Escape}')
        expect(onClose).not.toHaveBeenCalled()
    })
})

describe('Field', () => {
    it('links the label, error and hint to the control', () => {
        render(
            <Field label="Code" error={{ key: 'min_length', params: { count: 2 } }} required>
                <input />
            </Field>,
        )
        const input = screen.getByLabelText(/Code/)
        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(input).toBeRequired()
        expect(screen.getByRole('alert')).toHaveTextContent('Enter at least 2 characters')
        expect(input).toHaveAccessibleDescription('Enter at least 2 characters')
    })

    it('shows server messages verbatim and the hint when there is no error', () => {
        const { rerender } = render(
            <Field label="Name" error="A mold with this code already exists">
                <input />
            </Field>,
        )
        expect(screen.getByRole('alert')).toHaveTextContent('A mold with this code already exists')
        rerender(
            <Field label="Name" hint="Helpful hint">
                <input />
            </Field>,
        )
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.getByText('Helpful hint')).toBeInTheDocument()
        expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
    })
})

describe('Pagination', () => {
    const meta = { page: 2, page_size: 20, total: 95, total_pages: 5 }

    it('shows the range and navigates', async () => {
        const onPage = vi.fn()
        const onPageSize = vi.fn()
        const user = userEvent.setup()
        render(<Pagination meta={meta} onPage={onPage} onPageSize={onPageSize} />)
        expect(screen.getByText('Showing 21–40 of 95')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
        await user.click(screen.getByRole('button', { name: 'Next page' }))
        expect(onPage).toHaveBeenCalledWith(3)
        await user.click(screen.getByRole('button', { name: 'Previous page' }))
        expect(onPage).toHaveBeenCalledWith(1)
        await user.selectOptions(screen.getByRole('combobox'), '50')
        expect(onPageSize).toHaveBeenCalledWith(50)
    })

    it('disables the edges', () => {
        const { rerender } = render(<Pagination meta={{ ...meta, page: 1 }} onPage={() => {}} />)
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
        rerender(<Pagination meta={{ ...meta, page: 5 }} onPage={() => {}} />)
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    })

    it('reads "0 of 0" for empty results', () => {
        render(<Pagination meta={{ page: 1, page_size: 20, total: 0, total_pages: 1 }} onPage={() => {}} />)
        expect(screen.getByText('Showing 0–0 of 0')).toBeInTheDocument()
    })
})

describe('Badges, charts and states', () => {
    it('translates badge labels with the UI language', async () => {
        const { rerender } = render(<StatusBadge value="revision" />)
        expect(screen.getByText('Revision')).toBeInTheDocument()
        await act(() => i18n.changeLanguage('de'))
        rerender(<StatusBadge value="revision" />)
        expect(screen.getByText('Änderung')).toBeInTheDocument()
        await act(() => i18n.changeLanguage('pl'))
        rerender(<PaymentBadge value="partial" />)
        expect(screen.getByText('Częściowo opłacona')).toBeInTheDocument()
    })

    it('renders donut segments proportionally and labels the chart', () => {
        render(
            <DonutChart
                segments={[
                    { key: 'a', label: 'Active', value: 3, color: '#0f0' },
                    { key: 'b', label: 'Trial', value: 1, color: '#ff0' },
                    { key: 'c', label: 'Retired', value: 0, color: '#ccc' },
                ]}
                centerValue="4"
                centerLabel="molds"
                ariaLabel="Status distribution"
            />,
        )
        expect(screen.getByRole('img', { name: 'Status distribution' })).toBeInTheDocument()
        expect(screen.getByText('75%')).toBeInTheDocument()
        expect(screen.getByText('25%')).toBeInTheDocument()
        expect(document.querySelectorAll('svg circle[stroke-dasharray]')).toHaveLength(2) // zero-value segment is skipped
    })

    it('renders stacked cost bars with a legend', () => {
        render(<CostBars rows={[{ label: 'Apex', primary: 1000, secondary: 500 }, { label: 'Baltic', primary: 300, secondary: 0 }]} primaryLabel="Purchase" secondaryLabel="Revisions" lng="en" ariaLabel="Cost by supplier" />)
        expect(screen.getByText('Apex')).toBeInTheDocument()
        expect(screen.getByText('€1.5k')).toBeInTheDocument()
        expect(screen.getByText('Revisions')).toBeInTheDocument()
    })

    it('shows retryable errors and role-specific forbidden messages', async () => {
        const onRetry = vi.fn()
        const { rerender } = render(<ErrorState error={{ status: 500, code: 'internal_error', message: 'Boom' }} onRetry={onRetry} />)
        expect(screen.getByRole('alert')).toHaveTextContent('Boom')
        await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
        expect(onRetry).toHaveBeenCalled()
        rerender(<ErrorState error={{ status: 403, code: 'forbidden', message: 'x' }} onRetry={onRetry} />)
        expect(screen.getByText('Access denied')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
        rerender(<EmptyState title="Nothing" message="Add something" />)
        expect(screen.getByText('Nothing')).toBeInTheDocument()
    })
})

describe('LanguageSwitcher and toasts', () => {
    it('switches the interface language and the <html lang> attribute', async () => {
        const user = userEvent.setup()
        render(
            <ThemeProvider>
                <LanguageSwitcher />
            </ThemeProvider>,
        )
        await user.click(screen.getByRole('button', { name: /^Language/ }))
        const options = screen.getAllByRole('menuitemradio').map((o) => o.textContent)
        expect(options).toEqual(['English', 'Deutsch', 'Polski'])
        expect(screen.getByRole('menuitemradio', { name: 'English' })).toBeChecked()
        await user.click(screen.getByRole('menuitemradio', { name: 'Polski' }))
        await waitFor(() => expect(i18n.resolvedLanguage).toBe('pl'))
        expect(document.documentElement.lang).toBe('pl')
        expect(localStorage.getItem('mts.lang')).toBe('pl')
    })

    it('shows toasts in a live region and lets users dismiss them', async () => {
        function Trigger() {
            const toast = useToast()
            return <button onClick={() => toast.success('Saved it', { duration: 0 })}>go</button>
        }
        const user = userEvent.setup()
        render(
            <ToastProvider>
                <Trigger />
            </ToastProvider>,
        )
        await user.click(screen.getByText('go'))
        expect(screen.getByRole('status')).toHaveTextContent('Saved it')
        await user.click(screen.getByRole('button', { name: 'Close' }))
        expect(screen.queryByText('Saved it')).not.toBeInTheDocument()
    })
})

describe('pages', () => {
    const renderMolds = () =>
        render(
            <MemoryRouter initialEntries={['/molds']}>
                <ToastProvider>
                    <Molds />
                </ToastProvider>
            </MemoryRouter>,
        )

    const row = (id, code, name) => ({
        id, code, name, project: 'Auto', material: 'PP', status: 'active', supplier_name: 'Apex Toolworks', deadline: '2020-01-01', cost: 1500,
        payment_status: 'paid', is_archived: false, trial_count: 1, revision_count: 0, maintenance_count: 0,
    })

    it('lists molds with status, cost and per-row actions', async () => {
        moldsApi.list.mockResolvedValueOnce({ data: [row(1, 'M-1', 'Air vent bezel'), row(2, 'M-2', 'Cable clip')], meta: { page: 1, page_size: 20, total: 2, total_pages: 1 } })
        renderMolds()
        expect(await screen.findByText('Air vent bezel')).toBeInTheDocument()
        expect(screen.getByText('2 molds match the current view')).toBeInTheDocument()
        expect(screen.getAllByText('€1,500')).toHaveLength(2)
        expect(screen.getByRole('link', { name: 'M-1' })).toHaveAttribute('href', '/molds/1')
        expect(screen.getByRole('button', { name: 'Archive mold M-2' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: /Code/ })).toHaveAttribute('aria-sort', 'ascending')
    })

    it('shows the empty state and the retryable error state', async () => {
        moldsApi.list.mockResolvedValueOnce({ data: [], meta: { page: 1, page_size: 20, total: 0, total_pages: 1 } })
        const { unmount } = renderMolds()
        expect(await screen.findByText('No molds yet')).toBeInTheDocument()
        unmount()

        moldsApi.list.mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error' })
        renderMolds()
        expect(await screen.findByText('Cannot reach the server')).toBeInTheDocument()
        moldsApi.list.mockResolvedValueOnce({ data: [row(1, 'M-9', 'Recovered')], meta: { page: 1, page_size: 20, total: 1, total_pages: 1 } })
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(await screen.findByText('Recovered')).toBeInTheDocument()
    })

    it('validates the login form before calling the API', async () => {
        render(
            <MemoryRouter>
                <ThemeProvider>
                    <Login />
                </ThemeProvider>
            </MemoryRouter>,
        )
        await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
        expect(screen.getAllByText('This field is required')).toHaveLength(2)
        expect(screen.getByLabelText(/Username/)).toHaveAttribute('aria-invalid', 'true')
        expect(screen.queryByText('Demo accounts')).not.toBeInTheDocument() // only shown in the demo build
    })
})
