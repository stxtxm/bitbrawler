import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useGame } from './context/GameContext'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { HomePage, CharacterCreation, Rankings, Login, Arena, NotFound } from './routes/lazyPages'
import LoadingScreen from './components/LoadingScreen'
import Footer from './components/Footer'
import PwaInstallPrompt from './components/PwaInstallPrompt'

function App() {
  const { activeCharacter, loading, dbAvailable } = useGame()
  const isOnline = useOnlineStatus()

  if (loading) {
    return <LoadingScreen />
  }

  const canAutoRedirect = !!activeCharacter

  return (
    <div className="App">
      {/* Skip to content link - visible only when focused via keyboard */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Suspense fallback={
        <LoadingScreen />
      }>
        <Routes>
          <Route
            path="/"
            element={activeCharacter && canAutoRedirect ? <Navigate to="/arena" /> : <HomePage />}
          />
          <Route path="/create-character" element={<CharacterCreation />} />
          <Route
            path="/login"
            element={
              activeCharacter && canAutoRedirect ? (
                <Navigate to="/arena" />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/arena"
            element={
              activeCharacter ? (
                <Arena />
              ) : (
                (isOnline && dbAvailable) ? <Navigate to="/login" /> : <Navigate to="/" />
              )
            }
          />
          <Route path="/rankings" element={<Rankings />} />
        </Routes>
      </Suspense>
      <PwaInstallPrompt />
      <div className="app-content">
        <Suspense fallback={
          <LoadingScreen />
        }>
          <Routes>
            <Route
              path="/"
              element={activeCharacter && canAutoRedirect ? <Navigate to="/arena" /> : <HomePage />}
            />
            <Route path="/create-character" element={<CharacterCreation />} />
            <Route
              path="/login"
              element={
                activeCharacter && canAutoRedirect ? (
                  <Navigate to="/arena" />
                ) : (
                  <Login />
                )
              }
            />
            <Route
              path="/arena"
              element={
                activeCharacter ? (
                  <Arena />
                ) : (
                  (isOnline && dbAvailable) ? <Navigate to="/login" /> : <Navigate to="/" />
                )
              }
            />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
      <Footer />
>>>>>>> origin/master
    </div>
  )
}

export default App
