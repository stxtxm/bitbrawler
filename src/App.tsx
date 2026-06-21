import { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useGame } from './context/GameContext'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { initClickSound } from './hooks/useSound'
import { HomePage, CharacterCreation, Rankings, Login, Arena, NotFound, MedalHall } from './routes/lazyPages'
import LoadingScreen from './components/LoadingScreen'

function App() {
  useEffect(() => { initClickSound() }, [])
  const { activeCharacter, loading, dbAvailable } = useGame()
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
                (isOnline && dbAvailable) ? <Navigate to="/login" /> : <Navigate to="/" />
              )
            }
          />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/medal-hall" element={<MedalHall />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
