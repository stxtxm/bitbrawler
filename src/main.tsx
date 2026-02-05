import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { GameProvider } from './context/GameContext'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/main.scss'

// Dynamic basename: use repo name for GH Pages, root for local dev
const basename = '/';

const isStandalone =
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true

if (isStandalone) {
  document.body.classList.add('pwa')
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    )
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    let hasRefreshed = false
    const refreshOnce = () => {
      if (hasRefreshed) return
      hasRefreshed = true
      window.location.reload()
    }

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage('SKIP_WAITING')
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            registration.waiting?.postMessage('SKIP_WAITING')
          }
        })
      })
    }).catch((error) => {
      console.error('Service worker registration failed:', error)
    })

    navigator.serviceWorker.addEventListener('controllerchange', refreshOnce)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ErrorBoundary>
        <GameProvider>
          <App />
        </GameProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
)
