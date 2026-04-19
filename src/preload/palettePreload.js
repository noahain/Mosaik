const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mosaikAPI', {
  getEnabledServices: () => ipcRenderer.invoke('get-enabled-services'),
  selectService: (serviceId) => ipcRenderer.invoke('select-service', serviceId),
  onPaletteShown: (callback) => ipcRenderer.on('palette-shown', callback),
  onServicesUpdated: (callback) => ipcRenderer.on('services-updated', callback)
});
