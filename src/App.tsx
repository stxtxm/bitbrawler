import { Routes, Route, Navigate } from 'react-router-dom'
import { useGame } from './context/GameContext'
import HomePage from './pages/HomePage'
import CharacterCreation from './pages/CharacterCreation'
import Rankings from './pages/Rankings'
import Login from './pages/Login'
import Arena from './pages/Arena'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import SwUpdateToast from './components/SwUpdateToast'

function App() {
  const { activeCharacter, loading, firebaseAvailable } = useGame()
  const isOnline = useOnlineStatus()

  // Show nothing while checking persistence
  if (loading) {
    return <div className="App" style={{ textAlign: 'center', padding: '40px' }}>
      <p style={{ color: '#fff', fontFamily: 'Press Start 2P' }}>LOADING...</p>
    </div>
  }

  const canAutoRedirect = isOnline && firebaseAvailable

  return (
    <div className="App">
      <SwUpdateToast />
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
    </div>
  )
}

export default App
