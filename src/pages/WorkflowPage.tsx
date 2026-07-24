import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  CopyPromptButton,
  PromptDialog,
  PromptDialogData,
  Reveal,
  SiteFooter,
  trackPointerGlow,
} from '../components'
import { getWorkflowModule, workflowModules } from '../workflowConfig'
import { BackgroundVideo } from '../components/BackgroundVideo'

const spring = { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.72 }

function WorkflowVideoBackground() {
  return <BackgroundVideo className="workflow-video-background" desktopSrc="/videos/workflow-background-1080p.mp4" mobileSrc="/videos/workflow-background-720p.mp4" />
}

const workflowThanksCards = [
  {
    image: '/images/thanks/open-source-huihui.png',
    text: '感谢开源工作者小T',
    alt: '感谢开源工作者小T',
  },
  {
    image: '/images/thanks/open-source-xiaot.png',
    text: '感谢开源工作者惠惠',
    alt: '感谢开源工作者惠惠',
  },
]

export function WorkflowPage() {
  return (
    <div className="inner-page workflow-page">
      <WorkflowVideoBackground />
      <main className="inner-page-shell">
        <header className="inner-page-header workflow-page-header">
          <Link className="page-back-link" to="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
          <h1>外星人来了都能学会的合成分享，三分钟直接闭眼入门</h1>
        </header>

        <div className="workflow-hub-grid">
          {workflowModules.map((module, index) => (
            <Reveal key={module.slug} delay={index * 0.055}>
              <motion.div whileHover={{ y: -9 }} whileTap={{ scale: 0.987 }} transition={spring}>
                <Link className="workflow-hub-card glow-surface" to={'/workflow/' + module.slug}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h2>{module.title}</h2>
                  <i><ArrowUpRight size={20} /></i>
                </Link>
              </motion.div>
            </Reveal>
          ))}
        </div>

        <SiteFooter />
      </main>
    </div>
  )
}

export function WorkflowDetailPage() {
  const { slug } = useParams()
  const module = getWorkflowModule(slug)
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDialogData | null>(null)
  if (!module) return <Navigate to="/workflow" replace />
  const isComfyUi = module.slug === 'semi-composite'

  return (
    <div className={'inner-page workflow-detail-page' + (isComfyUi ? ' is-comfyui' : '')}>
      <WorkflowVideoBackground />
      <main className="inner-page-shell">
        <header className="inner-page-header workflow-detail-header">
          <Link className="page-back-link" to="/workflow" aria-label="返回工作流分享"><ArrowLeft size={18} /></Link>
          <h1>{module.title}</h1>
        </header>

        {!isComfyUi ? <div className={'workflow-detail-cover' + (module.cover.includes('white') ? ' is-light' : '')}>
          <img src={module.cover} alt={module.title + '封面'} width={1800} height={800} decoding="async" />
        </div> : null}

        <div className="workflow-detail-grid">
          {module.steps.map((step, index) => (
            <Reveal key={step.id} delay={(index % 2) * 0.045}>
              <motion.article
                className={'workflow-detail-card glow-surface' + (step.image.includes('white') ? ' is-light' : '')}
                onPointerMove={trackPointerGlow}
                whileHover={{ y: -6, scale: 1.006 }}
                transition={spring}
              >
                <button
                  className="workflow-detail-card-open"
                  type="button"
                  onClick={() => setSelectedPrompt({
                    id: `workflow-${module.slug}-${step.id}`,
                    title: step.title,
                    category: module.title,
                    summary: step.summary,
                    prompt: step.prompt,
                    image: step.image,
                    imageAlt: `${module.title} / ${step.title}效果图`,
                  })}
                  aria-label={`查看${step.title}效果图与详情`}
                />
                <img src={step.image} alt={step.title + '步骤图片'} width={900} height={560} loading="lazy" decoding="async" />
                <div className="workflow-detail-card-copy">
                  <div>
                    <span>{step.id}</span>
                    <h2>{step.title}</h2>
                  </div>
                  <CopyPromptButton
                    id={`workflow-copy-${module.slug}-${step.id}`}
                    prompt={step.prompt}
                    label="复制完整工作流代码到插件添加"
                  />
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>

        {isComfyUi ? (
          <section className="workflow-thanks-section" aria-label="开源工作流致谢">
            <div className="workflow-thanks-panel">
              {workflowThanksCards.map((card) => (
                <motion.button
                  className="workflow-thanks-card glow-surface"
                  type="button"
                  key={card.image}
                  onClick={() => setSelectedPrompt({
                    id: `workflow-thanks-${card.image}`,
                    title: card.text,
                    category: '开源工作流致谢',
                    prompt: card.text,
                    meta: '点击关闭大图',
                    image: card.image,
                    imageAlt: card.alt,
                    hideCopyButton: true,
                  })}
                  aria-label={`查看${card.text}大图`}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                  transition={spring}
                >
                  <img src={card.image} alt={card.alt} width={872} height={512} loading="lazy" decoding="async" />
                  <span>{card.text}</span>
                </motion.button>
              ))}
            </div>
          </section>
        ) : null}

        <SiteFooter />
      </main>

      <PromptDialog data={selectedPrompt} onClose={() => setSelectedPrompt(null)} />
    </div>
  )
}
