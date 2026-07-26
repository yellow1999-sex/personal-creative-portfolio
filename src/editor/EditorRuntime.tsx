import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { defaultEditorState, editorOverrideAppliesToPage, editorOverrideKey, EditorInsertion, EditorSelection, EditorState } from './types'

const editableTags = 'h1,h2,h3,h4,h5,h6,p,span,strong,small,a,button,label,li'
const insertionRecords = new WeakMap<HTMLElement, EditorInsertion>()

function isTextLeaf(element: Element) {
  return element.childElementCount === 0 && Boolean(element.textContent?.trim())
}

function escapeSelector(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)
}

function selectorFor(element: Element) {
  if (element instanceof HTMLElement && element.dataset.editorId) {
    return `[data-editor-id="${escapeSelector(element.dataset.editorId)}"]`
  }
  if (element instanceof HTMLImageElement && element.dataset.editorInsertId) {
    return `[data-editor-insert-id="${escapeSelector(element.dataset.editorInsertId)}"][data-editor-insert-image="true"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorInsertId) {
    return `[data-editor-insert-id="${escapeSelector(element.dataset.editorInsertId)}"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorTextKey) {
    return `[data-editor-text-key="${escapeSelector(element.dataset.editorTextKey)}"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorImageKey) {
    return `[data-editor-image-key="${escapeSelector(element.dataset.editorImageKey)}"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorMediaKey) {
    return `[data-editor-media-key="${escapeSelector(element.dataset.editorMediaKey)}"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorPromptTitleId) {
    return `[data-editor-prompt-title-id="${escapeSelector(element.dataset.editorPromptTitleId)}"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorPromptId) {
    return `[data-editor-prompt-id="${escapeSelector(element.dataset.editorPromptId)}"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorGalleryId) {
    return `[data-editor-gallery-id="${escapeSelector(element.dataset.editorGalleryId)}"]`
  }
  if (element instanceof HTMLElement && element.dataset.editorCardId) {
    return `[data-editor-card-id="${escapeSelector(element.dataset.editorCardId)}"]`
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
    parts.unshift(`${current.tagName.toLowerCase()}${classPart}`)
    current = current.parentElement
  }
  return parts.join(' > ')
}

function findTarget(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null
  const inserted = node.closest('[data-editor-insert-id]')
  if (inserted) return inserted.querySelector('img') ?? inserted
  const stable = node.closest('[data-editor-id], [data-editor-prompt-title-id], [data-editor-prompt-id]')
  if (stable) return stable
  if (node.tagName === 'IMG' || node.tagName === 'VIDEO' || node.tagName === 'AUDIO') return node
  const mediaCard = node.closest('button, a')
  const cardImage = mediaCard?.querySelector('img')
  if (cardImage && !mediaCard?.closest('.nav-brand, .floating-nav')) return cardImage
  const editable = node.closest(editableTags)
  if (editable && editable.textContent?.trim()) return editable
  if (isTextLeaf(node)) return node
  const contactCard = node.closest('.clean-contact-cards > div')
  const contactValue = contactCard?.querySelector('[data-editor-text-key$="-value"]')
  if (contactValue) return contactValue
  return node
}

function selectionFromElement(element: Element, page: string): EditorSelection {
  const kind = element.tagName === 'IMG' ? 'image' : element.tagName === 'VIDEO' ? 'video' : element.tagName === 'AUDIO' ? 'audio' : element instanceof HTMLElement && (element.dataset.editorPromptId || element.dataset.editorPromptTitleId) ? 'text' : element.matches(editableTags) || isTextLeaf(element) ? 'text' : 'element'
  const insertionId = element instanceof HTMLElement ? element.dataset.editorInsertId : undefined
  const parent = element.parentElement ?? document.body
  const gallery = element.closest('.pure-gallery-grid, .portfolio-grid')
  const card = element.closest<HTMLElement>('[data-editor-card-id]')
  return {
    selector: selectorFor(element),
    parentSelector: selectorFor(parent),
    containerSelector: gallery ? selectorFor(gallery) : undefined,
    galleryId: gallery instanceof HTMLElement ? gallery.dataset.editorGalleryId : undefined,
    page,
    kind,
    text: element.textContent?.trim() ?? '',
    src: element.matches('img,video,audio') ? element.getAttribute('src') ?? '' : '',
    alt: element.tagName === 'IMG' ? element.getAttribute('alt') ?? '' : '',
    tag: element.tagName.toLowerCase(),
    insertionId,
    cardId: card?.dataset.editorCardId,
  }
}

function shouldPassThroughInEdit(element: Element) {
  if (element.closest('[data-editor-insert-id]')) return false
  if (element.closest('[data-editor-prompt-title-id], [data-editor-prompt-id]')) return false
  return Boolean(
    element.closest(
      'input,textarea,select,[contenteditable="true"],[role="tab"],.prompt-accordion-trigger,.prompt-list-open,.copy-button,.prompt-details-button,.modal-close,.editor-gallery-add,.page-audio-control,.clean-audio-control',
    ),
  )
}

function addBackgroundStyles() {
  if (document.getElementById('editor-background-style')) return
  const style = document.createElement('style')
  style.id = 'editor-background-style'
  style.textContent = `
    [data-editor-page-background] { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; background: #000; }
    body.editor-page-background-active > #root { position: relative; z-index: 1; }
    [data-editor-page-background-image], [data-editor-page-background-video] { position: absolute; inset: 0; width: 100%; height: 100%; }
    [data-editor-page-background-image] { z-index: 0; background-position: center; background-repeat: no-repeat; background-size: cover; }
    [data-editor-page-background-video] { z-index: 1; display: block; object-fit: cover; object-position: center; background: transparent; }
    [data-editor-page-background] video { pointer-events: none !important; }
  `
  document.head.appendChild(style)
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
    body.editor-preview-edit [data-editor-prompt-title-id]:empty { min-height: 1.25em; }
    body.editor-preview-edit [data-editor-prompt-title-id]:empty::after { content: '点击添加标题'; display: inline-block; color: rgba(17, 22, 17, 0.5); font-size: 12px; font-weight: 400; }
    body.editor-preview-edit .clean-contact-cards strong:empty::after { content: '点击添加内容'; display: inline-block; min-width: 7em; padding: 4px 8px; color: rgba(223,255,63,.9); border: 1px dashed rgba(223,255,63,.55); border-radius: 5px; font-family: inherit; font-size: 12px; font-weight: 400; letter-spacing: 0; }
    body.editor-preview-edit .clean-contact-cards > div { cursor: crosshair !important; }
  `
  document.head.appendChild(style)
}

function applyStyles(element: HTMLElement, styles: Record<string, string> | undefined) {
  if (!styles) return
  Object.entries(styles).forEach(([property, value]) => {
    const cssProperty = property.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
    if (element.style.getPropertyValue(cssProperty) !== value) element.style.setProperty(cssProperty, value)
  })
}

function getPageOverride(state: EditorState, selector: string, page: string) {
  const exact = state.overrides[editorOverrideKey(page, selector)]
  if (exact) return exact
  const legacy = state.overrides[selector]
  return legacy && editorOverrideAppliesToPage(legacy, page) ? legacy : undefined
}

function resolveInsertionParent(selector: string) {
  const legacyIndex = selector.match(/^\[data-editor-gallery-id="(\d+)"\]$/)
  if (legacyIndex) {
    return document.querySelectorAll<HTMLElement>('[data-editor-gallery-id]')[Number(legacyIndex[1])] ?? null
  }
  try {
    return document.querySelector<HTMLElement>(selector)
  } catch {
    return null
  }
}

function openInsertedImagePreview(source: string, alt: string) {
  document.querySelector('[data-editor-insert-lightbox]')?.remove()
  const overlay = document.createElement('div')
  overlay.setAttribute('data-editor-insert-lightbox', 'true')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.86);cursor:zoom-out'
  const image = document.createElement('img')
  image.src = source
  image.alt = alt
  image.style.cssText = 'max-width:94vw;max-height:92vh;object-fit:contain;border-radius:12px'
  overlay.appendChild(image)
  overlay.addEventListener('click', () => overlay.remove(), { once: true })
  document.body.appendChild(overlay)
}

const defaultInsertionPrompt = 'Please edit this image prompt in the visual editor.'

function insertionEventDetail(item: EditorState['insertions'][number], parent: HTMLElement) {
  const galleryId = parent.dataset.editorGalleryId || 'composite'
  const categoryLabel = item.categoryLabel || 'Scene pack'
  return {
    id: item.id,
    title: item.title || item.alt || 'New work',
    category: galleryId,
    categoryLabel,
    image: item.src || '/placeholders/black.svg',
    alt: item.alt || item.title || 'New work',
    prompt: item.prompt || defaultInsertionPrompt,
    summary: item.summary || 'This imported card has an editable prompt.',
    tags: item.tags?.length ? item.tags : [categoryLabel, 'To edit'],
    meta: item.meta || `${categoryLabel} / Editable prompt`,
    index: 0,
  }
}

function emitInsertionEvent(type: 'editor:open-insertion-work' | 'editor:open-insertion-prompt', item: EditorState['insertions'][number], parent: HTMLElement) {
  window.dispatchEvent(new CustomEvent(type, { detail: insertionEventDetail(item, parent) }))
}

function applyState(state: EditorState, page: string) {
  const removedCardIds = new Set(state.removedCards?.[page] ?? [])
  document.querySelectorAll<HTMLElement>('[data-editor-card-id]').forEach((card) => {
    const cardId = card.dataset.editorCardId
    if (cardId && removedCardIds.has(cardId)) card.remove()
  })
  document.querySelectorAll<HTMLElement>('.pure-gallery-section .archive-section-heading, .archive-section .archive-section-heading').forEach((heading) => {
    if (!document.body.classList.contains('editor-preview-mode')) return
    const existingButton = heading.querySelector<HTMLButtonElement>('.editor-gallery-add')
    if (existingButton) {
      existingButton.hidden = !document.body.classList.contains('editor-preview-edit')
      return
    }
    const grid = heading.parentElement?.querySelector<HTMLElement>('.pure-gallery-grid, .portfolio-grid')
    const galleryId = grid?.dataset.editorGalleryId
    if (!grid || !galleryId) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'editor-gallery-add'
    button.hidden = !document.body.classList.contains('editor-preview-edit')
    button.innerHTML = '<span>新增小窗口</span><span aria-hidden="true">+</span>'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (!document.body.classList.contains('editor-preview-edit')) return
      window.parent.postMessage({ type: 'editor:add-gallery', galleryId }, '*')
    })
    heading.appendChild(button)
  })
  document.querySelectorAll<HTMLElement>('.clean-contact-cards > div').forEach((card, index) => {
    card.querySelector('span')?.setAttribute('data-editor-text-key', `contact-card-${index}-label`)
    card.querySelector('strong')?.setAttribute('data-editor-text-key', `contact-card-${index}-value`)
  })
  document.querySelector('.clean-qr-panel > span')?.setAttribute('data-editor-text-key', 'contact-qr-label')
  document.querySelector('.clean-qr-panel > small')?.setAttribute('data-editor-text-key', 'contact-qr-number')
  const pageImage = getPageOverride(state, '__page_background_image__', page)
  const pageVideo = getPageOverride(state, '__page_background_video__', page)
  const backgroundRoot = document.querySelector<HTMLElement>('[data-editor-page-background]') ?? (() => {
    const root = document.createElement('div')
    root.dataset.editorPageBackground = 'true'
    root.setAttribute('aria-hidden', 'true')
    root.innerHTML = '<div data-editor-page-background-image></div><video data-editor-page-background-video autoplay muted loop playsinline></video>'
    document.body.prepend(root)
    return root
  })()
  const backgroundImage = backgroundRoot.querySelector<HTMLElement>('[data-editor-page-background-image]')
  const backgroundVideo = backgroundRoot.querySelector<HTMLVideoElement>('[data-editor-page-background-video]')
  const imageDisabled = Boolean(pageImage?.page === page && pageImage.hidden && !pageImage.src)
  const videoDisabled = Boolean(pageVideo?.page === page && pageVideo.hidden && !pageVideo.src)
  const imageActive = Boolean(pageImage?.page === page && pageImage.src && !imageDisabled)
  const videoActive = Boolean(pageVideo?.page === page && pageVideo.src && !videoDisabled)
  const imageSrc = imageActive ? pageImage?.src ?? '' : ''
  const videoSrc = videoActive ? pageVideo?.src ?? '' : ''
  if (backgroundImage) {
    const nextBackgroundImage = imageActive ? `url("${imageSrc}")` : ''
    if (backgroundImage.style.backgroundImage !== nextBackgroundImage) backgroundImage.style.backgroundImage = nextBackgroundImage
    if (backgroundImage.hidden !== !imageActive) backgroundImage.hidden = !imageActive
  }
  if (backgroundVideo) {
    if (backgroundVideo.hidden !== !videoActive) backgroundVideo.hidden = !videoActive
    if (videoActive && backgroundVideo.getAttribute('src') !== videoSrc) {
      backgroundVideo.src = videoSrc
      backgroundVideo.load()
      void backgroundVideo.play().catch(() => undefined)
    }
    if (!videoActive && (backgroundVideo.getAttribute('src') || backgroundVideo.currentSrc)) {
      backgroundVideo.removeAttribute('src')
      backgroundVideo.load()
    }
  }
  if (backgroundRoot.hidden !== (!imageActive && !videoActive)) backgroundRoot.hidden = !imageActive && !videoActive
  document.body.classList.toggle('editor-page-background-active', imageActive || videoActive)

  const defaultSceneImage = document.querySelector<HTMLImageElement>('[data-editor-media-key="home-scene-image"]')
  const defaultSceneVideo = document.querySelector<HTMLVideoElement>('[data-editor-media-key="home-scene-video"]')
  if (defaultSceneImage) defaultSceneImage.hidden = imageDisabled
  if (defaultSceneVideo) defaultSceneVideo.hidden = videoDisabled

  const audioOverride = getPageOverride(state, '__page_audio__', page)
  const audioActive = Boolean(audioOverride?.page === page && audioOverride.src)
  const audioDisabled = Boolean(audioOverride?.page === page && audioOverride.hidden && !audioOverride.src)
  const existingAudio = document.querySelector<HTMLAudioElement>('audio[data-editor-page-audio]')
  if (!audioActive && existingAudio) {
    existingAudio.pause()
    existingAudio.removeAttribute('src')
    existingAudio.load()
    existingAudio.remove()
  }
  document.querySelectorAll<HTMLAudioElement>('audio[data-editor-media-key]').forEach((audio) => {
    if (audioDisabled) {
      audio.dataset.editorPageDisabled = 'true'
      audio.hidden = true
      audio.muted = true
      audio.pause()
    } else {
      delete audio.dataset.editorPageDisabled
      audio.hidden = false
    }
  })

  Object.values(state.overrides).forEach((override) => {
    if (!editorOverrideAppliesToPage(override, page)) return
    if (override.selector === '__page_background_image__' || override.selector === '__page_background_video__') return
    if (override.selector === '__page_audio__' && override.src) {
       let audio = document.querySelector<HTMLAudioElement>('audio[data-editor-page-audio]')
       if (!audio) {
         audio = document.querySelector<HTMLAudioElement>('audio')
         if (audio) audio.dataset.editorPageAudio = 'true'
       }
       if (!audio) { audio = document.createElement('audio'); audio.dataset.editorPageAudio = 'true'; audio.loop = true; audio.autoplay = true; audio.hidden = true; document.body.appendChild(audio) }
      if (audio.src !== new URL(override.src, window.location.href).href) { audio.src = override.src; audio.load(); void audio.play().catch(() => undefined) }
      return
    }
    let elements: Element[] = []
    try { elements = Array.from(document.querySelectorAll(override.selector)) } catch { elements = [] }
    elements.forEach((element) => {
      if (!(element instanceof HTMLElement)) return
      const targetElement = override.kind === 'image' && !(element instanceof HTMLImageElement)
        ? element.querySelector<HTMLImageElement>('img[data-editor-insert-id]') ?? element
        : element
      if ((override.kind === 'text' || (override.kind === 'element' && isTextLeaf(targetElement))) && override.value !== undefined && targetElement.textContent !== override.value) {
        targetElement.textContent = override.value
      }
      if (targetElement instanceof HTMLImageElement) {
        if (override.src && targetElement.getAttribute('src') !== override.src) targetElement.src = override.src
        if (override.alt !== undefined && targetElement.alt !== override.alt) targetElement.alt = override.alt
      }
      if (targetElement instanceof HTMLVideoElement || targetElement instanceof HTMLAudioElement) {
        if (override.src && targetElement.getAttribute('src') !== override.src) {
          targetElement.src = override.src
          targetElement.load()
          if (targetElement instanceof HTMLVideoElement) void targetElement.play().catch(() => undefined)
        }
      }
      if (targetElement.hidden !== Boolean(override.hidden)) targetElement.hidden = Boolean(override.hidden)
      applyStyles(targetElement, override.styles)
      if (override.parentStyles && targetElement.parentElement) applyStyles(targetElement.parentElement, override.parentStyles)
    })
  })

  const activeInsertionIds = new Set(state.insertions.filter((item) => item.page === page).map((item) => item.id))
  document.querySelectorAll<HTMLElement>('[data-editor-insert-kind]').forEach((element) => {
    if (!activeInsertionIds.has(element.dataset.editorInsertId ?? '')) element.remove()
  })

  state.insertions.filter((item) => item.page === page).forEach((item) => {
    const editorPreview = document.body.classList.contains('editor-preview-mode')
    const existing = document.querySelector<HTMLElement>(`[data-editor-insert-kind][data-editor-insert-id="${escapeSelector(item.id)}"]`)
    if (existing) {
      insertionRecords.set(existing, item)
      const image = existing.querySelector<HTMLImageElement>('img')
      const card = existing.querySelector<HTMLElement>('.editor-insert-card') ?? existing
      if (image && image.getAttribute('src') !== (item.src || '/placeholders/black.svg')) image.src = item.src || '/placeholders/black.svg'
      if (image) {
        image.alt = item.alt || ''
        applyStyles(image, item.styles)
      }
      const title = existing.querySelector<HTMLElement>('[data-editor-insert-title]')
      if (title) title.textContent = item.title || item.alt || 'New work'
      const tags = existing.querySelector<HTMLElement>('[data-editor-insert-tags]')
      if (tags) tags.replaceChildren(...(item.tags?.length ? item.tags : ['To edit']).map((tag) => { const span = document.createElement('span'); span.textContent = tag; return span }))
      const promptButton = existing.querySelector<HTMLButtonElement>('[data-editor-insert-prompt]')
      if (promptButton) promptButton.textContent = '查看提示词'
      applyStyles(card, { 'aspect-ratio': '16 / 9', ...(item.styles?.['aspect-ratio'] ? { 'aspect-ratio': item.styles['aspect-ratio'] } : {}) })
      const placeholder = image?.getAttribute('src') === '/placeholders/black.svg' || !image?.getAttribute('src')
      existing.classList.toggle('is-placeholder', placeholder)
      card.classList.toggle('is-placeholder', placeholder)
      const hint = existing.querySelector('.editor-insert-placeholder-hint')
      if (placeholder && !hint) {
        const nextHint = document.createElement('span')
        nextHint.className = 'editor-insert-placeholder-hint'
        nextHint.textContent = '鐐瑰嚮涓婁紶鍥剧墖'
        existing.appendChild(nextHint)
      } else if (!placeholder) hint?.remove()
      if (placeholder && hint) hint.textContent = editorPreview ? '点击上传图片' : '图片待上传'
      existing.setAttribute('aria-label', editorPreview ? '新增小窗口，点击上传图片' : '图片待上传')
      return
    }
    const parent = resolveInsertionParent(item.parentSelector)
    if (!parent) return
    const element = document.createElement('div') as HTMLElement
    insertionRecords.set(element, item)
    element.setAttribute('data-editor-insert-id', item.id)
    element.setAttribute('data-editor-insert-kind', item.kind)
    if (item.kind === 'image') {
      const placeholder = !item.src || item.src === '/placeholders/black.svg'
      const isPortfolioCard = parent.classList.contains('portfolio-grid')
      element.className = isPortfolioCard ? 'editor-insert-wrapper' : 'pure-gallery-card'
      const card = document.createElement(isPortfolioCard ? 'article' : 'div') as HTMLElement
      card.className = (isPortfolioCard ? 'work-card glow-surface editor-insert-card' : 'editor-insert-card') + (placeholder ? ' is-placeholder' : '')
      card.addEventListener('click', (event) => {
        if (document.body.classList.contains('editor-preview-edit')) return
        event.preventDefault()
        event.stopPropagation()
        emitInsertionEvent('editor:open-insertion-work', insertionRecords.get(element) || item, parent)
      })
      element.setAttribute('aria-label', '鏂板灏忕獥鍙ｏ紝鐐瑰嚮涓婁紶鍥剧墖')
      const image = document.createElement('img')
      element.setAttribute('aria-label', editorPreview ? '新增小窗口，点击上传图片' : '图片待上传')
      image.setAttribute('data-editor-insert-id', item.id)
      image.setAttribute('data-editor-insert-image', 'true')
      image.setAttribute('src', item.src || '/placeholders/black.svg')
      image.setAttribute('alt', item.alt || '')
      applyStyles(image, item.styles)
      applyStyles(card, { 'aspect-ratio': '16 / 9', ...(item.styles?.['aspect-ratio'] ? { 'aspect-ratio': item.styles['aspect-ratio'] } : {}) })
      if (isPortfolioCard) {
        const open = document.createElement('button')
        open.type = 'button'
        open.className = 'card-open-surface'
        open.setAttribute('aria-label', '查看新增作品大图')
        card.appendChild(open)
      }
      card.appendChild(image)
      if (placeholder) {
        const hint = document.createElement('span')
        hint.className = 'editor-insert-placeholder-hint'
        hint.textContent = '点击上传图片'
        card.appendChild(hint)
        hint.textContent = editorPreview ? '点击上传图片' : '图片待上传'
      }
      if (isPortfolioCard) {
        const ambient = document.createElement('div')
        ambient.className = 'work-card-ambient'
        ambient.setAttribute('aria-hidden', 'true')
        card.appendChild(ambient)
        const meta = document.createElement('div')
        meta.className = 'work-card-topline'
        meta.innerHTML = '<span>新作品</span><span>点击查看大图</span>'
        card.appendChild(meta)
        const content = document.createElement('div')
        content.className = 'work-card-content'
        const copy = document.createElement('div')
        const tags = document.createElement('div')
        tags.className = 'work-tags'
        tags.setAttribute('data-editor-insert-tags', 'true')
        ;(item.tags?.length ? item.tags : ['To edit']).forEach((tag) => {
          const tagElement = document.createElement('span')
          tagElement.textContent = tag
          tags.appendChild(tagElement)
        })
        const title = document.createElement('h3')
        title.setAttribute('data-editor-text-key', `insert-${item.id}-title`)
        title.setAttribute('data-editor-insert-title', 'true')
        title.textContent = item.title || item.alt || 'New work'
        copy.append(tags, title)
        const prompt = document.createElement('button')
        prompt.type = 'button'
        prompt.className = 'prompt-details-button'
        prompt.setAttribute('data-editor-insert-prompt', 'true')
        prompt.textContent = '查看提示词'
        prompt.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (document.body.classList.contains('editor-preview-edit')) return
          emitInsertionEvent('editor:open-insertion-prompt', insertionRecords.get(element) || item, parent)
        })
        content.append(copy, prompt)
        card.appendChild(content)
      }
      element.appendChild(card)
    } else {
      element.textContent = item.value || '新文字'
    }
    if (item.kind !== 'image') applyStyles(element as HTMLElement, item.styles)
    if (item.insertPosition === 'start') parent.prepend(element)
    else parent.appendChild(element)
  })
}

export function EditorRuntime() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/editor') return undefined
    let mounted = true
    const preview = new URLSearchParams(window.location.search).get('editorPreview') === '1'
    const page = location.pathname + (location.hash === '#contact' ? '#contact' : '')
    addBackgroundStyles()
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
        const response = await fetch(preview ? `/api/editor/state?ts=${Date.now()}` : `/editor-content.json?ts=${Date.now()}`, { cache: 'no-store' })
        if (response.ok) currentState = await response.json() as EditorState
      } catch {
        if (preview) {
          try {
            const fallback = await fetch(`/editor-content.json?ts=${Date.now()}`, { cache: 'no-store' })
            if (fallback.ok) currentState = await fallback.json() as EditorState
          } catch { currentState = defaultEditorState }
        } else currentState = defaultEditorState
      }
      if (!mounted) return
      applyCurrentState()
    }

    const observer = new MutationObserver(() => {
      if (!applying) window.requestAnimationFrame(applyCurrentState)
    })
    if (document.body) observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'hidden'],
    })
    void loadAndApply()
    if (!preview) return () => { mounted = false; observer.disconnect() }

    addPreviewStyles()
    document.body.classList.add('editor-preview-mode')
    let previewMode: 'edit' | 'browse' = new URLSearchParams(window.location.search).get('editorMode') === 'browse' ? 'browse' : 'edit'
    document.body.classList.toggle('editor-preview-browse', previewMode === 'browse')
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
      const insertedWrapper = rawTarget?.closest<HTMLElement>('[data-editor-insert-id]')
      const insertedPrompt = rawTarget?.closest('.prompt-details-button')
      if (previewMode === 'browse' && insertedWrapper && insertedPrompt) {
        const insertionId = insertedWrapper.dataset.editorInsertId
        const insertion = currentState.insertions.find((item) => item.id === insertionId)
        if (insertion) {
          event.preventDefault()
          event.stopPropagation()
          emitInsertionEvent('editor:open-insertion-prompt', insertion, insertedWrapper.parentElement ?? document.body)
        }
        return
      }
      const target = findTarget(event.target)
      if (!target) return
      if (previewMode === 'browse') {
        if (target instanceof HTMLImageElement && target.dataset.editorInsertId && target.src) {
          event.preventDefault()
          const insertion = currentState.insertions.find((item) => item.id === target.dataset.editorInsertId)
          const wrapper = target.closest<HTMLElement>('[data-editor-insert-id]')
          if (insertion && wrapper) emitInsertionEvent('editor:open-insertion-work', insertion, wrapper.parentElement ?? document.body)
          return
        }
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
        applyCurrentState()
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
      document.body.classList.remove('editor-page-background-active')
      document.body.classList.remove('editor-preview-mode')
      document.body.classList.remove('editor-preview-browse')
      document.body.classList.remove('editor-preview-edit')
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('message', onMessage)
    }
  }, [location.hash, location.pathname])

  return null
}
