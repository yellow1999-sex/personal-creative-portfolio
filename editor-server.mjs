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
const shouldOpenBrowser = process.env.EDITOR_OPEN_BROWSER !== '0'
const gitCommand = process.env.EDITOR_GIT_PATH || 'git'
// Keep the original aspect ratio, preserve source pixels up to 4K, and never upscale.
const maximumImageDimension = 4096
const defaultSettings = {
  githubRepo: '',
  branch: 'main',
  vercelSiteUrl: '',
}

const defaultState = {
  version: 1,
  overrides: {},
  insertions: [],
  removedCards: {},
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

async function writeSettings(next) {
  const settings = {
    githubRepo: String(next.githubRepo || '').trim(),
    branch: String(next.branch || 'main').trim() || 'main',
    vercelSiteUrl: String(next.vercelSiteUrl || '').trim().replace(/\/$/, ''),
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

function run(command, args) {
  return new Promise((resolve, reject) => {
    const executable = command === 'git' ? gitCommand : command
    execFile(executable, args, { cwd: root, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }))
      else resolve({ stdout, stderr })
    })
  })
}

function runWithInput(command, args, input) {
  return new Promise((resolve, reject) => {
    const executable = command === 'git' ? gitCommand : command
    const child = spawn(executable, args, {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code) reject(Object.assign(new Error(stderr || `Command exited with code ${code}`), { stdout, stderr }))
      else resolve({ stdout, stderr })
    })
    child.stdin.end(input)
  })
}

async function detectGithubAccount() {
  try {
    const accounts = await run('git', ['credential-manager', 'github', 'list'])
    return accounts.stdout.trim().split(/\r?\n/).map((item) => item.trim()).filter(Boolean)[0] || ''
  } catch {
    return ''
  }
}

function githubOwnerFromRepo(repo) {
  const match = String(repo || '').match(/github\.com[/:]([^/]+)\//i)
  return match?.[1] || ''
}

async function localGitRemote() {
  try {
    return (await run('git', ['remote', 'get-url', 'origin'])).stdout.trim()
  } catch {
    return ''
  }
}

async function localGitBranch(fallback = 'main') {
  try {
    return (await run('git', ['branch', '--show-current'])).stdout.trim() || fallback
  } catch {
    return fallback
  }
}

async function resolveSettingsRepository(settings) {
  const remote = await localGitRemote()
  const githubRepo = settings.githubRepo || remote
  const branch = await localGitBranch(settings.branch || 'main')
  if (githubRepo !== settings.githubRepo || branch !== settings.branch) {
    return writeSettings({ ...settings, githubRepo, branch })
  }
  return settings
}

async function ensureGitIdentity(settings) {
  const account = await detectGithubAccount()
  const owner = githubOwnerFromRepo(settings.githubRepo)
  const username = account || owner || 'website-editor'
  const email = `${username}@users.noreply.github.com`
  await run('git', ['config', '--local', 'user.name', username])
  await run('git', ['config', '--local', 'user.email', email])
  return { username, email }
}

function repositoryFromUrl(repoUrl) {
  const clean = String(repoUrl || '').replace(/\.git$/, '').replace(/\/$/, '')
  const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i)
  if (!match) return null
  return {
    id: `current:${match[1]}/${match[2]}`,
    name: match[2],
    fullName: `${match[1]}/${match[2]}`,
    url: `https://github.com/${match[1]}/${match[2]}`,
    cloneUrl: `https://github.com/${match[1]}/${match[2]}.git`,
    defaultBranch: 'main',
    private: false,
    updatedAt: '',
  }
}

async function readGithubRepositories(settings) {
  const owner = githubOwnerFromRepo(settings.githubRepo) || await detectGithubAccount()
  const current = repositoryFromUrl(settings.githubRepo)
  if (!owner) return current ? [current] : []

  try {
    const credential = await readGithubCredential()
    const repositories = credential?.password
      ? await githubApiRequest(`/user/repos?per_page=100&sort=updated`, credential)
      : await githubApiRequest(`/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated`)
    const mapped = Array.isArray(repositories) ? repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch || 'main',
      private: Boolean(repo.private),
      updatedAt: repo.updated_at || '',
    })) : []
    if (current && !mapped.some((repo) => repo.cloneUrl === settings.githubRepo || repo.url === settings.githubRepo)) mapped.unshift(current)
    return mapped
  } catch {
    return current ? [current] : []
  }
}

async function readGithubCredential() {
  try {
    const result = await runWithInput('git', ['credential', 'fill'], 'protocol=https\nhost=github.com\n\n')
    const credential = {}
    for (const line of result.stdout.split(/\r?\n/)) {
      const separator = line.indexOf('=')
      if (separator > 0) credential[line.slice(0, separator)] = line.slice(separator + 1)
    }
    return credential
  } catch {
    return null
  }
}

async function githubApiRequest(apiPath, credential, options = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'website-visual-editor',
    ...(options.headers || {}),
  }
  if (credential?.password) headers.Authorization = `Bearer ${credential.password}`
  const response = await fetch(`https://api.github.com${apiPath}`, { ...options, headers })
  const raw = await response.text()
  let payload
  try { payload = raw ? JSON.parse(raw) : {} } catch { payload = { message: raw } }
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}: ${payload.message || '请求失败'}`)
  return payload
}

function githubRepositoryCoordinates(repo) {
  const match = String(repo || '').match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
  if (!match) throw new Error('GitHub 仓库地址格式无法识别')
  return { owner: match[1], name: match[2] }
}

function parseGitTree(raw) {
  return raw.split('\0').filter(Boolean).map((entry) => {
    const separator = entry.indexOf('\t')
    const [mode, type, sha] = entry.slice(0, separator).split(' ')
    return { path: entry.slice(separator + 1), mode, type, sha }
  }).filter((entry) => entry.type === 'blob')
}

async function isProjectAssetReferenced(relativePath) {
  const normalized = relativePath.replaceAll(path.sep, '/')
  const publicUrl = normalized.startsWith('public/') ? `/${normalized.slice('public/'.length)}` : normalized
  const fileName = path.basename(normalized)
  try {
    const result = await run('rg', ['-l', '--fixed-strings', publicUrl, 'src', 'public', 'index.html', 'vercel.json'])
    return Boolean(result.stdout.trim())
  } catch {
    try {
      const result = await run('rg', ['-l', '--fixed-strings', fileName, 'src', 'public', 'index.html', 'vercel.json'])
      return Boolean(result.stdout.trim())
    } catch {
      return false
    }
  }
}

async function publishViaGithubApi(settings, message) {
  const credential = await readGithubCredential()
  if (!credential?.password) throw new Error('GitHub 已登录但没有读取到可用于上传的授权，请在后台重新点击“登录 GitHub”后再试')
  const { owner, name } = githubRepositoryCoordinates(settings.githubRepo)
  let remoteCommit = ''
  let remoteTree = ''
  let remoteFiles = []
  try {
    const ref = await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/ref/heads/${encodeURIComponent(settings.branch)}`, credential)
    remoteCommit = ref.object?.sha || ''
    if (remoteCommit) {
      const commit = await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/commits/${remoteCommit}`, credential)
      remoteTree = commit.tree?.sha || ''
      if (remoteTree) {
        const tree = await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees/${remoteTree}?recursive=1`, credential)
        remoteFiles = Array.isArray(tree.tree) ? tree.tree.filter((entry) => entry.type === 'blob') : []
      }
    }
  } catch (error) {
    if (!String(error.message).includes('GitHub API HTTP 404')) throw error
  }

  const localFiles = parseGitTree((await run('git', ['ls-tree', '-r', '-z', 'HEAD'])).stdout)
  const remoteMap = new Map(remoteFiles.map((entry) => [entry.path, entry.sha]))
  const localMap = new Map(localFiles.map((entry) => [entry.path, entry]))
  const changed = localFiles.filter((entry) => remoteMap.get(entry.path) !== entry.sha)
  const deleted = remoteFiles.filter((entry) => !localMap.has(entry.path))

  if (!changed.length && !deleted.length && remoteCommit) {
    return { commit: remoteCommit, changedCount: 0, deletedCount: 0, via: 'GitHub API' }
  }

  const treeEntries = []
  const skipped = []
  for (const entry of changed) {
    const filePath = path.join(root, entry.path)
    const stat = await fs.stat(filePath)
    if (stat.size > 50 * 1024 * 1024 && !(await isProjectAssetReferenced(entry.path))) {
      skipped.push(`${entry.path}（未被页面使用，文件过大，已跳过）`)
      continue
    }
    if (stat.size > 50 * 1024 * 1024) {
      throw new Error(`文件 ${entry.path} 为 ${(stat.size / 1024 / 1024).toFixed(1)}MB，GitHub 官方接口无法安全接收此大小的单文件，请先通过 Git 网络通道上传`)
    }
    const content = (await fs.readFile(filePath)).toString('base64')
    const blob = await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/blobs`, credential, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, encoding: 'base64' }),
    })
    treeEntries.push({ path: entry.path.replaceAll(path.sep, '/'), mode: entry.mode || '100644', type: 'blob', sha: blob.sha })
  }
  for (const entry of deleted) {
    treeEntries.push({ path: entry.path, mode: entry.mode || '100644', type: 'blob', sha: null })
  }

  const treeBody = { tree: treeEntries }
  if (remoteTree) treeBody.base_tree = remoteTree
  const nextTree = await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees`, credential, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(treeBody),
  })
  const nextCommit = await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/commits`, credential, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: nextTree.sha, ...(remoteCommit ? { parents: [remoteCommit] } : {}) }),
  })
  if (remoteCommit) {
    await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/refs/heads/${encodeURIComponent(settings.branch)}`, credential, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: nextCommit.sha, force: false }),
    })
  } else {
    await githubApiRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/refs`, credential, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${settings.branch}`, sha: nextCommit.sha }),
    })
  }
  return { commit: nextCommit.sha, changedCount: treeEntries.filter((entry) => entry.sha).length, deletedCount: deleted.length, skipped, via: 'GitHub API' }
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
    sendJson(response, 200, await resolveSettingsRepository(await readSettings()))
    return true
  }

  if (url.pathname === '/api/editor/settings' && request.method === 'POST') {
    sendJson(response, 200, { ok: true, settings: await writeSettings(await readJson(request)) })
    return true
  }

  if (url.pathname === '/api/editor/connect-github' && request.method === 'POST') {
    try {
      const settings = await resolveSettingsRepository(await writeSettings(await readJson(request)))
      if (!settings.githubRepo) throw new Error('请先填写 GitHub 仓库地址')
      let gitReady = true
      try { await run('git', ['rev-parse', '--git-dir']) } catch {
        try { await run('git', ['init']) } catch (error) { if (error.code !== 'ENOENT') throw error; gitReady = false }
      }
      if (gitReady) {
        await run('git', ['branch', '-M', settings.branch])
        try { await run('git', ['remote', 'set-url', 'origin', settings.githubRepo]) }
        catch { await run('git', ['remote', 'add', 'origin', settings.githubRepo]) }
        const identity = await ensureGitIdentity(settings)
        const remote = await run('git', ['remote', '-v'])
        sendJson(response, 200, { ok: true, output: `${remote.stdout}\nGit 提交身份：${identity.username} <${identity.email}>`, settings })
      } else {
        sendJson(response, 200, { ok: true, output: '已保存仓库地址。本电脑未检测到 Git，网站编辑和本地保存可以正常使用；发布上线时请使用内置 Git 的便携版或安装 Git。', settings })
      }
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.stderr || error.message })
    }
    return true
  }

  if (url.pathname === '/api/editor/github-repositories' && request.method === 'GET') {
    try {
      const settings = await resolveSettingsRepository(await readSettings())
      sendJson(response, 200, { ok: true, repositories: await readGithubRepositories(settings), settings })
    } catch (error) {
      sendJson(response, 200, { ok: true, repositories: [], settings: await readSettings(), detail: error.message })
    }
    return true
  }

  if (url.pathname === '/api/editor/vercel-projects' && request.method === 'GET') {
    const settings = await readSettings()
    const projects = settings.vercelSiteUrl ? [{
      name: new URL(settings.vercelSiteUrl).hostname,
      url: settings.vercelSiteUrl,
      commit: '',
      status: 'connected',
      source: '当前已保存的网站地址',
    }] : []
    sendJson(response, 200, { ok: true, projects, settings })
    return true
  }

  if (url.pathname === '/api/editor/auth-status' && request.method === 'GET') {
    const settings = await resolveSettingsRepository(await readSettings())
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
      const child = spawn(gitCommand, ['credential-manager', 'github', 'login'], { detached: true, stdio: 'ignore', windowsHide: false })
      child.unref()
      sendJson(response, 200, { ok: true, message: 'GitHub 官方登录窗口已打开。完成一次登录后，系统会记住授权。' })
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.stderr || error.message })
    }
    return true
  }

  if (url.pathname === '/api/editor/open-vercel' && request.method === 'POST') {
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
      removedCards: next.removedCards && typeof next.removedCards === 'object' && !Array.isArray(next.removedCards) ? next.removedCards : {},
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
      const rotatedBuffer = await sharp(sourceBuffer, { animated: true }).rotate().toBuffer()
      const sourceMetadata = await sharp(rotatedBuffer, { animated: true }).metadata()
      const sourceWidth = sourceMetadata.width || maximumImageDimension
      const sourceHeight = sourceMetadata.height || maximumImageDimension
      const longestSide = Math.max(sourceWidth, sourceHeight)
      const scale = Math.min(maximumImageDimension / longestSide, 1)
      const targetWidth = Math.round(sourceWidth * scale)
      const targetHeight = Math.round(sourceHeight * scale)
      const optimized = sharp(rotatedBuffer, { animated: true }).resize({
        width: targetWidth,
        height: targetHeight,
        fit: 'inside',
        withoutEnlargement: true,
      }).webp({ quality: 98, effort: 6, smartSubsample: true })
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
      const settings = await resolveSettingsRepository(await readSettings())
      if (!settings.githubRepo) throw new Error('尚未连接 GitHub 仓库，请先完成首次设置')
      const buildCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm'
      const buildArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build'] : ['run', 'build']
      await run(buildCommand, buildArgs)
      const identity = await ensureGitIdentity(settings)
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
      let publishedCommit = commitSha
      let pushOutput = ''
      try {
        const push = await run('git', ['push', '-u', 'origin', settings.branch])
        pushOutput = push.stdout
      } catch (gitError) {
        try {
          const apiPush = await publishViaGithubApi(settings, 'Update website from visual editor')
          publishedCommit = apiPush.commit
          pushOutput = `Git 网络通道不可用，已自动切换 GitHub 官方接口完成上传。更新 ${apiPush.changedCount} 个文件，删除 ${apiPush.deletedCount} 个文件。${apiPush.skipped?.length ? `\n已跳过未被页面使用的超大素材：${apiPush.skipped.join('、')}` : ''}`
        } catch (apiError) {
          throw new Error(`GitHub 上传失败。Git 通道：${gitError.stderr || gitError.message}\n官方接口：${apiError.message}`)
        }
      }
      sendJson(response, 200, {
        ok: true,
        output: `${commitOutput}\n${pushOutput}\nGit 提交身份：${identity.username} <${identity.email}>\nVercel 将根据 GitHub 更新自动部署。`,
        github: { status: 'success', message: 'GitHub 上传成功', commit: publishedCommit, account: identity.username },
        vercel: { status: 'triggered', message: 'GitHub 已更新；如果 Vercel 已绑定该仓库，将自动开始部署', commit: publishedCommit, url: settings.vercelSiteUrl },
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
    stdio: shouldOpenBrowser ? 'inherit' : 'ignore',
    windowsHide: true,
  })

  const openPromise = waitForPreview().then((ready) => {
    if (!ready || process.platform !== 'win32' || !shouldOpenBrowser) return
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
