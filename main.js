const { app, globalShortcut } = require('electron');
const path = require('path');
const ServiceManager = require('./src/main/ServiceManager');
const WindowManager = require('./src/main/WindowManager');
const PaletteWindow = require('./src/main/PaletteWindow');
const TrayManager = require('./src/main/TrayManager');
const IPCHandler = require('./src/main/IPCHandler');

// Single Instance Lock - prevent duplicate app instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Another instance is already running. Quitting...');
  app.quit();
  process.exit(0);
}

let serviceManager;
let windowManager;
let paletteWindow;
let trayManager;
let ipcHandler;

// Helper function to validate shortcut format
function isValidShortcutFormat(shortcut) {
  if (!shortcut || typeof shortcut !== 'string') return false;

  const hasModifier = /^(Command|CommandOrControl|Control|Ctrl|Alt|Shift|Super)/i.test(shortcut);
  const hasSeparator = shortcut.includes('+');
  const endsWithPlus = shortcut.endsWith('+');
  const parts = shortcut.split('+');
  const lastPart = parts[parts.length - 1].trim();
  const hasKey = lastPart.length > 0 && !/^(Command|CommandOrControl|Control|Ctrl|Alt|Shift|Super)$/i.test(lastPart);

  return hasModifier && hasSeparator && !endsWithPlus && hasKey;
}

// Helper function to sanitize shortcut format for Electron
function sanitizeShortcut(shortcut) {
  if (!shortcut) return 'CommandOrControl+Space';

  let sanitized = shortcut.replace(/\bCtrl\b/gi, 'CommandOrControl');
  sanitized = sanitized.replace(/\bCmd\b/gi, 'Command');

  return sanitized;
}

// Helper function to get palette window instance
function getPaletteWindow() {
  return paletteWindow;
}

// Safe toggle function for palette
function togglePalette() {
  try {
    console.log('[togglePalette] Starting...');

    const palette = getPaletteWindow();
    if (!palette) {
      console.error('[togglePalette] Palette window not initialized');
      return;
    }

    const win = palette.getWindow();
    console.log('[togglePalette] Window state:', {
      exists: !!win,
      destroyed: win?.isDestroyed?.(),
      visible: win?.isVisible?.()
    });

    if (!win) {
      console.log('[togglePalette] Window is null, creating...');
      palette.create();
      palette.show();
      return;
    }

    if (win.isDestroyed()) {
      console.log('[togglePalette] Window was destroyed, recreating...');
      palette.create();
      palette.show();
      return;
    }

    if (win.isVisible()) {
      console.log('[togglePalette] Hiding palette');
      palette.hide();
    } else {
      console.log('[togglePalette] Showing palette');
      palette.show();
    }
  } catch (error) {
    console.error('[togglePalette] Error:', error);
  }
}

// Function to register the global shortcut
function registerGlobal() {
  const settings = serviceManager.getSettings();
  const shortcut = sanitizeShortcut(settings.globalShortcut) || 'CommandOrControl+Space';
  const searchMode = settings.searchMode || 'app';

  if (!isValidShortcutFormat(shortcut)) {
    console.error('Invalid shortcut format:', shortcut);
    return false;
  }

  try {
    const registered = globalShortcut.register(shortcut, () => {
      // Get CURRENT settings at toggle time, not registration time
      const currentSettings = serviceManager.getSettings();
      const currentSearchMode = currentSettings.searchMode || 'app';

      // For app-only mode, check if the main window is focused
      if (currentSearchMode === 'app') {
        const mainWindow = windowManager.getMainWindow();
        const isMainWindowFocused = mainWindow && (mainWindow.isFocused() || mainWindow.isAlwaysOnTop());

        if (!isMainWindowFocused) {
          console.log('[GlobalShortcut] App-only mode: Main window not focused, ignoring');
          return;
        }
        console.log('[GlobalShortcut] App-only mode: Main window is focused, toggling palette');
      }

      togglePalette();
    });

    if (registered) {
      console.log('Global shortcut registered:', shortcut, 'Mode:', searchMode);
      return true;
    } else {
      console.error('Failed to register global shortcut, trying fallback');
      const fallback = globalShortcut.register('CommandOrControl+Space', () => {
        togglePalette();
      });
      if (fallback) {
        console.log('Fallback shortcut registered');
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('Error registering global shortcut:', error);
    return false;
  }
}

// Function to unregister the global shortcut
function unregisterGlobal() {
  globalShortcut.unregisterAll();
  console.log('Global shortcuts unregistered');
}

// Handle second instance trying to start - focus the existing window instead
app.on('second-instance', (event, commandLine, workingDirectory) => {
  console.log('[Main] Second instance tried to start. Focusing existing window...');
  const mainWindow = windowManager?.getMainWindow();
  if (mainWindow) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    mainWindow.moveTop();
  } else if (windowManager) {
    // If window was destroyed/minimized to tray, recreate it
    windowManager.createMainWindow();
  }
});

app.whenReady().then(() => {
  // Check for tray-only or silent launch mode
  const trayOnly = process.argv.includes('--tray') ||
                   process.argv.includes('--silent') ||
                   process.argv.includes('--startup');

  // Initialize service manager and load configuration
  serviceManager = new ServiceManager();
  serviceManager.loadServices();

  // Create window managers
  windowManager = new WindowManager();
  paletteWindow = new PaletteWindow();

  // Create main window unless in tray-only mode
  if (!trayOnly) {
    windowManager.createMainWindow();
  } else {
    console.log('[Main] Starting in tray-only mode (no main window)');
  }

  // Create tray (always)
  trayManager = new TrayManager(windowManager, serviceManager);
  trayManager.createTray();

  // Setup IPC handlers
  ipcHandler = new IPCHandler(serviceManager, windowManager, paletteWindow, trayManager);
  ipcHandler.register();

  // Get settings
  const settings = serviceManager.getSettings();
  const searchMode = settings.searchMode || 'app';

  // Register global shortcut for BOTH modes
  // The handler inside registerGlobal will check focus for app-only mode
  registerGlobal();

  // Register app shortcut handler (always active - will check mode internally)
  // Use a delay to ensure window is ready, or attach when ready
  function attachShortcutHandler() {
    const mainWindow = windowManager.getMainWindow();
    if (!mainWindow) {
      console.log('[Shortcut] Window not ready, retrying in 500ms...');
      setTimeout(attachShortcutHandler, 500);
      return;
    }

    console.log('[Shortcut] Attaching before-input-event handler');
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Only process in app mode
      const currentSettings = serviceManager.getSettings();
      if (currentSettings.searchMode !== 'app') return;

      // Check if we have any modifiers pressed
      const hasModifier = input.control || input.shift || input.alt || input.meta;
      if (!hasModifier) return;

      // Get the actual key pressed (not modifiers)
      const key = input.key;
      if (!key) return;

      // Ignore modifier-only keys
      if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return;

      // Build the combo
      const keyCombo = [];
      if (input.control) keyCombo.push('Ctrl');
      if (input.shift) keyCombo.push('Shift');
      if (input.alt) keyCombo.push('Alt');
      if (input.meta) keyCombo.push('Cmd');

      // Add the key itself (normalize Space)
      const keyLower = key.toLowerCase();
      if (keyLower === ' ') {
        keyCombo.push('Space');
      } else if (key.length === 1) {
        keyCombo.push(key.toUpperCase());
      } else {
        keyCombo.push(key);
      }

      const pressedShortcut = keyCombo.join('+');
      const expectedShortcut = sanitizeShortcut(currentSettings.globalShortcut || 'Ctrl+Space');

      // Require EXACT match
      if (pressedShortcut === expectedShortcut) {
        console.log('App shortcut triggered:', pressedShortcut);
        event.preventDefault();
        togglePalette();
      }
    });
  }

  // Attach the shortcut handler after a small delay to ensure window is ready
  setTimeout(attachShortcutHandler, 100);

  // Auto-enable first service if none are active
  const enabledServices = serviceManager.getEnabledServices();
  if (enabledServices.length > 0 && !serviceManager.currentServiceId) {
    serviceManager.switchToService(enabledServices[0].id, windowManager);
  }
});

app.on('window-all-closed', () => {
  // Keep running in tray on macOS and Windows
  if (process.platform !== 'darwin') {
    // Keep running
  }
});

app.on('activate', () => {
  if (windowManager && windowManager.getMainWindow() === null) {
    windowManager.createMainWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  serviceManager?.saveServices();
});

// Export helper functions for use in other modules
module.exports = {
  isValidShortcutFormat,
  sanitizeShortcut,
  getPaletteWindow,
  togglePalette,
  registerGlobal,
  unregisterGlobal
};
