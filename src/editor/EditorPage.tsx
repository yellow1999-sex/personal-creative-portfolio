import { ImagePlus, Layout, Monitor, Save, Send, Settings2, Smartphone, Trash2, Upload, WandSparkles } from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { defaultEditorState, EditorOverride, EditorSelection, EditorState } from './types'
import { workflowModules } from '../workflowConfig'
import './editor.css'

const pages = [
  { path: '/', label: '首页' },
  { path: '/works', label: '场景包预设' },
  { path: '/prompts', label: '提示词库' },
  { path: '/workflow', label: '工作流分享' },
  ...workflowModules.map((module) => ({ path: `/workflow/${module.slug}`, label: `详情：${module.title}` })),
  { path: '/border-glow-demo', label: '交互示例' },
]

const styleFields = [
  ['color', '文字颜色'],
  ['background-color', '背景颜色'],
  ['font-family', '字体'],
  ['font-size', '字号'],
  ['font-weight', '字重'],
  ['line-height', '行高'],
  ['letter-spacing', '字间距'],
  ['margin-top', '上边距'],
  ['margin-bottom', '下边距'],
  ['padding', '内边距'],
  ['width', '宽度'],
  ['height', '高度'],
  ['border-radius', '圆角'],
  ['opacity', '透明度'],
] as const

function copyState(state: EditorState): EditorState {
  return JSON.parse(JSON.stringify(state)) as EditorState
}

function normalizeStyles(styles: EditorOverride['styles']) {
  return Object.fromEntries(
    Object.entries(styles ?? {}).filter(([, value]) => value.trim() !== ''),
  )
}

type ActionStatus = 'idle' | 'running' | 'success' | 'error'

type ActionResult = {
  output?: string
  path?: string
  github?: { status: string; message: string; commit?: string }
  vercel?: { status: string; message: string }
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const data = await response.json() as T & { message?: string; output?: string }
  if (!response.ok) throw new Error(data.message || data.output || '本地编辑器操作失败')
  return data
}

export function EditorPage() {
  const [state, setState] = useState<EditorState>(defaultEditorState)
  const [selection, setSelection] = useState<EditorSelection | null>(null)
  const [form, setForm] = useState<EditorOverride | null>(null)
  const [page, setPage] = useState('/')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [previewMode, setPreviewMode] = useState<'edit' | 'browse'>('edit')
  const [notice, setNotice] = useState('正在连接本地项目…')
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle')

  useEffect(() => {
    void api<EditorState>('/api/editor/state').then((next) => {
      setState({ ...defaultEditorState, ...next })
      setNotice('已连接当前网站项目')
    }).catch(() => setNotice('无法连接本地编辑服务，请重新启动编辑器'))
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'editor:navigate' && typeof event.data.path === 'string') {
        setPage(event.data.path)
        setSelection(null)
        setForm(null)
        setNotice('已进入新的页面或模块')
        return
      }
      if (event.data?.type !== 'editor:select') return
      const next = event.data.selection as EditorSelection
      setSelection(next)
      const saved = state.overrides[next.selector]
      setForm({
        selector: next.selector,
        page: next.page,
        kind: next.kind,
        value: saved?.value ?? next.text,
        src: saved?.src ?? next.src,
        alt: saved?.alt ?? next.alt,
        hidden: saved?.hidden ?? false,
        styles: { ...(saved?.styles ?? {}) },
      })
      setNotice(`已选中${next.kind === 'image' ? '图片' : '文字或组件'}，可以直接修改`)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [state.overrides])

  const currentPage = pages.find((item) => item.path === page) ?? pages[0]
  const frameUrl = useMemo(() => `${page}${page.includes('?') ? '&' : '?'}editorPreview=1`, [page])

  const sendPreviewMode = (mode: 'edit' | 'browse') => {
    setPreviewMode(mode)
    const frame = document.querySelector<HTMLIFrameElement>('.editor-preview-frame')
    frame?.contentWindow?.postMessage({ type: 'editor:mode', mode }, '*')
  }

  const updateForm = (patch: Partial<EditorOverride>) => setForm((current) => current ? { ...current, ...patch } : current)

  const saveState = async (nextState: EditorState, message = '已保存到当前网站项目') => {
    setBusy(true)
    try {
      await api('/api/editor/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextState),
      })
      setState(nextState)
      setNotice(message)
      const frame = document.querySelector<HTMLIFrameElement>('.editor-preview-frame')
      frame?.contentWindow?.postMessage({ type: 'editor:state', state: nextState }, '*')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const saveSelection = () => {
    if (!selection || !form) return
    const next = copyState(state)
    next.overrides[selection.selector] = {
      ...form,
      selector: selection.selector,
      page: selection.page,
      kind: selection.kind,
      styles: normalizeStyles(form.styles),
    }
    void saveState(next)
  }

  const addInsertion = (kind: 'text' | 'image') => {
    const next = copyState(state)
    const id = `insert-${Date.now()}`
    next.insertions.push({
      id,
      page,
      parentSelector: selection?.parentSelector || 'body',
      kind,
      value: kind === 'text' ? '新文字' : undefined,
      src: kind === 'image' ? '/placeholders/black.svg' : undefined,
      alt: kind === 'image' ? '新图片' : undefined,
      styles: { display: 'block', margin: '16px 0', maxWidth: '100%' },
    })
    void saveState(next, kind === 'text' ? '已添加新的文字' : '已添加新的图片')
  }

  const removeSelection = () => {
    if (!selection || !form) return
    const next = copyState(state)
    if (selection.insertionId) next.insertions = next.insertions.filter((item) => item.id !== selection.insertionId)
    else next.overrides[selection.selector] = { ...form, hidden: true }
    setSelection(null)
    setForm(null)
    void saveState(next, '已隐藏/删除选中内容')
  }

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !form || !selection) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await api<{ src: string }>('/api/editor/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data: reader.result }),
        })
        updateForm({ src: result.src })
        setNotice('图片已上传，点击“保存修改”后生效')
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '图片上传失败')
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const runAction = async (endpoint: string, success: string) => {
    setBusy(true)
    setActionStatus('running')
    setLog('正在处理，请稍候…')
    try {
      const result = await api<ActionResult>(endpoint, { method: 'POST' })
      setActionStatus('success')
      if (endpoint === '/api/editor/publish') {
        const githubMessage = result.github?.message || 'GitHub 上传状态待确认'
        const vercelMessage = result.vercel?.message || 'Vercel 自动部署状态待确认'
        setNotice(`${githubMessage}；${vercelMessage}`)
      } else setNotice(success)
      setLog(result.output || result.path || success)
    } catch (error) {
      setActionStatus('error')
      const message = error instanceof Error ? error.message : '操作失败'
      setNotice(endpoint === '/api/editor/publish' ? '发布失败，请查看下方详细结果' : message)
      setLog(message)
    } finally {
      setBusy(false)
    }
  }

  const publish = () => {
    if (!window.confirm('确认将当前网站提交到 GitHub 并触发 Vercel 部署吗？')) return
    void runAction('/api/editor/publish', '已提交 GitHub，Vercel 将自动部署')
  }

  return (
    <div className="visual-editor-shell">
      <header className="visual-editor-topbar">
        <div className="visual-editor-brand"><WandSparkles size={21} /><div><strong>网站可视化编辑器</strong><span className={'editor-notice is-' + actionStatus} aria-live="polite">{notice}</span></div></div>
        <div className="visual-editor-actions">
          <button type="button" onClick={() => void runAction('/api/editor/backup', '已完成完整备份')} disabled={busy}><Save size={16} />一键备份</button>
          <button type="button" onClick={() => void runAction('/api/editor/build', '构建检查通过')} disabled={busy}><Settings2 size={16} />检查网站</button>
          <button className="is-publish" type="button" onClick={publish} disabled={busy}><Send size={16} />发布到线上</button>
        </div>
      </header>

      <div className="visual-editor-body">
        <aside className="visual-editor-sidebar">
          <div className="editor-sidebar-title"><span>网站页面</span><small>点击预览</small></div>
          <nav className="editor-page-list">
            {pages.map((item) => <button type="button" className={item.path === page ? 'is-active' : ''} key={item.path} onClick={() => { setPage(item.path); setPreviewMode('edit'); setSelection(null); setForm(null) }}><span>{item.label}</span><small>{item.path}</small></button>)}
          </nav>
          <div className="editor-add-box">
            <span>向当前页面添加</span>
            <button type="button" onClick={() => addInsertion('text')}><span>文字</span><b>＋</b></button>
            <button type="button" onClick={() => addInsertion('image')}><span>图片</span><b>＋</b></button>
          </div>
          {log ? <pre className="editor-log">{log}</pre> : null}
        </aside>

        <main className="visual-editor-workspace">
          <div className="editor-preview-toolbar">
            <div><strong>{currentPage.label}</strong><span>{previewMode === 'edit' ? '编辑模式：点击文字、图片或组件即可修改' : '浏览模式：点击导航、分类、卡片和详情模块进入'}</span></div>
            <div className="editor-preview-controls">
              <div className="editor-mode-switch"><span className={'editor-mode-status is-' + previewMode}>当前：{previewMode === 'edit' ? '编辑模式' : '浏览模式'}</span><button type="button" onClick={() => sendPreviewMode(previewMode === 'edit' ? 'browse' : 'edit')}>{previewMode === 'edit' ? '进入浏览模式' : '返回编辑模式'}</button></div>
              <div className="editor-device-switch"><button type="button" className={device === 'desktop' ? 'is-active' : ''} onClick={() => setDevice('desktop')}><Monitor size={15} />电脑</button><button type="button" className={device === 'mobile' ? 'is-active' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} />手机</button></div>
            </div>
          </div>
          <div className={'editor-preview-stage is-' + device}>
            <iframe key={frameUrl} className="editor-preview-frame" title="网站实时预览" src={frameUrl} onLoad={(event) => event.currentTarget.contentWindow?.postMessage({ type: 'editor:mode', mode: previewMode }, '*')} />
          </div>
        </main>

        <aside className="visual-editor-inspector">
          {!form ? (
            <div className="editor-empty-inspector"><Layout size={32} /><h2>选择页面内容</h2><p>点击中间预览里的任意文字、图片或组件，就可以在这里修改。</p></div>
          ) : (
            <div className="editor-inspector-content">
              <div className="editor-inspector-heading"><div><span>已选中</span><h2>{form.kind === 'image' ? '图片' : form.kind === 'text' ? '文字' : '组件'}</h2></div><button type="button" onClick={removeSelection} title="删除或隐藏"><Trash2 size={17} /></button></div>
              {form.kind === 'image' ? <>
                <label className="editor-field"><span>图片地址</span><input value={form.src || ''} onChange={(event) => updateForm({ src: event.target.value })} /></label>
                <label className="editor-upload"><Upload size={16} /><span>从电脑选择新图片</span><input type="file" accept="image/*" onChange={uploadImage} /></label>
                <label className="editor-field"><span>图片说明</span><input value={form.alt || ''} onChange={(event) => updateForm({ alt: event.target.value })} /></label>
              </> : null}
              {form.kind !== 'image' ? <label className="editor-field"><span>文字内容</span><textarea rows={5} value={form.value || ''} onChange={(event) => updateForm({ value: event.target.value })} /></label> : null}
              <div className="editor-style-heading"><span>外观和位置</span><small>留空表示保持原样</small></div>
              <div className="editor-style-grid">
                {styleFields.map(([key, label]) => <label className="editor-field" key={key}><span>{label}</span><input value={form.styles?.[key] || ''} placeholder={key === 'opacity' ? '0 - 1' : ''} onChange={(event) => updateForm({ styles: { ...(form.styles || {}), [key]: event.target.value } })} /></label>)}
              </div>
              <label className="editor-check"><input type="checkbox" checked={Boolean(form.hidden)} onChange={(event) => updateForm({ hidden: event.target.checked })} /><span>暂时隐藏此内容</span></label>
              <button className="editor-save-button" type="button" onClick={saveSelection} disabled={busy}><Save size={17} />保存修改</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
