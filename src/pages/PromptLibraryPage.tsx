import { ArrowLeft, ChevronDown, Search, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CopyPromptButton,
  PromptDialog,
  PromptDialogData,
  SiteFooter,
} from '../components'
import { BackgroundVideo } from '../components/BackgroundVideo'
import {
  getPromptCategory,
  getPromptSubcategory,
  promptLibraryCategories,
  promptLibrarySubcategories,
  PromptLibraryCategoryId,
  promptLibraryItems,
  PromptLibraryItem,
} from '../promptLibraryConfig'

const dialogData = (item: PromptLibraryItem): PromptDialogData => ({
  id: item.id,
  title: item.title,
  category: getPromptCategory(item.category).label + ' / ' + (getPromptSubcategory(item.subCategory)?.label ?? '未分类'),
  prompt: item.prompt,
  meta: item.params,
})

function PromptRow({ item, index, onOpen }: { item: PromptLibraryItem; index: number; onOpen: (item: PromptLibraryItem) => void }) {
  return (
    <article className="prompt-list-row">
      <span className="prompt-list-index">{String(index + 1).padStart(3, '0')}</span>
      <button type="button" className="prompt-list-open" onClick={() => onOpen(item)} aria-label={'查看完整提示词：' + item.title}>
        <span>{getPromptCategory(item.category).label} / {getPromptSubcategory(item.subCategory)?.label ?? '未分类'}</span>
        <h2>{item.title}</h2>
      </button>
      <CopyPromptButton id={'library-' + item.id} prompt={item.prompt} compact label="复制" />
    </article>
  )
}

export function PromptLibraryPage() {
  const [activeCategory, setActiveCategory] = useState<PromptLibraryCategoryId>('all')
  const [openSubcategory, setOpenSubcategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDialogData | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('zh-CN'))

  const availableSubcategories = useMemo(() => promptLibrarySubcategories.filter((subcategory) => (
    activeCategory === 'all' || subcategory.category === activeCategory
  )), [activeCategory])

  const categoryItems = useMemo(() => promptLibraryItems.filter((item) => (
    activeCategory === 'all' || item.category === activeCategory
  )), [activeCategory])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([['all', promptLibraryItems.length]])
    for (const item of promptLibraryItems) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
    return counts
  }, [])

  const itemsBySubcategory = useMemo(() => {
    const groups = new Map<string, PromptLibraryItem[]>()
    for (const item of categoryItems) {
      const group = groups.get(item.subCategory)
      if (group) group.push(item)
      else groups.set(item.subCategory, [item])
    }
    return groups
  }, [categoryItems])

  const searchResults = useMemo(() => {
    if (!deferredQuery) return []
    return categoryItems.filter((item) => [item.title, item.prompt, item.params, ...item.tags]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(deferredQuery))
  }, [categoryItems, deferredQuery])

  return (
    <div className="inner-page prompt-library-page">
      <BackgroundVideo className="prompt-video-background" desktopSrc="/videos/prompts-background-1080p.mp4" mobileSrc="/videos/prompts-background-720p.mp4" />
      <main className="inner-page-shell">
        <header className="inner-page-header prompt-page-header">
          <Link className="page-back-link" to="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
          <h1>提示词库</h1>
        </header>

        <div className="prompt-search-wrap">
          <Search size={19} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索提示词"
            aria-label="搜索提示词"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="清空搜索"><X size={17} /></button>
          ) : null}
        </div>

        <div className="prompt-category-tabs" role="tablist" aria-label="提示词分类">
          {promptLibraryCategories.map((category) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === category.id}
              className={activeCategory === category.id ? 'is-active' : ''}
              onClick={() => {
                setActiveCategory(category.id)
                setOpenSubcategory(null)
              }}
              key={category.id}
            >
              <span>{category.label}</span>
              <small>{String(categoryCounts.get(category.id) ?? 0).padStart(2, '0')}</small>
            </button>
          ))}
        </div>

        {deferredQuery ? (
          <section className="prompt-search-results" aria-label="搜索结果">
            <div className="prompt-results-heading"><h2>搜索结果</h2><span>{searchResults.length}</span></div>
            <div className="prompt-list">
              {searchResults.map((item, index) => <PromptRow item={item} index={index} onOpen={(next) => setSelectedPrompt(dialogData(next))} key={item.id} />)}
            </div>
            {!searchResults.length ? <p className="prompt-empty">没有匹配内容</p> : null}
          </section>
        ) : (
          <div className="prompt-accordion-list" role="tabpanel">
            {availableSubcategories.map((subcategory) => {
              const items = itemsBySubcategory.get(subcategory.id) ?? []
              const isOpen = openSubcategory === subcategory.id
              return (
                <section className={'prompt-accordion' + (isOpen ? ' is-open' : '')} key={subcategory.id}>
                  <button
                    type="button"
                    className="prompt-accordion-trigger"
                    aria-expanded={isOpen}
                    onClick={() => setOpenSubcategory(isOpen ? null : subcategory.id)}
                  >
                    <span><small>{getPromptCategory(subcategory.category).label}</small><strong>{subcategory.label}</strong></span>
                    <em>{items.length}</em>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                  {isOpen ? (
                    <div className="prompt-accordion-content">
                      {items.map((item, index) => <PromptRow item={item} index={index} onOpen={(next) => setSelectedPrompt(dialogData(next))} key={item.id} />)}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
        <SiteFooter />
      </main>
      <PromptDialog data={selectedPrompt} onClose={() => setSelectedPrompt(null)} />
    </div>
  )
}
