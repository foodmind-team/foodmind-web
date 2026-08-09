export function formatDateTime(value?: string | null) {
  if (!value) return 'Not provided'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatMoney(amount?: number | null, currency = 'SGD') {
  if (amount === undefined || amount === null) return 'Price not provided'
  try {
    return new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function sentenceCase(value?: string | null) {
  if (!value) return 'Not provided'
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase())
}

export function toLocalDateTimeValue(value?: string | null) {
  const date = value ? new Date(value) : new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
