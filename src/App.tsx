import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FloatingNav } from './components'
import { HomePage } from './HomePage'
import { CursorTrail } from './components/CursorTrail'
import { SiteParallax } from './components/SiteParallax'

const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then((module) => ({ default: module.PortfolioPage })))
const PromptLibraryPage = lazy(() => import('./pages/PromptLibraryPage').then((module) => ({ default: module.PromptLibraryPage })))
const WorkflowPage = lazy(() => import('./pages/WorkflowPage').then((module) => ({ default: module.WorkflowPage })))
const WorkflowDetailPage = lazy(() => import('./pages/WorkflowPage').then((module) => ({ default: module.WorkflowDetailPage })))
const BorderGlowDemo = lazy(() => import('./pages/BorderGlowDemo').then((module) => ({ default: module.BorderGlowDemo })))

const pageTitles: Record<string, string> = {
  '/': '酸奶奶奶奶奶 · 个人视觉作品集',
  '/works': '完整作品 · 酸奶奶奶奶奶',
  '/prompts': '提示词库 · 酸奶奶奶奶奶',
  '/workflow': '工作流分享 · 酸奶奶奶奶奶',
}

function RoutedApp() {
  const location = useLocation()
  const reduced = useReducedMotion()

  useEffect(() => {
    document.title = pageTitles[location.pathname] ?? '工作流分享 · 酸奶奶奶奶奶'
    const timer = window.setTimeout(() => {
      // The home page uses horizontal scenes, so its hash is a scene command rather than a DOM anchor.
      if (location.pathname !== '/') window.scrollTo({ top: 0, behavior: 'auto' })
    }, reduced ? 0 : 180)
    return () => window.clearTimeout(timer)
  }, [location.hash, location.pathname, reduced])

  return (
    <>
      <CursorTrail />
      <SiteParallax />
      <FloatingNav />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="route-transition"
          key={location.pathname}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduced ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={null}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/works" element={<PortfolioPage />} />
              <Route path="/prompts" element={<PromptLibraryPage />} />
              <Route path="/workflow" element={<WorkflowPage />} />
              <Route path="/workflow/:slug" element={<WorkflowDetailPage />} />
              <Route path="/border-glow-demo" element={<BorderGlowDemo />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

export function App() {
  return <BrowserRouter><RoutedApp /></BrowserRouter>
}
