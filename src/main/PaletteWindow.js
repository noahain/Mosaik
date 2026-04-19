const { BrowserWindow, screen } = require('electron');
const path = require('path');

class PaletteWindow {
  constructor() {
    this.window = null;
    this.isVisible = false;
  }

  create() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workAreaSize } = primaryDisplay;

    this.window = new BrowserWindow({
      width: 600,
      height: 400,
      x: Math.round((workAreaSize.width - 600) / 2),
      y: 150,
      frame: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      transparent: true,
      hasShadow: false,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/palettePreload.js')
      }
    });

    this.window.loadFile('src/renderer/palette/index.html');

    // Inject CSS to hide scrollbars
    this.window.webContents.on('did-finish-load', () => {
      this.window.webContents.insertCSS(`
        *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        * {
          scrollbar-width: none !important;
        }
        html, body {
          overflow: hidden;
        }
      `).catch(err => console.error('Failed to insert scrollbar CSS:', err));
    });

    // When window loses focus, hide it
    this.window.on('blur', () => {
      this.hide();
    });

    return this.window;
  }

  show() {
    console.log('[PaletteWindow] Show called, window exists:', !!this.window);

    if (!this.window || this.window.isDestroyed()) {
      console.log('[PaletteWindow] Creating new window...');
      this.create();
    }

    // Center on screen again (in case resolution changed)
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workAreaSize } = primaryDisplay;
    const bounds = {      x: Math.round((workAreaSize.width - 600) / 2),
      y: 150,
      width: 600,
      height: 400
    };
    console.log('[PaletteWindow] Setting bounds:', bounds);

    this.window.setBounds(bounds);

    console.log('[PaletteWindow] Calling show() and focus()');
    this.window.show();
    this.window.focus();
    this.window.moveTop();
    this.isVisible = true;

    // Notify renderer to focus input
    this.window.webContents.send('palette-shown');
    console.log('[PaletteWindow] Window should be visible now');
  }

  hide() {
    if (this.window) {
      this.window.hide();
      this.isVisible = false;
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  getWindow() {
    return this.window;
  }
}

module.exports = PaletteWindow;
