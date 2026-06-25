export function isWebPreviewMode(): boolean {
  return import.meta.env.DEV && typeof window.electron === 'undefined'
}
