import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Saved from './Saved.jsx'
import { inject } from '@vercel/analytics'

// Free visitor counts (Vercel Web Analytics): no cookies, no personal data.
inject()

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
