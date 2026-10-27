import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '../i18n.js'
import i18n from '../i18n.js'

// jsdom has no matchMedia
if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })
}

beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
})

afterEach(() => {
    cleanup()
})
