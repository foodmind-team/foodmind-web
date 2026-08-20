export function parsePreferenceCodes(value: string) {
  return [...new Set(value.split(/[,;\n]/).map((item) => item.trim().toUpperCase().replace(/\s+/g, '_')).filter(Boolean))]
}
