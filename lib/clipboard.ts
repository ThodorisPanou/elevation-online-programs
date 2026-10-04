// lib/clipboard.ts
// Copy text to the clipboard. navigator.clipboard only exists on secure origins (https, localhost) — e.g. not
// when testing from a phone on http://<PC-IP>:3000 — so fall back to the old textarea + execCommand('copy').

/** true when the text was copied. */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* e.g. permission denied — try the fallback */ }
  }

  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity  = '0'
  document.body.appendChild(area)
  area.select()
  area.setSelectionRange(0, text.length)   // iOS ignores select() alone
  let copied = false
  try { copied = document.execCommand('copy') } catch { /* unsupported */ }
  area.remove()
  return copied
}
