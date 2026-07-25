import { useEffect } from 'react'
import { defaultEditorState, EditorSelection, EditorState } from './types'

const editableTags = 'h1,h2,h3,h4,h5,h6,p,span,strong,small,a,button,label,li'

function isTextLeaf(element: Element) {
  return element.childElementCount === 0 && Boolean(element.textContent?.trim())
}

function escapeSelector(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)
}

function selectorFor(element: Element) {
  if (element instanceof HTMLElement && element.dataset.editorInsertId) {
    return `[data-editor-insert-id="${escapeSelector(element.dataset.editorInsertId)}"]`
  }
  const parts: string[] = []
  let current: Element | null = element
  while (current && current !== document.body && parts.length < 8) {
    if (current.id) {
      parts.unshift(`#${escapeSelector(current.id)}`)
      break
    }
    const classes = Array.from(current.classList)
      .filter((className) => Boolean(className) && !className.startsWith('editor-preview-'))
      .slice(0, 2)
      .map(escapeSelector)
    const classPart = classes.length ? `.${classes.join('.')}` : ''
    const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((item) => item.tagName === current!.tagName) : []
    const index = siblings.indexOf(current) + 1
    parts.unshift(`${current.tagName.toLowerCase()}${classPart}:nth-of-type(${Math.max(index, 1)})`)
    current = current.parentElement
  }
  return parts.join(' > ')
}

function findTarget(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null
  if (node.tagName === 'IMG' || node.tagName === 'VIDEO') return node
  const inserted = node.closest('[data-editor-insert-id]')
  if (inserted) return inserted
  const editable = node.closest(editableTags)
  if (editable && editable.textContent?.trim()) return editable
  if (isTextLeaf(node)) return node
  return node
}

function selectionFromElement(element: Element, page: string): EditorSelection {
  const kind = element.tagName === 'IMG' ? 'image' : element.matches(editableTags) || isTextLeaf(element) ? 'text' : 'element'
  const insertionId = element instanceof HTMLElement ? element.dataset.editorInsertId : undefined
  const parent = element.parentElement ?? document.body
  return {
    selector: selectorFor(element),
    parentSelector: selectorFor(parent),
    page,
    kind,
    text: element.textContent?.trim() ?? '',
    src: element.tagName === 'IMG' ? element.getAttribute('src') ?? '' : '',
    alt: element.tagName === 'IMG' ? element.getAttribute('alt') ?? '' : '',
    tag: element.tagName.toLowerCase(),
    insertionId,
  }
}

function shouldPassThroughInEdit(element: Element) {
  return Boolean(
    element.closest(
      'input,textarea,select,[contenteditable="true"],[role="tab"],.prompt-accordion-trigger,.prompt-list-open,.copy-button,.prompt-details-button,.modal-close',
    ),
  )
}

function addPreviewStyles() {
  if (document.getElementById('editor-preview-style')) return
  const style = document.createElement('style')
  style.id = 'editor-preview-style'
  style.textContent = `
    .editor-preview-selected { outline: 2px solid #dfff3f !important; outline-offset: 4px !important; cursor: crosshair !important; }
    [data-editor-insert-id] { cursor: crosshair !important; }
    body.editor-preview-mode img, body.editor-preview-mode video { pointer-events: auto !important; }
    body.editor-preview-edit .card-open-surface,
    body.editor-preview-edit .prompt-card-open,
    body.editor-preview-edit .workflow-detail-card-open { display: none !important; pointer-events: none !important; }
    body.editor-preview-edit .work-card-ambient { pointer-events: none !important; }
    body.editor-preview-edit .work-card-topline,
    body.editor-preview-edit .work-card-topline *,
    body.editor-preview-edit .work-card-content,
    body.editor-preview-edit .work-card-content *,
    body.editor-preview-edit .workflow-detail-card-copy,
    body.editor-preview-edit .workflow-detail-card-copy * { pointer-events: auto !important; }
  `
  document.head.appendChild(style)
}

function applyStyles(element: HTMLElement, styles: Record<string, string> | undefined) {
  if (!styles) return
  Object.entries(styles).forEach(([property, value]) => {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value)
  })
}

function applyState(state: EditorState, page: string) {
  Object.values(state.overrides).forEach((override) => {
    if (override.page && override.page !== page) return
    const element = document.querySelector(override.selector)
    if (!(element instanceof HTMLElement)) return
    if ((override.kind === 'text' || (override.kind === 'element' && isTextLeaf(element))) && override.value !== undefined && element.textContent !== override.value) {
      element.textContent = override.value
    }
    if (element instanceof HTMLImageElement) {
      if (override.src && element.getAttribute('src') !== override.src) element.src = override.src
      if (override.alt !== undefined && element.alt !== override.alt) element.alt = override.alt
    }
    if (element.hidden !== Boolean(override.hidden)) element.hidden = Boolean(override.hidden)
    applyStyles(element, override.styles)
  })

  state.insertions.filter((item) => item.page === page).forEach((item) => {
    if (document.querySelector(`[data-editor-insert-id="${escapeSelector(item.id)}"]`)) return
    const parent = document.querySelector(item.parentSelector) ?? document.body
    const element = document.createElement(item.kind === 'image' ? 'img' : 'div')
    element.setAttribute('data-editor-insert-id', item.id)
    element.setAttribute('data-editor-insert-kind', item.kind)
    if (item.kind === 'image') {
      element.setAttribute('src', item.src || '/placeholders/black.svg')
      element.setAttribute('alt', item.alt || '')
    } else {
      element.textContent = item.value || '新文字'
    }
    applyStyles(element as HTMLElement, item.styles)
    parent.appendChild(element)
  })
}

export function EditorRuntime() {
  useEffect(() => {
    let mounted = true
    const preview = new URLSearchParams(window.location.search).get('editorPreview') === '1'
    const page = window.location.pathname
    let currentState = defaultEditorState
    let applying = false
    const applyCurrentState = () => {
      if (!mounted || applying) return
      applying = true
      applyState(currentState, page)
      applying = false
    }
    const loadAndApply = async () => {
      try {
        const response = await fetch(`/editor-content.json?ts=${Date.now()}`, { cache: 'no-store' })
        if (response.ok) currentState = await response.json() as EditorState
      } catch {
        currentState = defaultEditorState
      }
      if (!mounted) return
      applyCurrentState()
    }

    const observer = new MutationObserver(() => {
      if (!applying) window.requestAnimationFrame(applyCurrentState)
    })
    if (document.body) observer.observe(document.body, { childList: true, subtree: true })
    void loadAndApply()
    if (!preview) return () => { mounted = false; observer.disconnect() }

    addPreviewStyles()
    document.body.classList.add('editor-preview-mode')
    let previewMode: 'edit' | 'browse' = new URLSearchParams(window.location.search).get('editorMode') === 'browse' ? 'browse' : 'edit'
    document.body.classList.toggle('editor-preview-edit', previewMode === 'edit')
    let active: Element | null = null
    const select = (element: Element) => {
      active?.classList.remove('editor-preview-selected')
      active = element
      active.classList.add('editor-preview-selected')
      const message = { type: 'editor:select', selection: selectionFromElement(element, page) satisfies EditorSelection }
      window.parent.postMessage(message, '*')
    }
    const onClick = (event: MouseEvent) => {
      const rawTarget = event.target instanceof Element ? event.target : null
      if (previewMode === 'edit' && rawTarget && shouldPassThroughInEdit(rawTarget)) return
      const target = findTarget(event.target)
      if (!target) return
      if (previewMode === 'browse') {
        const link = target.closest('a')
        if (link instanceof HTMLAnchorElement && link.href) {
          const nextUrl = new URL(link.href, window.location.href)
          if (nextUrl.origin === window.location.origin) {
            event.preventDefault()
            window.parent.postMessage({ type: 'editor:navigate', path: nextUrl.pathname + nextUrl.search + nextUrl.hash }, '*')
          }
        }
        return
      }
      event.preventDefault()
      event.stopPropagation()
      select(target)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'editor:state' && event.data.state) {
        currentState = event.data.state as EditorState
        applyCurrentState()
        return
      }
      if (event.data?.type === 'editor:mode' && (event.data.mode === 'edit' || event.data.mode === 'browse')) {
        previewMode = event.data.mode
        document.body.classList.toggle('editor-preview-browse', previewMode === 'browse')
        document.body.classList.toggle('editor-preview-edit', previewMode === 'edit')
        return
      }
      if (event.data?.type !== 'editor:highlight' || typeof event.data.selector !== 'string') return
      const target = document.querySelector(event.data.selector)
      if (target) select(target)
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('message', onMessage)
    return () => {
      mounted = false
      observer.disconnect()
      document.body.classList.remove('editor-preview-mode')
      document.body.classList.remove('editor-preview-browse')
      document.body.classList.remove('editor-preview-edit')
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
