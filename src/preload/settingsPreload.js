const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Settings preload script loading...');

contextBridge.exposeInMainWorld('mosaikAPI', {
  // Services
  getAllServices: async () => {
    try {
      const result = await ipcRenderer.invoke('get-all-services');
      console.log('[Preload] getAllServices result:', result?.length);
      return result;
    } catch (error) {
      console.error('[Preload] getAllServices error:', error);
      return [];
    }
  },

  updateServiceOrder: async (orderedIds) => {
    try {
      const result = await ipcRenderer.invoke('update-service-order', orderedIds);
      return result;
    } catch (error) {
      console.error('[Preload] updateServiceOrder error:', error);
      return { success: false };
    }
  },

  toggleServiceEnabled: async (serviceId, enabled) => {
    try {
      const result = await ipcRenderer.invoke('toggle-service-enabled', { serviceId, enabled });
      return result;
    } catch (error) {
      console.error('[Preload] toggleServiceEnabled error:', error);
      return { success: false };
    }
  },

  toggleServiceAlwaysLoaded: async (serviceId, alwaysLoaded) => {
    try {
      const result = await ipcRenderer.invoke('toggle-service-always-loaded', { serviceId, alwaysLoaded });
      return result;
    } catch (error) {
      console.error('[Preload] toggleServiceAlwaysLoaded error:', error);
      return { success: false };
    }
  },

  toggleServicePrivate: async (serviceId, isPrivate) => {
    try {
      console.log('[Preload] toggleServicePrivate:', serviceId, isPrivate);
      const result = await ipcRenderer.invoke('toggle-service-private', { serviceId, isPrivate });
      return result;
    } catch (error) {
      console.error('[Preload] toggleServicePrivate error:', error);
      return { success: false };
    }
  },

  updateServiceSettings: async (serviceId, settings) => {
    try {
      const result = await ipcRenderer.invoke('update-service-settings', { serviceId, settings });
      return result;
    } catch (error) {
      console.error('[Preload] updateServiceSettings error:', error);
      return { success: false };
    }
  },

  addCustomService: async (serviceData) => {
    try {
      const result = await ipcRenderer.invoke('add-custom-service', serviceData);
      return result;
    } catch (error) {
      console.error('[Preload] addCustomService error:', error);
      return { success: false };
    }
  },

  // Settings
  saveSettings: async (settings) => {
    try {
      console.log('[Preload] saveSettings called:', settings);
      const result = await ipcRenderer.invoke('save-settings', settings);
      console.log('[Preload] saveSettings result:', result);
      return result;
    } catch (error) {
      console.error('[Preload] saveSettings error:', error);
      return { success: false, error: error.message };
    }
  },

  getSettings: async () => {
    try {
      const result = await ipcRenderer.invoke('get-settings');
      console.log('[Preload] getSettings result:', result);
      return result;
    } catch (error) {
      console.error('[Preload] getSettings error:', error);
      return {};
    }
  },

  // Event listeners
  onServicesUpdated: (callback) => {
    ipcRenderer.removeAllListeners('services-updated');
    ipcRenderer.on('services-updated', (event, services) => {
      console.log('[Preload] services-updated event received');
      callback(event, services);
    });
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('[Preload] Settings preload script loaded successfully');
