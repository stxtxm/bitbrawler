import { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useGame } from './context/GameContext'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { HomePage, CharacterCreation, Rankings, Login, Arena } from './routes/lazyPages'

function App() {
  const { activeCharacter, loading, firebaseAvailable } = useGame()
  const isOnline = useOnlineStatus()

  // Show nothing while checking persistence
  if (loading) {
    return <div className="App" style={{ textAlign: 'center', padding: '40px' }}>
      <p style={{ color: '#fff', fontFamily: 'Press Start 2P' }}>LOADING...</p>
    </div>
  }

  const canAutoRedirect = !!activeCharacter

  return (
    <div className="App">
      <Suspense fallback={
        <div className="App" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#fff', fontFamily: 'Press Start 2P' }}>LOADING...</p>
        </div>
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
