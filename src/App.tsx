import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useGame } from './context/GameContext'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { HomePage, CharacterCreation, Rankings, Login, Arena } from './routes/lazyPages'
import LoadingScreen from './components/LoadingScreen'

function App() {
  const { activeCharacter, loading, firebaseAvailable } = useGame()
  const isOnline = useOnlineStatus()

  if (loading) {
    return <LoadingScreen />
  }

  const canAutoRedirect = !!activeCharacter

  return (
    <div className="App">
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
                (isOnline && firebaseAvailable) ? <Navigate to="/login" /> : <Navigate to="/" />
              )
            }
          />
          <Route path="/rankings" element={<Rankings />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
