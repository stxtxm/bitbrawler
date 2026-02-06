export const shouldResetDaily = (lastReset: number): boolean => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastResetDate = new Date(lastReset)
  const lastResetDay = new Date(
    lastResetDate.getFullYear(),
    lastResetDate.getMonth(),
    lastResetDate.getDate(),
  )

  return today > lastResetDay
}
