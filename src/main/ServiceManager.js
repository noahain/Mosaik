const { BrowserView, session, app, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

class ServiceManager {
  constructor() {
    this.services = new Map();
    this.views = new Map();
    this.currentServiceId = null;

    // Store config in user's data directory so it persists between installs
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'services.json');

    console.log('[ServiceManager] userDataPath:', userDataPath);
    console.log('[ServiceManager] configPath:', this.configPath);

    // Also store uploaded icons in user's data
    this.userAssetsPath = path.join(userDataPath, 'assets', 'icons');
    console.log('[ServiceManager] userAssetsPath:', this.userAssetsPath);

    if (!fs.existsSync(this.userAssetsPath)) {
      console.log('[ServiceManager] Creating user assets directory');
      try {
        fs.mkdirSync(this.userAssetsPath, { recursive: true });
        console.log('[ServiceManager] Successfully created user assets directory');
      } catch (error) {
        console.error('[ServiceManager] Failed to create user assets directory:', error);
      }
    }

    this.config = { settings: {} };
  }

  loadServices() {
    try {
      // Create default config if it doesn't exist
      if (!fs.existsSync(this.configPath)) {
        console.log('Creating default services.json at:', this.configPath);
        this.createDefaultConfig();
      }

      const data = fs.readFileSync(this.configPath, 'utf8');
      console.log('[ServiceManager] Loaded services.json content:', data);
      this.config = JSON.parse(data);

      if (!this.config.services || this.config.services.length === 0) {
        console.log('[ServiceManager] No services found in config, creating defaults');
        this.createDefaultConfig();
        // Reload
        const newData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(newData);
      }

      // Track if we need to save (for upgrading old configs)
      let needsSave = false;

      this.config.services.forEach(service => {
        // Ensure isPrivate is set (default to false for backward compatibility)
        if (service.isPrivate === undefined) {
          service.isPrivate = false;
          needsSave = true;
        }
        this.services.set(service.id, {
          ...service,
          view: null,
          lastAccessed: null
        });
      });

      // Save if we added isPrivate to any services
      if (needsSave) {
        console.log('[ServiceManager] Upgrading service config with isPrivate field');
        this.saveServices();
      }
      console.log('[ServiceManager] Loaded', this.services.size, 'services');
      return this.config.services;
    } catch (error) {
      console.error('Failed to load services:', error);
      return [];
    }
  }

  createDefaultConfig() {
    console.log('[ServiceManager] Creating default config...');
    console.log('[ServiceManager] User assets path:', this.userAssetsPath);

    // Simpler approach: try multiple possible paths
    const possiblePaths = [
      // Development paths
      path.join(process.cwd(), 'assets', 'services'),
      path.join(__dirname, '..', '..', 'assets', 'services'),
      path.join(app.getAppPath(), 'assets', 'services'),
      // Production paths
      path.join(process.resourcesPath, 'assets', 'services'),
      path.join(app.getAppPath(), '..', 'assets', 'services'),
    ];

    let bundledIconsPath = null;
    for (const testPath of possiblePaths) {
      console.log('[ServiceManager] Testing path:', testPath, 'exists:', fs.existsSync(testPath));
      if (fs.existsSync(testPath)) {
        bundledIconsPath = testPath;
        console.log('[ServiceManager] Found bundled icons at:', bundledIconsPath);
        break;
      }
    }

    if (!bundledIconsPath) {
      console.error('[ServiceManager] Could not find bundled icons in any location');
      bundledIconsPath = path.join(process.cwd(), 'assets', 'services');
    }

    console.log('[ServiceManager] Using bundled icons path:', bundledIconsPath);

    const defaultIcons = [
      { source: 'chatgpt.png', serviceId: 'chatgpt' },
      { source: 'claude.png', serviceId: 'claude' },
      { source: 'gemini.png', serviceId: 'gemini' }
    ];

    // Copy each default icon if it exists in bundled assets
    defaultIcons.forEach(({ source }) => {
      const sourcePath = path.join(bundledIconsPath, source);
      const destPath = path.join(this.userAssetsPath, source);

      if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
        try {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`[ServiceManager] Copied default icon: ${source} -> ${destPath}`);
        } catch (error) {
          console.error(`[ServiceManager] Failed to copy default icon ${source}:`, error);
        }
      }
    });

    // Set up default services with paths in user data directory
    const defaultServices = [
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        url: 'https://chat.openai.com',
        iconPath: path.join(this.userAssetsPath, 'chatgpt.png'),
        isEnabled: true,
        isPrivate: false,
        alwaysLoaded: false,
        priority: 1
      },
      {
        id: 'claude',
        name: 'Claude',
        url: 'https://claude.ai',
        iconPath: path.join(this.userAssetsPath, 'claude.png'),
        isEnabled: true,
        isPrivate: false,
        alwaysLoaded: false,
        priority: 2
      },
      {
        id: 'gemini',
        name: 'Gemini',
        url: 'https://gemini.google.com',
        iconPath: path.join(this.userAssetsPath, 'gemini.png'),
        isEnabled: true,
        isPrivate: false,
        alwaysLoaded: false,
        priority: 3
      }
    ];

    // Populate this.services Map BEFORE calling saveServices
    defaultServices.forEach(service => {
      this.services.set(service.id, {
        ...service,
        view: null,
        lastAccessed: null
      });
    });

    this.config = {
      services: defaultServices,
      settings: {
        globalShortcut: 'Ctrl+Space',
        searchMode: 'global',
        runAtStartup: false
      }
    };

    this.saveServices();
    console.log('[ServiceManager] Saved default config with', this.services.size, 'services');
  }

  getEnabledServices() {
    return Array.from(this.services.values())
      .filter(s => s.isEnabled)
      .sort((a, b) => a.priority - b.priority)
      .map(s => this.sanitizeService(s));
  }

  getAllServices() {
    return Array.from(this.services.values())
      .sort((a, b) => a.priority - b.priority)
      .map(s => this.sanitizeService(s));
  }

  sanitizeService(service) {
    // Return only serializable properties (no WebContentsView, etc.)
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      iconPath: service.iconPath,
      isEnabled: service.isEnabled,
      isPrivate: service.isPrivate,
      alwaysLoaded: service.alwaysLoaded,
      priority: service.priority
    };
  }

  getServiceById(id) {
    return this.services.get(id);
  }

  createServiceView(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      console.error(`Service ${serviceId} not found`);
      return null;
    }

    if (!service.url) {
      console.error(`Service ${serviceId} has no URL defined`);
      return null;
    }

    // Hybrid Session Isolation: Choose partition based on isPrivate flag
    let partitionName;
    if (service.isPrivate) {
      // Private: Unique isolated folder for this specific service
      partitionName = `persist:private-${service.id}`;
      console.log(`[ServiceManager] Creating private session for ${serviceId}: ${partitionName}`);
    } else {
      // Global: Shared folder for all Global services
      partitionName = 'persist:mosaik-global';
      console.log(`[ServiceManager] Creating global session for ${serviceId}: ${partitionName}`);
    }

    const ses = session.fromPartition(partitionName);

    // Set user agent to avoid blocking
    ses.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    const view = new BrowserView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        sandbox: true
      }
    });

    view.webContents.loadURL(service.url);

    // Inject CSS to hide scrollbars
    view.webContents.on('did-finish-load', () => {
      view.webContents.insertCSS(`
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

    // Handle external links opening in new windows
    view.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const serviceUrl = service.url;
        const serviceDomain = new URL(serviceUrl).hostname;
        const targetUrl = new URL(url);
        const targetDomain = targetUrl.hostname;

        console.log(`[ServiceManager] Window open requested: ${url} from service ${serviceId}`);

        // 1. Allow Google Login redirects only (not regular Google links)
        if (targetDomain.includes('accounts.google.com') ||
            targetDomain.includes('accounts.youtube.com')) {
          console.log('[ServiceManager] Allowing Google login window');
          return { action: 'allow' };
        }

        // 2. Block external domains (including google.com, youtube.com) and open in system browser
        if (!targetDomain.includes(serviceDomain)) {
          console.log(`[ServiceManager] Opening external URL in system browser: ${url}`);
          shell.openExternal(url);
          return { action: 'deny' };
        }

        return { action: 'allow' };
      } catch (e) {
        // If URL parsing fails, assume it's external and open in system browser
        console.error(`[ServiceManager] Error parsing URL ${url}:`, e.message);
        shell.openExternal(url);
        return { action: 'deny' };
      }
    });

    // Handle navigation within the same view
    view.webContents.on('will-navigate', (event, url) => {
      try {
        const serviceUrl = service.url;
        const serviceDomain = new URL(serviceUrl).hostname;
        const targetUrl = new URL(url);

        // Allow navigation within same domain or to Google login only
        if (targetUrl.hostname.includes(serviceDomain) ||
            targetUrl.hostname.includes('accounts.google.com') ||
            targetUrl.hostname.includes('accounts.youtube.com')) {
          return;
        }

        // Block external navigation and open in system browser
        console.log(`[ServiceManager] Blocking external navigation: ${url}`);
        event.preventDefault();
        shell.openExternal(url);
      } catch (e) {
        // If URL parsing fails, block it and open in system browser
        console.error(`[ServiceManager] Error parsing navigation URL ${url}:`, e.message);
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    // Add native context menu for Copy, Paste, and Inspect Element
    view.webContents.on('context-menu', (event, params) => {
      const template = [];

      // Add Cut/Copy/Paste for editable contexts
      if (params.isEditable || params.selectionText) {
        template.push(
          {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            enabled: params.isEditable && params.selectionText,
            click: () => view.webContents.cut()
          },
          {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            enabled: params.selectionText,
            click: () => view.webContents.copy()
          },
          {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            enabled: params.isEditable,
            click: () => view.webContents.paste()
          }
        );
      }

      // Add Select All for editable contexts
      if (params.isEditable) {
        template.push({
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => view.webContents.selectAll()
        });
      }

      // Separator between text editing and dev tools
      if (template.length > 0) {
        template.push({ type: 'separator' });
      }

      // Add Inspect Element for dev/debugging
      template.push({
        label: 'Inspect Element',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => {
          view.webContents.inspectElement(params.x, params.y);
        }
      });

      const menu = Menu.buildFromTemplate(template);
      menu.popup({
        x: Math.round(params.x),
        y: Math.round(params.y)
      });
    });

    this.views.set(serviceId, view);
    service.view = view;
    service.lastAccessed = Date.now();
    return view;
  }

  switchToService(serviceId, windowManager) {
    const service = this.services.get(serviceId);
    if (!service || !service.isEnabled) {
      console.error(`Service ${serviceId} not found or not enabled`);
      return null;
    }

    // Handle current service (the one being switched away from)
    if (this.currentServiceId && this.currentServiceId !== serviceId) {
      const currentService = this.services.get(this.currentServiceId);
      if (currentService && currentService.view) {
        if (currentService.alwaysLoaded) {
          // Keep the view in memory but detach it from the window
          // Do NOT destroy - it stays in this.views Map
          console.log(`Service ${this.currentServiceId} is alwaysLoaded - keeping in RAM`);
        } else {
          // Destroy non-persistent views completely to free RAM
          console.log(`Service ${this.currentServiceId} is not persistent - destroying view`);
          try {
            if (currentService.view.webContents && !currentService.view.webContents.isDestroyed()) {
              currentService.view.webContents.destroy();
            }
          } catch (e) {
            console.error('Error destroying view webContents:', e);
          }
          this.views.delete(this.currentServiceId);
          currentService.view = null;
          currentService.lastAccessed = null;
        }
      }
    }

    // Get or create view
    let view = this.views.get(serviceId);
    if (!view) {
      view = this.createServiceView(serviceId);
    }

    if (!view || !view.webContents) {
      console.error(`Failed to create or retrieve view for service ${serviceId}`);
      return null;
    }

    if (view) {
      // Add to window (WindowManager handles positioning)
      windowManager.setServiceView(view);
      // Update window title
      windowManager.setTitle(`Mosaik - ${service.name}`);
      this.currentServiceId = serviceId;
      service.lastAccessed = Date.now();
    }

    return view;
  }

  unloadService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service || service.alwaysLoaded) {
      return; // Don't unload persistent services
    }

    if (service.view) {
      this.views.delete(serviceId);
      service.view = null;
      service.lastAccessed = null;
    }
  }

  unloadAllNonPersistent() {
    this.services.forEach((service, id) => {
      if (id !== this.currentServiceId && !service.alwaysLoaded) {
        this.unloadService(id);
      }
    });
  }

  updateServiceOrder(orderedIds) {
    orderedIds.forEach((id, index) => {
      const service = this.services.get(id);
      if (service) {
        service.priority = index + 1;
      }
    });
    this.saveServices();
  }

  toggleServiceEnabled(serviceId, enabled) {
    const service = this.services.get(serviceId);
    if (service) {
      service.isEnabled = enabled;
      this.saveServices();
    }
  }

  toggleServiceAlwaysLoaded(serviceId, alwaysLoaded) {
    const service = this.services.get(serviceId);
    if (service) {
      service.alwaysLoaded = alwaysLoaded;
      this.saveServices();
    }
  }

  toggleServicePrivate(serviceId, isPrivate) {
    const service = this.services.get(serviceId);
    if (!service) {
      console.error(`[ServiceManager] Service ${serviceId} not found`);
      return false;
    }

    // Only proceed if the value actually changed
    if (service.isPrivate === isPrivate) {
      return true;
    }

    console.log(`[ServiceManager] Changing ${serviceId} isPrivate from ${service.isPrivate} to ${isPrivate}`);

    // Update the setting
    service.isPrivate = isPrivate;

    // Destroy the view if it exists - session cannot be changed on a live view
    if (service.view) {
      console.log(`[ServiceManager] Destroying view for ${serviceId} - session change requires recreation`);
      try {
        if (service.view.webContents && !service.view.webContents.isDestroyed()) {
          service.view.webContents.destroy();
        }
      } catch (e) {
        console.error('[ServiceManager] Error destroying view webContents:', e);
      }
      this.views.delete(serviceId);
      service.view = null;
      service.lastAccessed = null;
    }

    // Save the updated configuration
    this.saveServices();
    console.log(`[ServiceManager] Service ${serviceId} isPrivate updated and view destroyed if needed`);
    return true;
  }

  addCustomService(serviceData) {
    // Handle icon file copying to user data directory
    let finalIconPath = serviceData.iconPath;
    if (serviceData.iconPath && fs.existsSync(serviceData.iconPath)) {
      try {
        const iconFileName = `${serviceData.id}_${path.basename(serviceData.iconPath)}`;
        const destPath = path.join(this.userAssetsPath, iconFileName);
        fs.copyFileSync(serviceData.iconPath, destPath);
        finalIconPath = destPath;
        console.log(`[ServiceManager] Copied service icon to: ${destPath}`);
      } catch (error) {
        console.error('[ServiceManager] Failed to copy icon file:', error);
        // Fall back to original path if copy fails
        finalIconPath = serviceData.iconPath;
      }
    }

    const newService = {
      id: serviceData.id,
      name: serviceData.name,
      url: serviceData.url,
      iconPath: finalIconPath,
      isEnabled: true,
      isPrivate: serviceData.isPrivate || false,
      alwaysLoaded: false,
      priority: this.services.size + 1
    };

    this.services.set(newService.id, newService);
    this.saveServices();
    return newService;
  }

  saveServices() {
    const services = Array.from(this.services.values()).map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      iconPath: s.iconPath,
      isEnabled: s.isEnabled,
      isPrivate: s.isPrivate || false,
      alwaysLoaded: s.alwaysLoaded,
      priority: s.priority
    }));

    this.config.services = services;

    const configToSave = {
      services: services,
      settings: this.config.settings || {
        globalShortcut: 'Ctrl+Space',
        searchMode: 'app',
        runAtStartup: false
      }
    };

    fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2));
  }

  updateSettings(settings) {
    if (!this.config.settings) {
      this.config.settings = {};
    }
    Object.assign(this.config.settings, settings);
    this.saveServices();
  }

  getSettings() {
    return this.config.settings || {
      globalShortcut: 'Ctrl+Space',
      searchMode: 'app',
      runAtStartup: false
    };
  }
}

module.exports = ServiceManager;
