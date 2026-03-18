const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Send message to both or specific webview
  sendMessage: (message, target = 'both') => {
    return ipcRenderer.invoke('send-message', { message, target })
  },

  // Listen for injection commands from main process
  onExecuteInjection: (callback) => {
    ipcRenderer.on('execute-injection', (_event, data) => callback(data))
  },

  // Remove listener
  removeExecuteInjectionListener: () => {
    ipcRenderer.removeAllListeners('execute-injection')
  },

  // Open OS file selection dialog and return file info array
  openFileDialog: () => {
    return ipcRenderer.invoke('open-file-dialog')
  },

  // Copy image dataUrl to system clipboard
  copyImageToClipboard: (dataUrl) => {
    return ipcRenderer.invoke('copy-image-to-clipboard', dataUrl)
  }
})
