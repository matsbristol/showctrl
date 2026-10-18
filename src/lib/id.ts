/** Short random id, same format as the prototype's `rid()`. */
export function rid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}
