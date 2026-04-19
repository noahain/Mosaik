const { BrowserWindow, screen } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.serviceView = null;
    this.sidebarWidth = 50;
    this.isReady = false;
    this.pendingServiceView = null;
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      title: 'Mosaik',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, '../preload/sidebarPreload.js')
      },
      show: false
    });

    // Remove menu bar completely
    this.mainWindow.setMenuBarVisibility(false);
    this.mainWindow.removeMenu();

    // Inject CSS to hide scrollbars
    this.mainWindow.webContents.on('did-finish-load', () => {
      this.mainWindow.webContents.insertCSS(`
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

    // Load sidebar HTML
    this.mainWindow.loadFile('src/renderer/sidebar/index.html');

    this.mainWindow.once('ready-to-show', () => {
      this.isReady = true;
      this.mainWindow.show();
      this.mainWindow.focus();

      // Apply pending view if exists
      if (this.pendingServiceView) {
        console.log('Applying pending service view after window ready');
        this.setServiceView(this.pendingServiceView);
        this.pendingServiceView = null;
      }
    });

    // Handle resize
    this.mainWindow.on('resize', () => {
      this.updateServiceViewBounds();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.serviceView = null;
    });

    return this.mainWindow;
  }

  setServiceView(view) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.log('Window not ready yet, storing service view for later');
      this.pendingServiceView = view;
      return;
    }

    // Queue view if window still loading
    if (!this.isReady) {
      console.log('Window not ready yet, storing service view for later');
      this.pendingServiceView = view;
      return;
    }

    if (!view) {
      console.error('No view provided to setServiceView');
      return;
    }

    // Validate view is a BrowserView-like object
    if (typeof view.setBounds !== 'function') {
      console.error('Invalid view object - does not have setBounds method');
      return;
    }

    // Remove current view
    this.removeCurrentServiceView();

    this.serviceView = view;
    this.addServiceView(this.serviceView);
  }

  removeCurrentServiceView() {
    if (!this.serviceView) return;

    try {
      // Remove using Electron 28 API
      if (this.mainWindow && typeof this.mainWindow.setBrowserView === 'function') {
        this.mainWindow.setBrowserView(null);
        console.log('Removed BrowserView via setBrowserView(null)');
      }
    } catch (e) {
      console.error('Error removing service view:', e);
    }

    // Cleanup webContents if possible
    try {
      if (this.serviceView.webContents && !this.serviceView.webContents.isDestroyed()) {
        this.serviceView.webContents.stop();
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    this.serviceView = null;
  }

  addServiceView(view) {
    try {
      // Get window bounds
      const bounds = this.mainWindow.getContentBounds();

      // Set view bounds to fill window (minus sidebar)
      const viewBounds = {
        x: this.sidebarWidth,
        y: 0,
        width: bounds.width - this.sidebarWidth,
        height: bounds.height
      };

      view.setBounds(viewBounds);
      console.log('BrowserView bounds set to:', viewBounds);

      // Add to window using Electron 28 API
      if (typeof this.mainWindow.setBrowserView === 'function') {
        this.mainWindow.setBrowserView(view);
        console.log('BrowserView added via setBrowserView');
      } else {
        throw new Error('setBrowserView not available - Electron version incompatible');
      }

      // Handle title updates
      if (view.webContents) {
        // Set initial title if already loaded
        if (view.webContents.getURL() && view.webContents.getURL() !== '') {
          const title = view.webContents.getTitle();
          if (title) {
            this.mainWindow.setTitle(`Mosaik - ${title}`);
          }
        }

        // Listen for title updates
        view.webContents.on('page-title-updated', (event, title) => {
          console.log('Page title updated:', title);
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.setTitle(`Mosaik - ${title}`);
          }
        });

        // Focus the view
        view.webContents.focus();
      }

      console.log('Service view added successfully');
    } catch (e) {
      console.error('Error adding service view:', e);
    }
  }

  updateServiceViewBounds() {
    if (!this.mainWindow || !this.serviceView) return;

    // Skip if view is destroyed
    try {
      if (this.serviceView.webContents && this.serviceView.webContents.isDestroyed()) {
        return;
      }
    } catch (e) {
      return;
    }

    const bounds = this.mainWindow.getContentBounds();

    try {
      this.serviceView.setBounds({
        x: this.sidebarWidth,
        y: 0,
        width: bounds.width - this.sidebarWidth,
        height: bounds.height
      });
    } catch (e) {
      console.error('Error updating view bounds:', e);
    }
  }

  setTitle(title) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setTitle(title);
    }
  }

  getMainWindow() {
    return this.mainWindow;
  }

  isWindowReady() {
    return this.isReady;
  }
}

module.exports = WindowManager;
