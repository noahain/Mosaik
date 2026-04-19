const { ipcMain } = require('electron');

class IPCHandler {
  constructor(serviceManager, windowManager, paletteWindow, trayManager) {
    this.serviceManager = serviceManager;
    this.windowManager = windowManager;
    this.paletteWindow = paletteWindow;
    this.trayManager = trayManager;
  }

  register() {
    // Palette → Main
    ipcMain.handle('get-enabled-services', () => {
      return this.serviceManager.getEnabledServices();
    });

    ipcMain.handle('select-service', async (event, serviceId) => {
      let mainWindow = this.windowManager.getMainWindow();

      // If main window is destroyed or hidden (tray mode), create/recreate it
      if (!mainWindow || mainWindow.isDestroyed()) {
        console.log('[IPCHandler] Main window not available, creating new window');
        mainWindow = this.windowManager.createMainWindow();

        // Wait for window to be ready before switching service
        await new Promise((resolve) => {
          mainWindow.once('ready-to-show', () => {
            console.log('[IPCHandler] Window is now ready');
            resolve();
          });
        });
      }

      const view = this.serviceManager.switchToService(serviceId, this.windowManager);
      if (view) {
        // Hide palette
        this.paletteWindow.hide();

        // Show and focus the main window (handles both normal and tray-minimized states)
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.moveTop();

        // Update sidebar with current service
        mainWindow.webContents.send('service-changed', serviceId);
      }
      return { success: !!view };
    });

    // Sidebar → Main (for palette button)
    ipcMain.handle('show-palette', () => {
      // Show and focus the palette window
      this.paletteWindow.show();
      const win = this.paletteWindow.getWindow();
      if (win) {
        win.focus();
        win.moveTop();
      }
      return { success: true };
    });

    // Toggle palette (new handler)
    ipcMain.handle('toggle-palette', () => {
      this.paletteWindow.toggle();
      return { success: true };
    });

    // Settings → Main
    ipcMain.handle('get-all-services', () => {
      return this.serviceManager.getAllServices();
    });

    ipcMain.handle('update-service-order', (event, orderedIds) => {
      this.serviceManager.updateServiceOrder(orderedIds);
      // Notify all windows of updated services
      this.broadcast('services-updated', this.serviceManager.getEnabledServices());
      return { success: true };
    });

    ipcMain.handle('toggle-service-enabled', (event, { serviceId, enabled }) => {
      this.serviceManager.toggleServiceEnabled(serviceId, enabled);
      this.broadcast('services-updated', this.serviceManager.getEnabledServices());
      return { success: true };
    });

    ipcMain.handle('toggle-service-always-loaded', (event, { serviceId, alwaysLoaded }) => {
      this.serviceManager.toggleServiceAlwaysLoaded(serviceId, alwaysLoaded);
      this.broadcast('services-updated', this.serviceManager.getEnabledServices());
      return { success: true };
    });

    ipcMain.handle('toggle-service-private', (event, { serviceId, isPrivate }) => {
      console.log('[IPCHandler] Toggle service private:', serviceId, isPrivate);
      const success = this.serviceManager.toggleServicePrivate(serviceId, isPrivate);
      this.broadcast('services-updated', this.serviceManager.getEnabledServices());
      return { success };
    });

    ipcMain.handle('add-custom-service', (event, serviceData) => {
      const newService = this.serviceManager.addCustomService(serviceData);
      this.broadcast('services-updated', this.serviceManager.getEnabledServices());
      return newService;
    });

    ipcMain.handle('save-settings', async (event, settings) => {
      const { globalShortcut } = require('electron');
      // Import validation helper and mode handlers
      const { isValidShortcutFormat, sanitizeShortcut, togglePalette, registerGlobal, unregisterGlobal } = require('../../main');

      const oldSettings = this.serviceManager.getSettings();

      // Handle search mode change - note: global shortcut is always registered
      // The difference is in the behavior: app mode checks if window is focused
      if (settings.searchMode && oldSettings.searchMode !== settings.searchMode) {
        console.log('[IPCHandler] Search mode changing from', oldSettings.searchMode, 'to', settings.searchMode);

        if (settings.searchMode === 'global') {
          console.log('[IPCHandler] Global mode: Shortcut will work everywhere');
        } else {
          console.log('[IPCHandler] App-only mode: Shortcut will only work when app is focused');
        }
        // No need to unregister/re-register - the togglePalette function handles the mode check
      }

      // Handle shortcut change - only if in global mode or switching to global
      if (settings.globalShortcut && oldSettings.globalShortcut !== settings.globalShortcut) {
        const newShortcut = sanitizeShortcut(settings.globalShortcut);

        // Validate shortcut format
        if (!isValidShortcutFormat(newShortcut)) {
          console.error('[IPCHandler] Invalid shortcut format:', newShortcut);
          return { success: false, error: 'Invalid or incomplete shortcut format' };
        }

        console.log('[IPCHandler] Shortcut changing from', oldSettings.globalShortcut, 'to', newShortcut);

        // Only update global shortcut if we're in or switching to global mode
        const effectiveMode = settings.searchMode || oldSettings.searchMode;
        if (effectiveMode === 'global') {
          try {
            globalShortcut.unregister(oldSettings.globalShortcut);

            if (!newShortcut.endsWith('+') && newShortcut.includes('+')) {
              const registered = globalShortcut.register(newShortcut, togglePalette);
              if (!registered) {
                console.error('[IPCHandler] Failed to register new global shortcut:', newShortcut);
                // Fallback to old shortcut
                try {
                  globalShortcut.register(oldSettings.globalShortcut, togglePalette);
                } catch (fallbackError) {
                  console.error('[IPCHandler] Failed to re-register old shortcut:', fallbackError);
                }
                return { success: false, error: 'Failed to register shortcut' };
              }
            } else {
              console.error('[IPCHandler] Invalid shortcut format:', newShortcut);
              return { success: false, error: 'Invalid shortcut format' };
            }
          } catch (error) {
            console.error('[IPCHandler] Error updating global shortcut:', error);
            return { success: false, error: error.message };
          }
        }
      }

      this.serviceManager.updateSettings(settings);
      return { success: true };
    });

    ipcMain.handle('get-settings', () => {
      return this.serviceManager.getSettings();
    });

    // System tray → Main
    ipcMain.handle('minimize-to-tray', () => {
      this.windowManager.getMainWindow()?.hide();
      this.serviceManager.unloadAllNonPersistent();
      return { success: true };
    });

    ipcMain.handle('show-main-window', () => {
      const win = this.windowManager.getMainWindow();
      win?.show();
      win?.focus();
      return { success: true };
    });
  }

  broadcast(channel, data) {
    const mainWindow = this.windowManager.getMainWindow();
    const paletteWindow = this.paletteWindow.getWindow();
    const settingsWindow = this.trayManager.getSettingsWindow();

    mainWindow?.webContents.send(channel, data);
    paletteWindow?.webContents.send(channel, data);
    settingsWindow?.webContents.send(channel, data);
  }
}

module.exports = IPCHandler;
