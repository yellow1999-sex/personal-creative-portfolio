import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(root, 'public')
const statePath = path.join(publicDir, 'editor-content.json')
const settingsPath = path.join(root, '.editor-settings.json')
const backupDir = path.join(root, 'website-backups')
const apiPort = Number.parseInt(process.env.EDITOR_API_PORT || '4399', 10)
const vitePort = Number.parseInt(process.env.EDITOR_VITE_PORT || '5173', 10)
const defaultSettings = {
  githubRepo: '',
  branch: 'main',
  vercelSiteUrl: '',
}

const defaultState = {
  version: 1,
  overrides: {},
  insertions: [],
  pages: [],
}

async function ensureState() {
  try {
    return JSON.parse(await fs.readFile(statePath, 'utf8'))
  } catch {
    await fs.mkdir(publicDir, { recursive: true })
    await fs.writeFile(statePath, JSON.stringify(defaultState, null, 2), 'utf8')
    return defaultState
  }
}

async function readSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(await fs.readFile(settingsPath, 'utf8')) }
  } catch {
    return { ...defaultSettings }
  }
}

function normalizeSiteUrl(value) {
  const text = String(value || '').trim().replace(/\/$/, '')
  if (!text || /vercel\.com\/account\/settings|vercel\.com\/new/i.test(text)) return ''
  return /^https?:\/\//i.test(text) ? text : ''
}

async function writeSettings(next) {
  const settings = {
    githubRepo: String(next.githubRepo || '').trim(),
    branch: String(next.branch || 'main').trim() || 'main',
    vercelSiteUrl: normalizeSiteUrl(next.vercelSiteUrl),
  }
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
  return settings
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 300 * 1024 * 1024) throw new Error('文件超过 300MB，请先压缩后再上传')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function readJson(request) {
  const raw = await readBody(request)
  return raw ? JSON.parse(raw) : {}
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function safeFileName(name) {
  const cleaned = String(name || 'image').replace(/[^a-zA-Z0-9._-]/g, '-')
  return cleaned || 'image'
}

async function copyProjectToBackup() {
  const target = path.join(backupDir, `visual-editor-${timestamp()}`)
  const staging = path.join(path.dirname(root), `.visual-editor-staging-${timestamp()}`)
  try {
    await fs.cp(root, staging, {
      recursive: true,
      filter(source) {
        const relative = path.relative(root, source)
        if (!relative) return true
        const first = relative.split(path.sep)[0]
        return !['node_modules', 'dist', '.git', 'website-backups'].includes(first)
      },
    })
    await fs.mkdir(backupDir, { recursive: true })
    await fs.rename(staging, target)
    return target
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { cwd: root, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }))
      else resolve({ stdout, stderr })
    })
    if (options.input !== undefined) child.stdin.end(options.input)
  })
}

function parseGithubRepo(value) {
  const match = String(value || '').trim().match(/^https?:\/\/github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?\/?$/i)
  if (!match) throw new Error('GitHub 仓库地址格式不正确，请选择 GitHub 仓库')
  return { owner: match[1], repo: match[2] }
}

let githubCredentialCache

async function readGithubCredential() {
  if (githubCredentialCache) return githubCredentialCache
  try {
    const result = await run('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n' })
    const values = Object.fromEntries(result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }))
    githubCredentialCache = { username: values.username || '', token: values.password || '' }
    return githubCredentialCache
  } catch {
    githubCredentialCache = { username: '', token: '' }
    return githubCredentialCache
  }
}

async function githubRequest(pathname, options = {}) {
  const credential = await readGithubCredential()
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'personal-creative-portfolio-editor',
    ...(options.headers || {}),
  }
  if (credential.token) headers.Authorization = `Bearer ${credential.token}`
  const response = await fetch(pathname.startsWith('http') ? pathname : `https://api.github.com${pathname}`, { ...options, headers })
  const raw = await response.text()
  let data
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { message: raw } }
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${data.message || '请求失败'}`)
  return data
}

async function listPublishFiles(directory, relative = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const nextRelative = path.join(relative, entry.name)
    if (entry.isDirectory() && ['node_modules', 'dist', '.git', 'outputs', 'work', 'website-backups', '.vercel'].includes(entry.name)) continue
    if (entry.isDirectory()) files.push(...await listPublishFiles(path.join(directory, entry.name), nextRelative))
    else {
      const normalized = nextRelative.replaceAll(path.sep, '/')
      if (!['.editor-settings.json', 'public/deployment-info.json', '.codex-git-askpass.cmd', 'editor-live.out.log', 'editor-live.err.log'].includes(normalized)) files.push(normalized)
    }
  }
  return files
}

async function githubCommitCurrentFiles(githubRepo, branch, message) {
  const { owner, repo } = parseGithubRepo(githubRepo)
  const ref = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`)
  const parentSha = ref.object.sha
  const parentCommit = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${parentSha}`)
  const allFiles = (await listPublishFiles(root)).sort()
  const skipped = []
  const entries = []
  for (const relative of allFiles) {
    const absolute = path.join(root, relative)
    const stat = await fs.stat(absolute)
    if (stat.size > 8 * 1024 * 1024) {
      skipped.push({ path: relative, bytes: stat.size })
      continue
    }
    const data = await fs.readFile(absolute)
    const blob = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: data.toString('base64'), encoding: 'base64' }),
    })
    entries.push({ path: relative, mode: '100644', type: 'blob', sha: blob.sha })
  }
  const tree = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: entries }),
  })
  const commit = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  })
  const updated = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  })
  return { commit: commit.sha, remoteHead: updated.object.sha, skipped }
}

async function discoverGithubRepositories() {
  const account = await githubRequest('/user')
  const repositories = await githubRequest('/user/repos?per_page=100&sort=updated')
  return {
    account: account.login || '',
    repositories: Array.isArray(repositories) ? repositories.map((item) => ({
      id: item.id,
      name: item.name,
      fullName: item.full_name,
      url: item.html_url,
      cloneUrl: item.clone_url,
      defaultBranch: item.default_branch || 'main',
      private: Boolean(item.private),
      updatedAt: item.updated_at || '',
    })) : [],
  }
}

async function readDeploymentStatuses(deployment) {
  if (!deployment?.statuses_url) return []
  const statuses = await githubRequest(deployment.statuses_url)
  return Array.isArray(statuses) ? statuses : []
}

async function discoverVercelDeployment(githubRepo, commit = '') {
  const { owner, repo } = parseGithubRepo(githubRepo)
  const deployments = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/deployments?per_page=20`)
  if (!Array.isArray(deployments)) return null
  for (const deployment of deployments) {
    if (commit && deployment.sha !== commit) continue
    const statuses = await readDeploymentStatuses(deployment)
    const completed = statuses.find((status) => status.state === 'success' && (status.target_url || status.environment_url))
    if (!completed) continue
    const url = normalizeSiteUrl(completed.target_url || completed.environment_url)
    if (!url) continue
    return {
      url,
      commit: deployment.sha || '',
      state: completed.state,
      message: completed.description || 'Vercel 部署已完成',
      deploymentId: deployment.id,
    }
  }
  return null
}

async function waitForVercelDeployment(githubRepo, commit, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs
  let lastError = ''
  while (Date.now() < deadline) {
    try {
      const deployment = await discoverVercelDeployment(githubRepo, commit)
      if (deployment) return deployment
    } catch (error) {
      lastError = error.message || String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  return { url: '', commit, state: 'pending', message: lastError || 'Vercel 尚未返回完成状态' }
}

function openExternal(url) {
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true })
    child.unref()
    return
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open'
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' })
  child.unref()
}

async function readDeploymentInfo(vercelSiteUrl) {
  if (!vercelSiteUrl) throw new Error('尚未填写 Vercel 网站地址')
  const url = `${vercelSiteUrl}/deployment-info.json?check=${Date.now()}`
  try {
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } })
    if (!response.ok) throw new Error(`线上版本标记返回 HTTP ${response.status}`)
    return await response.json()
  } catch (nodeError) {
    if (process.platform !== 'win32') throw nodeError
    const script = `$response = Invoke-WebRequest -UseBasicParsing -Uri '${url}' -TimeoutSec 20; [Console]::Out.Write($response.Content)`
    const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
    try {
      return JSON.parse(result.stdout)
    } catch {
      throw nodeError
    }
  }
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${vitePort}/editor`)
      if (response.ok) return true
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

async function handleApi(request, response, url) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    })
    response.end()
    return true
  }

  if (url.pathname === '/api/editor/settings' && request.method === 'GET') {
    sendJson(response, 200, await readSettings())
    return true
  }

  if (url.pathname === '/api/editor/settings' && request.method === 'POST') {
    sendJson(response, 200, { ok: true, settings: await writeSettings(await readJson(request)) })
    return true
  }

  if (url.pathname === '/api/editor/github-repositories' && request.method === 'GET') {
    try {
      const result = await discoverGithubRepositories()
      const settings = await readSettings()
      const remote = (await run('git', ['remote', 'get-url', 'origin']).catch(() => ({ stdout: '' }))).stdout.trim().replace(/^https?:\/\/[^@]+@/i, 'https://').replace(/\.git$/, '')
      const selected = settings.githubRepo || remote
      const selectedRepo = result.repositories.find((item) => item.url.replace(/\/$/, '') === selected.replace(/\/$/, ''))
      const nextSettings = selectedRepo && !settings.githubRepo
        ? await writeSettings({ ...settings, githubRepo: selectedRepo.cloneUrl || selectedRepo.url, branch: selectedRepo.defaultBranch })
        : settings
      sendJson(response, 200, { ok: true, account: result.account, repositories: result.repositories, selected: selectedRepo?.url || nextSettings.githubRepo, settings: nextSettings })
    } catch (error) {
      sendJson(response, 401, { ok: false, message: error.message || '无法读取 GitHub 仓库，请先完成官方登录' })
    }
    return true
  }

  if (url.pathname === '/api/editor/vercel-projects' && request.method === 'GET') {
    try {
      const settings = await readSettings()
      if (!settings.githubRepo) throw new Error('请先选择 GitHub 仓库')
      const deployment = await discoverVercelDeployment(settings.githubRepo)
      const nextSettings = deployment?.url
        ? await writeSettings({ ...settings, vercelSiteUrl: deployment.url })
        : settings
      sendJson(response, 200, {
        ok: true,
        projects: deployment ? [{ name: new URL(deployment.url).hostname.split('.')[0], url: deployment.url, commit: deployment.commit, status: deployment.state, source: 'GitHub 部署记录' }] : [],
        settings: nextSettings,
      })
    } catch (error) {
      sendJson(response, 502, { ok: false, message: error.message || '无法读取 Vercel 部署地址' })
    }
    return true
  }

  if (url.pathname === '/api/editor/connect-github' && request.method === 'POST') {
    try {
      const settings = await writeSettings(await readJson(request))
      if (!settings.githubRepo) throw new Error('请先填写 GitHub 仓库地址')
      try { await run('git', ['rev-parse', '--git-dir']) } catch { await run('git', ['init']) }
      await run('git', ['branch', '-M', settings.branch])
      try { await run('git', ['remote', 'set-url', 'origin', settings.githubRepo]) }
      catch { await run('git', ['remote', 'add', 'origin', settings.githubRepo]) }
      const remote = await run('git', ['remote', '-v'])
      sendJson(response, 200, { ok: true, output: remote.stdout, settings })
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.stderr || error.message })
    }
    return true
  }

  if (url.pathname === '/api/editor/auth-status' && request.method === 'GET') {
    const settings = await readSettings()
    let githubLoggedIn = false
    let githubAccount = ''
    try {
      const accounts = await run('git', ['credential-manager', 'github', 'list'])
      githubAccount = accounts.stdout.trim().split(/\r?\n/).filter(Boolean)[0] || ''
      githubLoggedIn = Boolean(githubAccount)
    } catch {
      githubLoggedIn = false
    }
    sendJson(response, 200, {
      ok: true,
      github: { loggedIn: githubLoggedIn, account: githubAccount, connected: Boolean(settings.githubRepo) },
      vercel: { connected: Boolean(settings.vercelSiteUrl), url: settings.vercelSiteUrl },
    })
    return true
  }

  if (url.pathname === '/api/editor/login-github' && request.method === 'POST') {
    try {
      await run('git', ['config', '--global', 'credential.helper', 'manager'])
      const child = spawn('git', ['credential-manager', 'github', 'login'], { detached: true, stdio: 'ignore', windowsHide: false })
      child.unref()
      sendJson(response, 200, { ok: true, message: 'GitHub 官方登录窗口已打开。完成一次登录后，系统会记住授权。' })
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.stderr || error.message })
    }
    return true
  }

  if (url.pathname === '/api/editor/open-vercel' && request.method === 'POST') {
    try {
      const settings = await readSettings()
      if (!settings.githubRepo) throw new Error('请先选择 GitHub 仓库')
      const deployment = await discoverVercelDeployment(settings.githubRepo)
      if (!deployment?.url) {
        openExternal('https://vercel.com/new')
        throw new Error('尚未找到这个仓库的 Vercel 部署。已打开 Vercel 官方页面，请先导入该 GitHub 仓库并部署一次，然后再点击“连接 Vercel”。')
      }
      const nextSettings = await writeSettings({ ...settings, vercelSiteUrl: deployment.url })
      sendJson(response, 200, { ok: true, message: '已从 GitHub 部署记录读取真实 Vercel 网站地址', settings: nextSettings, vercel: deployment })
    } catch (error) {
      sendJson(response, 409, { ok: false, message: error.message || '无法连接 Vercel' })
    }
    return true
  }

  if (url.pathname === '/api/editor/open-vercel-legacy' && request.method === 'POST') {
    openExternal('https://vercel.com/new')
    sendJson(response, 200, { ok: true, message: 'Vercel 官方导入页面已打开。请选择 GitHub 仓库并部署一次。' })
    return true
  }

  if (url.pathname === '/api/editor/state' && request.method === 'GET') {
    sendJson(response, 200, await ensureState())
    return true
  }

  if (url.pathname === '/api/editor/state' && request.method === 'POST') {
    const next = await readJson(request)
    const state = {
      version: 1,
      overrides: next.overrides ?? {},
      insertions: Array.isArray(next.insertions) ? next.insertions : [],
      pages: Array.isArray(next.pages) ? next.pages : [],
    }
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8')
    sendJson(response, 200, { ok: true, state })
    return true
  }

  if (url.pathname === '/api/editor/upload' && request.method === 'POST') {
    const body = await readJson(request)
    const match = String(body.data || '').match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      sendJson(response, 400, { ok: false, message: '图片数据格式不正确' })
      return true
    }
    const mime = match[1]
    const sourceBuffer = Buffer.from(match[2], 'base64')
    const extension = (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').replace('mpeg', 'mp3')
    const requested = safeFileName(body.name || `uploaded-${Date.now()}.${extension}`)
    const sourceBaseName = path.parse(requested).name || `uploaded-${Date.now()}`
    const fileName = mime.startsWith('image/') ? `${sourceBaseName}.webp` : requested.includes('.') ? requested : `${requested}.${extension}`
    const mediaFolder = mime.startsWith('video/') ? 'videos' : mime.startsWith('audio/') ? 'audio' : 'images'
    const relativeDir = path.join(mediaFolder, 'editor')
    const targetDir = path.join(publicDir, relativeDir)
    await fs.mkdir(targetDir, { recursive: true })
    let outputBuffer = sourceBuffer
    let width
    let height
    if (mime.startsWith('image/')) {
      const optimized = sharp(sourceBuffer, { animated: true }).rotate().resize({
        width: 2560,
        height: 2560,
        fit: 'inside',
        withoutEnlargement: true,
      }).webp({ quality: 86, effort: 5, smartSubsample: true })
      outputBuffer = await optimized.toBuffer()
      const metadata = await sharp(outputBuffer).metadata()
      width = metadata.width
      height = metadata.height
    }
    await fs.writeFile(path.join(targetDir, fileName), outputBuffer)
    sendJson(response, 200, {
      ok: true,
      src: `/${relativeDir.replaceAll(path.sep, '/')}/${fileName}`,
      format: mime.startsWith('image/') ? 'webp' : extension,
      originalBytes: sourceBuffer.length,
      optimizedBytes: outputBuffer.length,
      width,
      height,
    })
    return true
  }

  if (url.pathname === '/api/editor/backup' && request.method === 'POST') {
    const target = await copyProjectToBackup()
    sendJson(response, 200, { ok: true, path: target })
    return true
  }

  if (url.pathname === '/api/editor/build' && request.method === 'POST') {
    try {
      const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm'
      const args = process.platform === 'win32'
        ? ['/d', '/s', '/c', 'npm.cmd run build']
        : ['run', 'build']
      const result = await run(command, args)
      sendJson(response, 200, { ok: true, output: `${result.stdout}\n${result.stderr}` })
    } catch (error) {
      sendJson(response, 500, { ok: false, output: `${error.stdout || ''}\n${error.stderr || error.message}` })
    }
    return true
  }

  if (url.pathname === '/api/editor/project' && request.method === 'GET') {
    try {
      const status = await run('git', ['status', '--short', '--branch'])
      const settings = await readSettings()
      sendJson(response, 200, { ok: true, status: status.stdout, settings })
    } catch (error) {
      sendJson(response, 200, { ok: true, status: '尚未连接 GitHub 仓库', settings: await readSettings() })
    }
    return true
  }

  if (url.pathname === '/api/editor/deployment-status' && request.method === 'GET') {
    const commit = url.searchParams.get('commit') || ''
    if (!commit) {
      sendJson(response, 400, { ok: false, message: '缺少要检查的提交编号' })
      return true
    }
    try {
      const settings = await readSettings()
      if (!settings.githubRepo) throw new Error('尚未选择 GitHub 仓库')
      const deployed = await discoverVercelDeployment(settings.githubRepo, commit)
      const nextSettings = deployed?.url ? await writeSettings({ ...settings, vercelSiteUrl: deployed.url }) : settings
      sendJson(response, 200, {
        ok: true,
        status: deployed ? 'success' : 'pending',
        message: deployed ? 'Vercel 已完成部署，线上提交号一致' : 'Vercel 正在部署，尚未返回相同提交号',
        commit,
        deployedCommit: deployed?.commit || '',
        url: deployed?.url || nextSettings.vercelSiteUrl,
      })
    } catch (error) {
      sendJson(response, 200, { ok: true, status: 'pending', message: '暂时无法读取 Vercel 部署状态', commit, url: (await readSettings()).vercelSiteUrl, detail: error.message })
    }
    return true
  }

  if (url.pathname === '/api/editor/deployment-status-legacy' && request.method === 'GET') {
    const commit = url.searchParams.get('commit') || ''
    if (!commit) {
      sendJson(response, 400, { ok: false, message: '缺少要检查的提交编号' })
      return true
    }
    try {
      const settings = await readSettings()
      const deployed = await readDeploymentInfo(settings.vercelSiteUrl)
      const matched = deployed.commit === commit
      sendJson(response, 200, {
        ok: true,
        status: matched ? 'success' : 'pending',
        message: matched ? 'Vercel 已部署完成' : 'Vercel 正在部署，线上版本尚未切换',
        commit,
        deployedCommit: deployed.commit || '',
        url: settings.vercelSiteUrl,
      })
    } catch (error) {
      sendJson(response, 200, {
        ok: true,
        status: 'pending',
        message: 'Vercel 已触发部署，暂时无法读取线上版本标记',
        commit,
        url: (await readSettings()).vercelSiteUrl,
        detail: error.message,
      })
    }
    return true
  }

  if (url.pathname === '/api/editor/publish' && request.method === 'POST') {
    try {
      let settings = await readSettings()
      if (!settings.githubRepo) {
        const remote = (await run('git', ['remote', 'get-url', 'origin']).catch(() => ({ stdout: '' }))).stdout.trim()
        if (remote) settings = await writeSettings({ ...settings, githubRepo: remote })
      }
      if (!settings.githubRepo) throw new Error('尚未选择 GitHub 仓库，请先打开发布中心完成连接')
      const buildCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm'
      const buildArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build'] : ['run', 'build']
      await run(buildCommand, buildArgs)
      const uploaded = await githubCommitCurrentFiles(settings.githubRepo, settings.branch, 'Update website from visual editor')
      const deployment = await waitForVercelDeployment(settings.githubRepo, uploaded.commit)
      if (deployment.url) settings = await writeSettings({ ...settings, vercelSiteUrl: deployment.url })
      const skippedMessage = uploaded.skipped.length ? `；大于 8MB 的文件未通过 GitHub API 重传：${uploaded.skipped.map((item) => item.path).join('、')}，如这些文件已经存在于仓库则线上仍可正常使用` : ''
      sendJson(response, 200, {
        ok: true,
        output: `GitHub 远端提交号已核对：${uploaded.remoteHead}${skippedMessage}`,
        github: { status: 'success', message: `GitHub 上传成功，远端提交号已核对${skippedMessage}`, commit: uploaded.commit, remoteHead: uploaded.remoteHead },
        vercel: { status: deployment.state === 'success' ? 'success' : 'pending', message: deployment.message, commit: uploaded.commit, url: deployment.url || settings.vercelSiteUrl },
        settings,
      })
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || '发布失败', output: `${error.stdout || ''}\n${error.stderr || error.message || ''}` })
    }
    return true
  }

  if (url.pathname === '/api/editor/publish-git-legacy' && request.method === 'POST') {
    try {
      let settings = await readSettings()
      if (!settings.githubRepo) {
        const remote = (await run('git', ['remote', 'get-url', 'origin'])).stdout.trim()
        if (remote) settings = await writeSettings({ ...settings, githubRepo: remote })
      }
      if (!settings.githubRepo) throw new Error('尚未选择 GitHub 仓库，请先打开发布中心完成连接')
      const buildCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm'
      const buildArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build'] : ['run', 'build']
      await run(buildCommand, buildArgs)
      await run('git', ['add', '-A'])
      let commitOutput = ''
      try {
        const commit = await run('git', ['commit', '-m', 'Update website from visual editor'])
        commitOutput = commit.stdout
      } catch (error) {
        if (!String(error.stdout || '').includes('nothing to commit') && !String(error.stderr || '').includes('nothing to commit')) throw error
        commitOutput = '没有新的文件需要提交。'
      }
      const commitSha = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
      const push = await run('git', ['push', '-u', 'origin', settings.branch])
      const remoteHead = (await run('git', ['ls-remote', 'origin', `refs/heads/${settings.branch}`])).stdout.trim().split(/\s+/)[0]
      if (remoteHead !== commitSha) throw new Error(`GitHub 上传校验失败：远端提交号 ${remoteHead || '空'} 与本地 ${commitSha} 不一致`)
      const deployment = await waitForVercelDeployment(settings.githubRepo, commitSha)
      if (deployment.url) settings = await writeSettings({ ...settings, vercelSiteUrl: deployment.url })
      sendJson(response, 200, {
        ok: true,
        output: `${commitOutput}\n${push.stdout}\nGitHub 远端提交号已核对：${remoteHead}`,
        github: { status: 'success', message: 'GitHub 上传成功，远端提交号已核对', commit: commitSha, remoteHead },
        vercel: { status: deployment.state === 'success' ? 'success' : 'pending', message: deployment.message, commit: commitSha, url: deployment.url || settings.vercelSiteUrl },
        settings,
      })
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || '发布失败', output: `${error.stdout || ''}\n${error.stderr || error.message || ''}` })
    }
    return true
  }

  if (url.pathname === '/api/editor/publish-legacy' && request.method === 'POST') {
    try {
      const settings = await readSettings()
      if (!settings.githubRepo) throw new Error('尚未连接 GitHub 仓库，请先完成首次设置')
      const buildCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm'
      const buildArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build'] : ['run', 'build']
      await run(buildCommand, buildArgs)
      await run('git', ['add', '-A'])
      let commitOutput = ''
      try {
        const commit = await run('git', ['commit', '-m', 'Update website from visual editor'])
        commitOutput = commit.stdout
      } catch (error) {
        if (!String(error.stdout || '').includes('nothing to commit') && !String(error.stderr || '').includes('nothing to commit')) throw error
        commitOutput = '没有新的文件需要提交。'
      }
      const commitSha = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
      const push = await run('git', ['push', '-u', 'origin', settings.branch])
      sendJson(response, 200, {
        ok: true,
        output: `${commitOutput}\n${push.stdout}\nVercel 将根据 GitHub 更新自动部署。`,
        github: { status: 'success', message: 'GitHub 上传成功', commit: commitSha },
        vercel: { status: 'triggered', message: 'GitHub 已更新；如果 Vercel 已绑定该仓库，将自动开始部署', commit: commitSha, url: settings.vercelSiteUrl },
      })
    } catch (error) {
      sendJson(response, 500, { ok: false, output: `${error.stdout || ''}\n${error.stderr || error.message}` })
    }
    return true
  }

  return false
}

const apiServer = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
    const handled = await handleApi(request, response, url)
    if (!handled) sendJson(response, 404, { ok: false, message: '没有找到本地编辑器接口' })
  } catch (error) {
    sendJson(response, 500, { ok: false, message: error.message || '本地编辑器发生错误' })
  }
})

await ensureState()
apiServer.listen(apiPort, '127.0.0.1', () => {
  const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(vitePort)], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  })

  const openPromise = waitForPreview().then((ready) => {
    if (!ready || process.platform !== 'win32') return
    const opener = spawn('cmd.exe', ['/c', 'start', '', `http://127.0.0.1:${vitePort}/editor`], { detached: true, stdio: 'ignore', windowsHide: true })
    opener.unref()
  })

  const stop = () => {
    void openPromise
    vite.kill()
    apiServer.close(() => process.exit(0))
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  vite.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code
  })
})
