import { lazy } from 'react'

const homeImporter = () => import('../pages/HomePage')
const characterCreationImporter = () => import('../pages/CharacterCreation')
const rankingsImporter = () => import('../pages/Rankings')
const loginImporter = () => import('../pages/Login')
const arenaImporter = () => import('../pages/Arena')
const notFoundImporter = () => import('../pages/NotFound')
const medalHallImporter = () => import('../pages/MedalHall')

export const canPrefetch = () => {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export const HomePage = lazy(homeImporter)
export const CharacterCreation = lazy(characterCreationImporter)
export const Rankings = lazy(rankingsImporter)
export const Login = lazy(loginImporter)
export const Arena = lazy(arenaImporter)
export const NotFound = lazy(notFoundImporter)
export const MedalHall = lazy(medalHallImporter)

export const prefetchArena = () => (canPrefetch() ? arenaImporter() : Promise.resolve())
