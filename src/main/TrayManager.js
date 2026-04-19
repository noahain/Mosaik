const { Tray, Menu, BrowserWindow, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

class TrayManager {
  constructor(windowManager, serviceManager) {
    this.windowManager = windowManager;
    this.serviceManager = serviceManager;
    this.tray = null;
    this.settingsWindow = null;
  }

  createTray() {
    // Try multiple possible paths for the tray icon
    const possiblePaths = [
      // Development paths
      path.join(process.cwd(), 'assets', 'icons', 'tray.ico'),
      path.join(__dirname, '..', '..', 'assets', 'icons', 'tray.ico'),
      path.join(app.getAppPath(), 'assets', 'icons', 'tray.ico'),
      // Production paths
      path.join(process.resourcesPath, 'assets', 'icons', 'tray.ico'),
      path.join(app.getAppPath(), '..', 'assets', 'icons', 'tray.ico'),
    ];

    let trayIconPath = null;
    for (const testPath of possiblePaths) {
      console.log('[TrayManager] Testing path:', testPath);
      if (fs.existsSync(testPath)) {
        trayIconPath = testPath;
        console.log('[TrayManager] Found tray icon at:', trayIconPath);
        break;
      }
    }

    if (!trayIconPath) {
      console.error('[TrayManager] Could not find tray.ico in any location');
      // Fallback to cwd
      trayIconPath = path.join(process.cwd(), 'assets', 'icons', 'tray.ico');
    }

    let icon;
    try {
      icon = nativeImage.createFromPath(trayIconPath);
      // Resize to appropriate dimensions for tray (16x16)
      if (icon.getSize().width > 16) {
        icon = icon.resize({ width: 16, height: 16 });
      }
    } catch (e) {
      console.error('Failed to load tray icon:', e);
      // Fallback to a simple icon
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => {
          this.showMainWindow();
        }
      },
      {
        label: 'Settings',
        click: () => {
          this.showSettingsWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          this.serviceManager.saveServices();
          require('electron').app.quit();
        }
      }
    ]);

    this.tray.setToolTip('Mosaik');
    this.tray.setContextMenu(contextMenu);

    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    return this.tray;
  }

  showSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'Mosaik Settings',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/settingsPreload.js')
      }
    });

    // Remove menu bar completely
    this.settingsWindow.setMenuBarVisibility(false);
    this.settingsWindow.removeMenu();

    this.settingsWindow.loadFile('src/renderer/settings/index.html');

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }

  showMainWindow() {
    let mainWindow = this.windowManager.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      // Recreate the main window if it was destroyed
      mainWindow = this.windowManager.createMainWindow();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

module.exports = TrayManager;
