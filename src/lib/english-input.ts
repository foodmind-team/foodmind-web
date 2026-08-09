export const ENGLISH_ONLY_MESSAGE = 'Please use English only. Chinese or mixed-language input is not supported.'

const letterPattern = /\p{Letter}/u
const latinPattern = /\p{Script=Latin}/u

export function isEnglishScriptInput(value: string) {
  for (const character of value) {
    if (letterPattern.test(character) && !latinPattern.test(character)) return false
  }
  return true
}
