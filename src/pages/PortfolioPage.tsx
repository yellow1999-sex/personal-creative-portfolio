import { ArrowLeft } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PromptDialog,
  PromptDialogData,
  Reveal,
  SiteFooter,
  WorkCard,
  WorkLightbox,
} from '../components'
import { siteConfig, WorkCategory, WorkItem, worksByCategory } from '../config'

const sections: Array<{ category: WorkCategory; label: string; square?: boolean }> = [
  { category: 'composite', label: '大合成' },
  { category: 'semiFinished', label: '半合成X立绘还原' },
  { category: 'portrait', label: '人像人脸', square: true },
]

const promptFromWork = (work: WorkItem): PromptDialogData => ({
  id: work.id,
  title: work.title,
  category: siteConfig.workCategories[work.category].label,
  prompt: work.prompt,
  meta: work.tags.join(' / '),
})

export function PortfolioPage() {
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null)
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDialogData | null>(null)

  const openWork = useCallback((work: WorkItem) => {
    setSelectedPrompt(null)
    setSelectedWork(work)
  }, [])

  const openPrompt = useCallback((work: WorkItem) => {
    setSelectedWork(null)
    setSelectedPrompt(promptFromWork(work))
  }, [])

  return (
    <div className="inner-page portfolio-page">
      <main className="inner-page-shell">
        <header className="inner-page-header">
          <Link className="page-back-link" to="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
          <h1>完整作品</h1>
        </header>

        {sections.map((section) => (
          <section className="archive-section" key={section.category}>
            <div className="archive-section-heading">
              <h2>{section.label}</h2>
              <span>{String(worksByCategory[section.category].length).padStart(2, '0')}</span>
            </div>
            <div className={'portfolio-grid' + (section.square ? ' is-square' : ' is-wide')}>
              {worksByCategory[section.category].map((work, index) => (
                <Reveal key={work.id} delay={(index % 3) * 0.035}>
                  <WorkCard
                    work={work}
                    ratio={section.square ? 'square' : 'ultrawide'}
                    onOpenWork={openWork}
                    onOpenPrompt={openPrompt}
                  />
                </Reveal>
              ))}
            </div>
          </section>
        ))}

        <SiteFooter />
      </main>

      <WorkLightbox work={selectedWork} onClose={() => setSelectedWork(null)} onOpenPrompt={openPrompt} />
      <PromptDialog data={selectedPrompt} onClose={() => setSelectedPrompt(null)} />
    </div>
  )
}
