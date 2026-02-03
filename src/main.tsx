import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { GameProvider } from './context/GameContext'
import './index.css'

// Dynamic basename: use repo name for GH Pages, root for local dev
const basename = '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <GameProvider>
        <App />
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
