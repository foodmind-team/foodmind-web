function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** Formats the browser's calendar date without converting it to UTC. */
export function localCalendarDate(value = new Date(), offsetDays = 0) {
  const date = new Date(value)
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localMonday(value = new Date()) {
  const date = new Date(value)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return localCalendarDate(date)
}
