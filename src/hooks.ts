import { useState } from 'react'

export function useClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const [emptyId, setEmptyId] = useState<string | null>(null)

  const copy = async (id: string, text: string) => {
    if (!text.trim()) {
      setCopiedId(null)
      setFailedId(null)
      setEmptyId(id)
      window.setTimeout(() => setEmptyId((current) => (current === id ? null : current)), 2200)
      return false
    }

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea')
      const activeElement = document.activeElement as HTMLElement | null
      textarea.value = text
      textarea.readOnly = true
      textarea.setAttribute('aria-hidden', 'true')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      activeElement?.focus()
      return copied
    }

    let success = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        success = true
      } else {
        success = fallbackCopy()
      }
    } catch {
      try { success = fallbackCopy() } catch { success = false }
    }

    if (success) {
      setFailedId(null)
      setEmptyId(null)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1800)
    } else {
      setCopiedId(null)
      setFailedId(id)
      setEmptyId(null)
      window.setTimeout(() => setFailedId((current) => (current === id ? null : current)), 2200)
    }
    return success
  }

  return { copy, copiedId, failedId, emptyId }
}
