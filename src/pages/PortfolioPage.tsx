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
import { BackgroundVideo } from '../components/BackgroundVideo'

const sections: Array<{ category: WorkCategory; label: string; square?: boolean }> = [
  { category: 'composite', label: '大合成' },
  { category: 'semiFinished', label: '半合成X立绘还原' },
  { category: 'portrait', label: '场照半合成预制菜' },
]

const thankCard: PromptDialogData = {
  id: 'black-thanks-card',
  title: '感谢',
  category: '场景提示词支持',
  summary: '本页场景提示词完全由 BLACK 大独家提供。',
  prompt: '场景提示词完全由black大独家提供',
  meta: 'BLACK 大 / 场景提示词',
  image: '/images/thanks/black-profile.png',
  imageAlt: 'BLACK 大资料图感谢贺卡',
  hideCopyButton: true,
}

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
      <BackgroundVideo
        className="portfolio-video-background"
        desktopSrc="/videos/works-background-web.mp4"
        mobileSrc="/videos/works-background-mobile.mp4"
        poster="/images/works/composite-01.webp"
        editorId="background-video-works"
      />
      <main className="inner-page-shell">
        <header className="inner-page-header">
          <Link className="page-back-link" to="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
          <h1>场景包预设</h1>
        </header>

        {sections.map((section) => (
          <section className="archive-section" key={section.category} data-editor-id={`category-${section.category}`}>
            <div className="archive-section-heading">
              <div>
                <h2 data-editor-id={`category-title-${section.category}`}>{section.label}</h2>
                <span>{String(worksByCategory[section.category].length).padStart(2, '0')}</span>
              </div>
              {section.category === 'portrait' ? (
                <button className="thanks-card" type="button" onClick={() => setSelectedPrompt(thankCard)}>
                  <img src={thankCard.image} alt="BLACK 大感谢贺卡预览" width={640} height={360} />
                  <span>感谢</span>
                  <strong>{thankCard.prompt}</strong>
                </button>
              ) : null}
            </div>
            <div className={'portfolio-grid' + (section.square ? ' is-square' : ' is-wide')} data-editor-gallery-id={section.category}>
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
