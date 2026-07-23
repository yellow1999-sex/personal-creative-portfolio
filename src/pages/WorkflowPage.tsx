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

const spring = { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.72 }

export function WorkflowPage() {
  return (
    <div className="inner-page workflow-page">
      <main className="inner-page-shell">
        <header className="inner-page-header workflow-page-header">
          <Link className="page-back-link" to="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
          <h1>外星人来了都能学会的合成分享，三分钟直接闭眼入门</h1>
        </header>

        <div className="workflow-hub-grid">
          {workflowModules.map((module, index) => (
            <Reveal key={module.slug} delay={index * 0.055}>
              <motion.div whileHover={{ y: -9 }} whileTap={{ scale: 0.987 }} transition={spring}>
                <Link className={'workflow-hub-card glow-surface' + (module.cover.includes('white') ? ' is-light' : '')} to={'/workflow/' + module.slug}>
                  <img src={module.cover} alt={module.title + '封面'} width={1100} height={720} />
                  <div className="workflow-hub-shade" aria-hidden="true" />
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

  return (
    <div className="inner-page workflow-detail-page">
      <main className="inner-page-shell">
        <header className="inner-page-header workflow-detail-header">
          <Link className="page-back-link" to="/workflow" aria-label="返回工作流分享"><ArrowLeft size={18} /></Link>
          <h1>{module.title}</h1>
        </header>

        <div className={'workflow-detail-cover' + (module.cover.includes('white') ? ' is-light' : '')}>
          <img src={module.cover} alt={module.title + '封面'} width={1800} height={800} />
        </div>

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
                <img src={step.image} alt={step.title + '步骤图片'} width={900} height={560} loading="lazy" />
                <div className="workflow-detail-card-copy">
                  <div>
                    <span>{step.id}</span>
                    <h2>{step.title}</h2>
                  </div>
                  <CopyPromptButton
                    id={`workflow-copy-${module.slug}-${step.id}`}
                    prompt={step.prompt}
                    label="复制提示词"
                  />
                </div>
              </motion.article>
            </Reveal>
          ))}
        </div>

        <SiteFooter />
      </main>

      <PromptDialog data={selectedPrompt} onClose={() => setSelectedPrompt(null)} />
    </div>
  )
}
