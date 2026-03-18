const { app, BrowserWindow, ipcMain, session, dialog, clipboard, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')

// Spoof Chrome UA at process level to avoid Electron detection
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Dual AI Chat',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: true
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

ipcMain.handle('send-message', async (event, { message, target }) => {
  mainWindow.webContents.send('execute-injection', { message, target })
  return { success: true }
})

ipcMain.handle('open-file-dialog', async (_event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
      { name: '文本文件', extensions: ['txt', 'md', 'csv', 'json', 'xml', 'html', 'js', 'ts', 'py'] },
      { name: '文档', extensions: ['pdf', 'doc', 'docx'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return []
  return result.filePaths.map(fp => {
    const stat = fs.statSync(fp)
    const ext = fp.split('.').pop().toLowerCase()
    const isImage = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)
    const isText = ['txt','md','csv','json','xml','html','js','ts','py'].includes(ext)
    let dataUrl = null
    let textContent = null
    if (isImage) {
      const data = fs.readFileSync(fp)
      const mime = ext === 'svg' ? 'image/svg+xml'
                 : ext === 'gif' ? 'image/gif'
                 : ext === 'png' ? 'image/png'
                 : ext === 'webp' ? 'image/webp'
                 : 'image/jpeg'
      dataUrl = `data:${mime};base64,${data.toString('base64')}`
    } else if (isText && stat.size < 500 * 1024) {
      textContent = fs.readFileSync(fp, 'utf-8')
    }
    return {
      path: fp,
      name: fp.split(/[\\/]/).pop(),
      ext,
      isImage,
      isText,
      size: stat.size,
      dataUrl,
      textContent
    }
  })
})

ipcMain.handle('copy-image-to-clipboard', async (_event, dataUrl) => {
  try {
    const ni = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(ni)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

app.on('ready', () => {
  const sessions = [
    session.defaultSession,
    session.fromPartition('persist:left'),
    session.fromPartition('persist:right')
  ]

  sessions.forEach(sess => {
    // Set Chrome User-Agent at session level — hides Electron identity from Google/OpenAI
    sess.setUserAgent(CHROME_UA)

    sess.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(true)
    })

    // Spoof request headers to look like real Chrome
    sess.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders }
      headers['User-Agent'] = CHROME_UA
      // Chrome Client Hints — required for Google/OpenAI security checks
      headers['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not.A/Brand";v="24"'
      headers['sec-ch-ua-mobile'] = '?0'
      headers['sec-ch-ua-platform'] = '"Windows"'
      callback({ requestHeaders: headers })
    })

    // Remove headers that block webview rendering
    sess.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders }
      delete headers['x-frame-options']
      delete headers['X-Frame-Options']
      delete headers['content-security-policy']
      delete headers['Content-Security-Policy']
      callback({ responseHeaders: headers })
    })
  })

  createWindow()
})

// === Google Auth Popup ===
// Google blocks OAuth in embedded webviews. Intercept ALL navigation types to
// accounts.google.com and open in a standalone BrowserWindow (full Chromium window,
// not detected as webview). Shares the same session so cookies carry over.

let authWin = null

function isGoogleAuthUrl(url) {
  return url.includes('accounts.google.com') || url.includes('accounts.youtube.com')
}

function openGoogleAuth(url, webviewContents) {
  if (authWin && !authWin.isDestroyed()) {
    authWin.focus()
    return
  }

  authWin = new BrowserWindow({
    width: 500,
    height: 700,
    parent: mainWindow,
    title: 'Google 登录',
    webPreferences: {
      session: webviewContents.session,
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  authWin.loadURL(url)

  // Auto-close when navigated away from Google auth (login completed)
  const checkDone = (_event, navUrl) => {
    if (!isGoogleAuthUrl(navUrl) &&
        !navUrl.includes('google.com/signin') &&
        !navUrl.includes('consent.google.com') &&
        !navUrl.includes('myaccount.google.com') &&
        !navUrl.startsWith('about:')) {
      setTimeout(() => {
        if (authWin && !authWin.isDestroyed()) authWin.close()
      }, 800)
    }
  }
  authWin.webContents.on('did-navigate', checkDone)
  authWin.webContents.on('did-redirect-navigation', checkDone)

  authWin.on('closed', () => {
    authWin = null
    if (!webviewContents.isDestroyed()) {
      webviewContents.reload()
    }
  })
}

// Register BEFORE 'ready' to guarantee it catches all webview creation
app.on('web-contents-created', (_createEvent, contents) => {
  // 1. User-initiated navigation (link click, form submit)
  contents.on('will-navigate', (event, url) => {
    if (isGoogleAuthUrl(url)) {
      event.preventDefault()
      openGoogleAuth(url, contents)
    }
  })

  // 2. Server-side redirect (302/303)
  contents.on('will-redirect', (event, url) => {
    if (isGoogleAuthUrl(url)) {
      event.preventDefault()
      openGoogleAuth(url, contents)
    }
  })

  // 3. Fallback: page already landed on accounts.google.com
  contents.on('did-navigate', (_event, url) => {
    if (isGoogleAuthUrl(url)) {
      openGoogleAuth(url, contents)
      if (contents.canGoBack()) {
        contents.goBack()
      }
    }
  })

  // 4. Popup windows (window.open)
  contents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthUrl(url)) {
      openGoogleAuth(url, contents)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
