function getLastPathSegment(path: string): string {
  const trimmed = path.replace(/[\\/]+$/u, '')
  if (trimmed === '') return ''

  const segments = trimmed.split(/[\\/]+/u).filter(Boolean)
  return segments.at(-1) ?? trimmed
}

export function derivePairNameFromDirectory(directory: string): string {
  return getLastPathSegment(directory)
}
