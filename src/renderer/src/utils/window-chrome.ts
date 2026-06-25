export async function detectFramelessWindows(): Promise<boolean> {
  if (!window.windowApi) return false
  const platform = await window.windowApi.getPlatform()
  return platform === 'win32'
}
