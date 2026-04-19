const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('mosaikAPI', {
  // Services
  getEnabledServices: async () => {
    try {
      const result = await ipcRenderer.invoke('get-enabled-services');
      console.log('[Preload] getEnabledServices result:', result);
      return result;
    } catch (error) {
      console.error('[Preload] getEnabledServices error:', error);
      return [];
    }
  },

  selectService: async (serviceId) => {
    try {
      console.log('[Preload] selectService called:', serviceId);
      const result = await ipcRenderer.invoke('select-service', serviceId);
      console.log('[Preload] selectService result:', result);
      return result;
    } catch (error) {
      console.error('[Preload] selectService error:', error);
      return { success: false, error: error.message };
    }
  },

  // Palette
  togglePalette: async () => {
    try {
      console.log('[Preload] togglePalette called');
      const result = await ipcRenderer.invoke('toggle-palette');
      return result;
    } catch (error) {
      console.error('[Preload] togglePalette error:', error);
      return { success: false, error: error.message };
    }
  },

  showPalette: async () => {
    try {
      const result = await ipcRenderer.invoke('show-palette');
      return result;
    } catch (error) {
      console.error('[Preload] showPalette error:', error);
      return { success: false, error: error.message };
    }
  },

  // Event listeners
  onServicesUpdated: (callback) => {
    // Remove existing listener to prevent duplicates
    ipcRenderer.removeAllListeners('services-updated');
    ipcRenderer.on('services-updated', (event, services) => {
      console.log('[Preload] services-updated event received');
      callback(event, services);
    });
  },

  onServiceChanged: (callback) => {
    ipcRenderer.removeAllListeners('service-changed');
    ipcRenderer.on('service-changed', (event, serviceId) => {
      console.log('[Preload] service-changed event:', serviceId);
      callback(event, serviceId);
    });
  },

  onPaletteShown: (callback) => {
    ipcRenderer.removeAllListeners('palette-shown');
    ipcRenderer.on('palette-shown', (event) => {
      console.log('[Preload] palette-shown event');
      callback(event);
    });
  }
});

console.log('[Preload] Sidebar preload script loaded successfully');
