// === Provider Configuration ===
const PROVIDERS = {

  deepseek: {
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    color: '#4d6af0',
    buildInjection: (msg) => buildGenericInjection(msg, [
      'textarea[placeholder*="Send"]',
      'textarea[placeholder*="发送"]',
      '#chat-input',
      'div[contenteditable="true"]',
      'textarea'
    ])
  },
  chatgpt: {
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    color: '#10a37f',
    buildInjection: buildChatGPTInjection
  },
  doubao: {
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    color: '#4e6ef2',
    buildInjection: (msg) => buildGenericInjection(msg, [
      'div[data-testid="chat-input"]',
      '#chat-input',
      'textarea.w-full',
      'div[contenteditable="true"]',
      'textarea'
    ])
  },
  minimax: {
    name: 'MiniMax',
    url: 'https://agent.minimaxi.com/',
    color: '#8b5cf6',
    buildInjection: (msg) => buildGenericInjection(msg, [
      'div[contenteditable="true"]',
      'textarea'
    ])
  },
  kimi: {
    name: 'Kimi',
    url: 'https://www.kimi.com/zh/',
    color: '#1a73e8',
    buildInjection: (msg) => buildGenericInjection(msg, [
      'div[contenteditable="true"][data-testid*="input"]',
      'textarea[placeholder*="Kimi"]',
      'textarea[placeholder*="消息"]',
      'div[contenteditable="true"]',
      'textarea'
    ])
  }
}

// === Elements ===
const leftWebview = document.getElementById('left-webview')
const rightWebview = document.getElementById('right-webview')
const messageInput = document.getElementById('message-input')
const sendBtn = document.getElementById('send-btn')
const attachBtn = document.getElementById('attach-btn')
const attachmentPreview = document.getElementById('attachment-preview')
const notification = document.getElementById('notification')
const leftStatus = document.getElementById('left-status')
const rightStatus = document.getElementById('right-status')
const targetBtns = document.querySelectorAll('.target-btn')
const leftSelect = document.getElementById('left-select')
const rightSelect = document.getElementById('right-select')
const leftDot = document.getElementById('left-dot')
const rightDot = document.getElementById('right-dot')
const leftRefresh = document.getElementById('left-refresh')
const rightRefresh = document.getElementById('right-refresh')
const leftPanel = document.getElementById('left-panel')
const rightPanel = document.getElementById('right-panel')
const hDivider = document.getElementById('h-divider')
const vResizer = document.getElementById('v-resizer')
const inputBar = document.getElementById('input-bar')
const webviewsContainer = document.querySelector('.webviews-container')

let currentTarget = 'both'
let isSending = false

// === Attachment State ===
let attachments = [] // array of file info objects from main process

function getFileIcon(ext) {
  const icons = {
    pdf: '📄', doc: '📝', docx: '📝',
    txt: '📃', md: '📃', csv: '📊',
    json: '🔧', xml: '🔧', html: '🌐',
    js: '⚙️', ts: '⚙️', py: '🐍'
  }
  return icons[ext] || '📎'
}

function renderAttachmentPreview() {
  attachmentPreview.innerHTML = ''
  if (attachments.length === 0) {
    attachmentPreview.classList.add('hidden')
    return
  }
  attachmentPreview.classList.remove('hidden')
  attachments.forEach((file, idx) => {
    const chip = document.createElement('div')
    chip.className = 'attachment-chip'
    chip.title = file.path

    if (file.isImage && file.dataUrl) {
      const img = document.createElement('img')
      img.src = file.dataUrl
      img.alt = file.name
      chip.appendChild(img)
    } else {
      const icon = document.createElement('div')
      icon.className = 'chip-icon'
      icon.textContent = getFileIcon(file.ext)
      chip.appendChild(icon)
    }

    const name = document.createElement('span')
    name.className = 'chip-name'
    name.textContent = file.name
    chip.appendChild(name)

    const removeBtn = document.createElement('button')
    removeBtn.className = 'chip-remove'
    removeBtn.title = '移除附件'
    removeBtn.textContent = '×'
    removeBtn.addEventListener('click', () => {
      attachments.splice(idx, 1)
      renderAttachmentPreview()
    })
    chip.appendChild(removeBtn)

    attachmentPreview.appendChild(chip)
  })
}

// === Attach Button Click ===
attachBtn.addEventListener('click', async () => {
  if (!window.electronAPI || !window.electronAPI.openFileDialog) {
    showNotification('文件选择功能不可用', 'error')
    return
  }
  try {
    const files = await window.electronAPI.openFileDialog()
    if (files && files.length > 0) {
      // Deduplicate by path
      const existingPaths = new Set(attachments.map(f => f.path))
      const newFiles = files.filter(f => !existingPaths.has(f.path))
      attachments.push(...newFiles)
      renderAttachmentPreview()
      if (newFiles.length > 0) {
        showNotification(`已添加 ${newFiles.length} 个附件`, 'success', 2000)
      }
    }
  } catch (err) {
    showNotification('打开文件失败: ' + err.message, 'error')
  }
})

// === Provider Dot Colors ===
function updateDot(dotEl, providerKey) {
  dotEl.style.backgroundColor = PROVIDERS[providerKey]?.color || '#555'
}

// === Initialize Providers (localStorage → select → webview, single source of truth) ===
;(function initProviders() {
  const savedLeft = localStorage.getItem('provider_left')
  const savedRight = localStorage.getItem('provider_right')

  if (savedLeft && PROVIDERS[savedLeft]) {
    leftSelect.value = savedLeft
  }
  if (savedRight && PROVIDERS[savedRight]) {
    rightSelect.value = savedRight
  }

  leftWebview.src = PROVIDERS[leftSelect.value].url
  rightWebview.src = PROVIDERS[rightSelect.value].url
  updateDot(leftDot, leftSelect.value)
  updateDot(rightDot, rightSelect.value)
})()

// === Refresh Buttons ===
function triggerRefresh(btn, webview) {
  btn.classList.add('spinning')
  webview.reload()
  setTimeout(() => btn.classList.remove('spinning'), 600)
}

leftRefresh.addEventListener('click', () => triggerRefresh(leftRefresh, leftWebview))
rightRefresh.addEventListener('click', () => triggerRefresh(rightRefresh, rightWebview))

// === Provider Switch ===
leftSelect.addEventListener('change', () => {
  const provider = PROVIDERS[leftSelect.value]
  if (provider) {
    leftWebview.src = provider.url
    updateDot(leftDot, leftSelect.value)
    localStorage.setItem('provider_left', leftSelect.value)
  }
})

rightSelect.addEventListener('change', () => {
  const provider = PROVIDERS[rightSelect.value]
  if (provider) {
    rightWebview.src = provider.url
    updateDot(rightDot, rightSelect.value)
    localStorage.setItem('provider_right', rightSelect.value)
  }
})

// === Target Selector ===
targetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    targetBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentTarget = btn.dataset.target
  })
})

// === Keyboard: Enter to send, Shift+Enter for newline ===
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

sendBtn.addEventListener('click', sendMessage)

// === Disable webview pointer events during drag ===
function setWebviewPointerEvents(enabled) {
  leftWebview.style.pointerEvents = enabled ? '' : 'none'
  rightWebview.style.pointerEvents = enabled ? '' : 'none'
}

// === Horizontal Resizer (left/right panels) ===
let hDragging = false
let hStartX = 0
let hStartLeftWidth = 0

hDivider.addEventListener('mousedown', (e) => {
  hDragging = true
  hStartX = e.clientX
  hStartLeftWidth = leftPanel.getBoundingClientRect().width
  hDivider.classList.add('dragging')
  setWebviewPointerEvents(false)
  e.preventDefault()
})

// === Vertical Resizer (input bar height) ===
let vDragging = false
let vStartY = 0
let vStartInputHeight = 0

vResizer.addEventListener('mousedown', (e) => {
  vDragging = true
  vStartY = e.clientY
  vStartInputHeight = inputBar.getBoundingClientRect().height
  vResizer.classList.add('dragging')
  setWebviewPointerEvents(false)
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (hDragging) {
    const containerWidth = webviewsContainer.getBoundingClientRect().width - hDivider.offsetWidth
    const delta = e.clientX - hStartX
    const newLeftWidth = Math.max(200, Math.min(hStartLeftWidth + delta, containerWidth - 200))
    leftPanel.style.flex = 'none'
    leftPanel.style.width = newLeftWidth + 'px'
    rightPanel.style.flex = '1'
    rightPanel.style.width = ''
  }
  if (vDragging) {
    const delta = vStartY - e.clientY
    const appHeight = document.querySelector('.app-container').getBoundingClientRect().height
    const headerHeight = document.querySelector('.header-bar').getBoundingClientRect().height
    const maxHeight = appHeight - headerHeight - vResizer.offsetHeight - 150
    const newHeight = Math.max(60, Math.min(vStartInputHeight + delta, maxHeight))
    inputBar.style.height = newHeight + 'px'
  }
})

document.addEventListener('mouseup', () => {
  if (hDragging) {
    hDragging = false
    hDivider.classList.remove('dragging')
    setWebviewPointerEvents(true)
  }
  if (vDragging) {
    vDragging = false
    vResizer.classList.remove('dragging')
    setWebviewPointerEvents(true)
  }
})

// === Message Injection Scripts ===

function buildChatGPTInjection(message) {
  const escaped = JSON.stringify(message)
  return `
    (async function() {
      try {
        const selectors = [
          '#prompt-textarea',
          'div[contenteditable="true"][data-id="root"]',
          'div[contenteditable="true"].ProseMirror',
          'div[contenteditable="true"][placeholder]',
          'textarea[placeholder*="Message"]',
          'div[contenteditable="true"]',
          'textarea'
        ]
        let inputEl = null
        for (const sel of selectors) {
          inputEl = document.querySelector(sel)
          if (inputEl) break
        }
        if (!inputEl) return { success: false, error: 'Input not found' }

        inputEl.focus()
        if (inputEl.tagName === 'TEXTAREA') {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
          setter.call(inputEl, ${escaped})
          inputEl.dispatchEvent(new Event('input', { bubbles: true }))
          inputEl.dispatchEvent(new Event('change', { bubbles: true }))
        } else {
          inputEl.innerHTML = ''
          document.execCommand('selectAll', false, null)
          document.execCommand('insertText', false, ${escaped})
        }

        await new Promise(r => setTimeout(r, 300))

        const sendSelectors = [
          'button[data-testid="send-button"]',
          'button[aria-label="Send message"]',
          'button[aria-label*="Send"]',
          'form button[type="submit"]'
        ]
        for (const sel of sendSelectors) {
          const el = document.querySelector(sel)
          if (el) {
            const btn = el.closest('button') || el
            if (btn && !btn.disabled) { btn.click(); return { success: true } }
          }
        }
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
        return { success: true, method: 'enter-key' }
      } catch (err) {
        return { success: false, error: err.message }
      }
    })()
  `
}

function buildGenericInjection(message, extraSelectors = []) {
  const escaped = JSON.stringify(message)
  const allSelectors = JSON.stringify([
    ...extraSelectors,
    'div[contenteditable="true"][placeholder]',
    'div[contenteditable="true"][data-placeholder]',
    'textarea:not([style*="display: none"])',
    'div[contenteditable="true"]',
    'textarea'
  ])
  return `
    (async function() {
      try {
        const selectors = ${allSelectors}
        let inputEl = null
        for (const sel of selectors) {
          try {
            const el = document.querySelector(sel)
            if (el && el.offsetParent !== null) { inputEl = el; break }
          } catch(e) {}
        }
        if (!inputEl) return { success: false, error: 'Input not found' }

        inputEl.focus()
        if (inputEl.tagName === 'TEXTAREA') {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
          setter.call(inputEl, ${escaped})
          inputEl.dispatchEvent(new Event('input', { bubbles: true }))
          inputEl.dispatchEvent(new Event('change', { bubbles: true }))
        } else {
          document.execCommand('selectAll', false, null)
          document.execCommand('insertText', false, ${escaped})
        }

        await new Promise(r => setTimeout(r, 400))

        const sendSelectors = [
          'button[aria-label*="发送"]', 'button[aria-label*="Send"]',
          'button[data-testid*="send"]', 'button[type="submit"]',
          'form button:last-of-type'
        ]
        for (const sel of sendSelectors) {
          const btn = document.querySelector(sel)
          if (btn && !btn.disabled) { btn.click(); return { success: true } }
        }
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
        return { success: true, method: 'enter-key' }
      } catch (err) {
        return { success: false, error: err.message }
      }
    })()
  `
}

// === Status Helpers ===
function showStatus(el, message, duration = 2000) {
  el.textContent = message
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), duration)
}

function showNotification(message, type = 'info', duration = 3000) {
  notification.textContent = message
  notification.className = `notification ${type}`
  setTimeout(() => { notification.className = 'notification hidden' }, duration)
}

// === Build message with text attachments appended ===
function buildFullMessage() {
  const base = messageInput.value.trim()
  const textFiles = attachments.filter(f => f.isText && f.textContent != null)
  if (textFiles.length === 0) return base
  const parts = [base]
  textFiles.forEach(f => {
    parts.push(`\n\n--- 附件: ${f.name} ---\n${f.textContent}`)
  })
  return parts.join('')
}

// === Image paste via clipboard + Ctrl+V ===
// Step 1: JS injected into webview to focus the chat input
const FOCUS_INPUT_JS = `
  (function() {
    const selectors = [
      '#prompt-textarea',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-testid*="input"]',
      'div[contenteditable="true"][placeholder]',
      'textarea[placeholder*="发送"]',
      'textarea[placeholder*="消息"]',
      'textarea[placeholder*="Message"]',
      'div[contenteditable="true"]',
      'textarea'
    ]
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel)
        if (el && el.offsetParent !== null) { el.focus(); return true }
      } catch(e) {}
    }
    return false
  })()
`

async function pasteImageToWebview(webview, dataUrl) {
  // Write image to system clipboard via main process
  await window.electronAPI.copyImageToClipboard(dataUrl)
  // Focus the chat input in the webview
  await webview.executeJavaScript(FOCUS_INPUT_JS)
  // Small delay to ensure focus is registered
  await new Promise(r => setTimeout(r, 150))
  // Simulate Ctrl+V
  webview.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['ctrl'] })
  webview.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['ctrl'] })
  // Wait for the site to process the paste
  await new Promise(r => setTimeout(r, 800))
}

// === Core Send Function ===
async function sendMessage() {
  const message = buildFullMessage()
  if (!message && attachments.length === 0) return
  if (isSending) return

  isSending = true
  sendBtn.disabled = true
  attachBtn.disabled = true
  messageInput.disabled = true

  const leftProvider = PROVIDERS[leftSelect.value]
  const rightProvider = PROVIDERS[rightSelect.value]
  const results = []
  const imageAttachments = attachments.filter(f => f.isImage && f.dataUrl)

  try {
    if (currentTarget === 'both' || currentTarget === 'left') {
      try {
        // Paste each image via clipboard
        for (const img of imageAttachments) {
          await pasteImageToWebview(leftWebview, img.dataUrl)
        }
        // Then send text message
        if (message) {
          const result = await leftWebview.executeJavaScript(leftProvider.buildInjection(message))
          if (result && result.success) {
            showStatus(leftStatus, '✓ 已发送')
            results.push(`${leftProvider.name}: 成功`)
          } else {
            showStatus(leftStatus, '✗ 失败', 3000)
            results.push(`${leftProvider.name}: 失败 (${result?.error || '未知'})`)
          }
        } else {
          showStatus(leftStatus, '✓ 图片已粘贴')
          results.push(`${leftProvider.name}: 成功`)
        }
      } catch (err) {
        showStatus(leftStatus, '✗ 错误', 3000)
        results.push(`${leftProvider.name}: 错误`)
      }
    }

    if (currentTarget === 'both' || currentTarget === 'right') {
      try {
        for (const img of imageAttachments) {
          await pasteImageToWebview(rightWebview, img.dataUrl)
        }
        if (message) {
          const result = await rightWebview.executeJavaScript(rightProvider.buildInjection(message))
          if (result && result.success) {
            showStatus(rightStatus, '✓ 已发送')
            results.push(`${rightProvider.name}: 成功`)
          } else {
            showStatus(rightStatus, '✗ 失败', 3000)
            results.push(`${rightProvider.name}: 失败 (${result?.error || '未知'})`)
          }
        } else {
          showStatus(rightStatus, '✓ 图片已粘贴')
          results.push(`${rightProvider.name}: 成功`)
        }
      } catch (err) {
        showStatus(rightStatus, '✗ 错误', 3000)
        results.push(`${rightProvider.name}: 错误`)
      }
    }


    const hasSuccess = results.some(r => r.includes('成功'))
    if (hasSuccess) {
      messageInput.value = ''
      attachments = []
      renderAttachmentPreview()
    }

    const allSuccess = results.every(r => r.includes('成功'))
    const allFail = results.every(r => !r.includes('成功'))

    if (allSuccess) {
      showNotification('消息已发送', 'success')
    } else if (allFail) {
      showNotification('发送失败，请确认已登录相关网站', 'error', 4000)
    } else {
      showNotification(results.join(' | '), 'info', 4000)
    }

  } finally {
    isSending = false
    sendBtn.disabled = false
    attachBtn.disabled = false
    messageInput.disabled = false
    messageInput.focus()
  }
}

// === Webview Loading Status ===
leftWebview.addEventListener('did-start-loading', () => showStatus(leftStatus, '加载中...', 30000))
leftWebview.addEventListener('did-finish-load', () => leftStatus.classList.remove('show'))
leftWebview.addEventListener('did-fail-load', (e) => {
  if (e.errorCode !== -3) showStatus(leftStatus, '加载失败', 5000)
})

rightWebview.addEventListener('did-start-loading', () => showStatus(rightStatus, '加载中...', 30000))
rightWebview.addEventListener('did-finish-load', () => rightStatus.classList.remove('show'))
rightWebview.addEventListener('did-fail-load', (e) => {
  if (e.errorCode !== -3) showStatus(rightStatus, '加载失败', 5000)
})

// === Focus input on start ===
messageInput.focus()
