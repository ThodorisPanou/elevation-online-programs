// Is the page running as the home-screen app? iOS reports it through navigator.standalone, others through display-mode.
export function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
