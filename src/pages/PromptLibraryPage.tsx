import { ArrowLeft, Search, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CopyPromptButton,
  PromptDialog,
  PromptDialogData,
  Reveal,
  SiteFooter,
  trackPointerGlow,
} from '../components'
import {
  getPromptCategory,
  promptLibraryCategories,
  PromptLibraryCategoryId,
  promptLibraryItems,
  PromptLibraryItem,
} from '../promptLibraryConfig'

const cardSpring = { type: 'spring' as const, stiffness: 315, damping: 25, mass: 0.7 }

const dialogData = (item: PromptLibraryItem): PromptDialogData => ({
  id: item.id,
  title: item.title,
  category: getPromptCategory(item.category).label,
  prompt: item.prompt,
  meta: item.params,
  image: item.image,
  imageAlt: item.title + '效果图',
})

export function PromptLibraryPage() {
  const [activeCategory, setActiveCategory] = useState<PromptLibraryCategoryId>('portrait')
  const [query, setQuery] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDialogData | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('zh-CN'))

  const visibleItems = useMemo(() => promptLibraryItems.filter((item) => {
    if (item.category !== activeCategory) return false
    if (!deferredQuery) return true
    return [item.title, item.prompt, item.params, ...item.tags]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(deferredQuery)
  }), [activeCategory, deferredQuery])

  return (
    <div className="inner-page prompt-library-page">
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
            <motion.button
              type="button"
              role="tab"
              aria-selected={activeCategory === category.id}
              className={activeCategory === category.id ? 'is-active' : ''}
              onClick={() => setActiveCategory(category.id)}
              whileTap={{ scale: 0.94 }}
              transition={cardSpring}
              key={category.id}
            >
              <span>{category.label}</span>
              <small>{String(promptLibraryItems.filter((item) => item.category === category.id).length).padStart(2, '0')}</small>
            </motion.button>
          ))}
        </div>

        <div className="prompt-library-grid" role="tabpanel">
          {visibleItems.map((item, index) => (
            <Reveal key={item.id} delay={(index % 3) * 0.04}>
              <motion.article
                className={'prompt-library-card glow-surface' + (item.image.includes('white') ? ' is-light' : '')}
                onPointerMove={trackPointerGlow}
                whileHover={{ y: -7, rotate: index % 2 ? -0.25 : 0.25 }}
                transition={cardSpring}
              >
                <button
                  className="prompt-card-open"
                  type="button"
                  onClick={() => setSelectedPrompt(dialogData(item))}
                  aria-label={'查看效果图与完整提示词：' + item.title}
                />
                <img src={item.image} alt={item.title + '缩略图'} width={720} height={520} loading="lazy" />
                <div className="prompt-library-card-shade" aria-hidden="true" />
                <span className="prompt-library-card-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="prompt-library-card-copy">
                  <div>
                    <span>{item.tags.join(' / ')}</span>
                    <h2>{item.title}</h2>
                  </div>
                  <CopyPromptButton id={'library-' + item.id} prompt={item.prompt} compact label="复制" />
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>

        {!visibleItems.length ? <p className="prompt-empty">没有匹配内容</p> : null}
        <SiteFooter />
      </main>

      <PromptDialog data={selectedPrompt} onClose={() => setSelectedPrompt(null)} />
    </div>
  )
}
