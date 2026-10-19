import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Saved from './Saved.jsx'
import { inject } from '@vercel/analytics'
// Fonts ship inside the app, so nothing has to be fetched from Google (works with no signal).
import '@fontsource/bebas-neue/400.css'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/dm-serif-display/400-italic.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/permanent-marker/400.css'
import '@fontsource/special-elite/400.css'

// Free visitor counts (Vercel Web Analytics): no cookies, no personal data.
// Only when there's a signal, so offline phones never reach for the internet.
if (navigator.onLine) inject()
else window.addEventListener('online', () => inject(), { once: true })

// Offline support: keeps the app (and saved songs) on the phone.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

const page = window.location.pathname.replace(/\/+$/, '').toLowerCase()
const Page = page === '/saved' || page === '/offline' ? Saved : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
)
