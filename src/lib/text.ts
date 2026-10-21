/** "a stage", "an artist", "an arena": the vocabulary changes per event type, so the article must follow. */
export function aOrAn(word: string): string {
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`
}
