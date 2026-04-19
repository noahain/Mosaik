let services = [];

const serviceList = document.getElementById('servicesContainer');
const addServiceBtn = document.getElementById('addServiceBtn');
const addServiceModal = document.getElementById('addServiceModal');
const closeModal = document.getElementById('closeModal');
const cancelAdd = document.getElementById('cancelAdd');
const addServiceForm = document.getElementById('addServiceForm');

// Load services
async function loadServices() {
  services = await window.mosaikAPI.getAllServices();
  renderServices();
}

function renderServices() {
  serviceList.innerHTML = '';

  services.forEach(service => {
    const item = document.createElement('div');
    item.className = 'service-item';

    // Service info
    const info = document.createElement('div');
    info.className = 'service-info';

    if (service.iconPath) {
      const img = document.createElement('img');
      img.src = service.iconPath;
      img.alt = service.name;
      info.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'icon-placeholder';
      placeholder.textContent = service.name[0].toUpperCase();
      info.appendChild(placeholder);
    }

    const name = document.createElement('span');
    name.textContent = service.name;
    info.appendChild(name);

    item.appendChild(info);

    // Controls container
    const controls = document.createElement('div');
    controls.className = 'service-controls';

    // Enabled toggle
    const enabledContainer = document.createElement('div');
    enabledContainer.className = 'control-item';
    const enabledLabel = document.createElement('span');
    enabledLabel.textContent = 'Enabled';
    const enabledToggle = document.createElement('div');
    enabledToggle.className = `toggle ${service.isEnabled ? 'active' : ''}`;
    enabledToggle.title = 'Enable/disable this service';
    enabledToggle.addEventListener('click', () => {
      service.isEnabled = !service.isEnabled;
      window.mosaikAPI.toggleServiceEnabled(service.id, service.isEnabled);
      enabledToggle.classList.toggle('active', service.isEnabled);
    });
    enabledContainer.appendChild(enabledLabel);
    enabledContainer.appendChild(enabledToggle);
    controls.appendChild(enabledContainer);

    // Always Loaded toggle
    const alwaysLoadedContainer = document.createElement('div');
    alwaysLoadedContainer.className = 'control-item';
    const alwaysLoadedLabel = document.createElement('span');
    alwaysLoadedLabel.textContent = 'Always Loaded';
    const alwaysLoadedToggle = document.createElement('div');;
    alwaysLoadedToggle.className = `toggle ${service.alwaysLoaded ? 'active' : ''}`;
    alwaysLoadedToggle.title = 'Keep service in RAM for faster switching';
    alwaysLoadedToggle.addEventListener('click', async () => {
      service.alwaysLoaded = !service.alwaysLoaded;
      alwaysLoadedToggle.classList.toggle('active', service.alwaysLoaded);
      await window.mosaikAPI.toggleServiceAlwaysLoaded(service.id, service.alwaysLoaded);
    });
    alwaysLoadedContainer.appendChild(alwaysLoadedLabel);
    alwaysLoadedContainer.appendChild(alwaysLoadedToggle);
    controls.appendChild(alwaysLoadedContainer);

    // Private Session toggle with tooltip
    const privateContainer = document.createElement('div');
    privateContainer.className = 'control-item';
    const privateLabel = document.createElement('span');
    privateLabel.textContent = 'Private Session ';
    const tooltip = document.createElement('span');
    tooltip.className = 'tooltip';
    tooltip.textContent = '(?)';
    tooltip.title = 'If ON, this service gets its own cookies. If OFF, it shares cookies with other Global services (useful for Google/Microsoft logins)';
    privateLabel.appendChild(tooltip);

    const privateToggle = document.createElement('div');
    privateToggle.className = `toggle ${service.isPrivate ? 'active' : ''}`;
    privateToggle.title = tooltip.title;
    privateToggle.addEventListener('click', async () => {
      const newValue = !service.isPrivate;
      console.log('Toggling private session for', service.id, 'from', service.isPrivate, 'to', newValue);
      service.isPrivate = newValue;
      privateToggle.classList.toggle('active', newValue);
      await window.mosaikAPI.toggleServicePrivate(service.id, newValue);
    });
    privateContainer.appendChild(privateLabel);
    privateContainer.appendChild(privateToggle);
    controls.appendChild(privateContainer);

    item.appendChild(controls);
    serviceList.appendChild(item);
  });
}

// Modal handling
addServiceBtn.addEventListener('click', () => {
  addServiceModal.classList.add('show');
});

closeModal.addEventListener('click', closeModalFn);
cancelAdd.addEventListener('click', closeModalFn);

function closeModalFn() {
  addServiceModal.classList.remove('show');
  addServiceForm.reset();
}

// Add service form
addServiceForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const iconInput = document.getElementById('serviceIcon');
  let iconPath = '';

  if (iconInput.files && iconInput.files.length > 0) {
    // Get the selected file path
    iconPath = iconInput.files[0].path;
    console.log('Icon file selected:', iconPath);
  } else if (iconInput.value) {
    // Fallback to manual path entry
    iconPath = iconInput.value;
    console.log('Icon path entered:', iconPath);
  }

  const serviceData = {
    id: document.getElementById('serviceName').value.toLowerCase().replace(/\s+/g, '-'),
    name: document.getElementById('serviceName').value,
    url: document.getElementById('serviceUrl').value,
    iconPath: iconPath,
    isEnabled: true,
    isPrivate: document.getElementById('serviceIsPrivate')?.checked || false,
    alwaysLoaded: false
  };

  console.log('Adding service with data:', serviceData);

  await window.mosaikAPI.addCustomService(serviceData);
  closeModalFn();
  loadServices();
});

// Listen for service updates
window.mosaikAPI.onServicesUpdated(() => {
  loadServices();
});

// Shortcut recording functionality
const shortcutInput = document.getElementById('globalShortcut');
const recordBtn = document.getElementById('recordShortcutBtn');
const shortcutEditor = document.querySelector('.shortcut-editor');
let isRecording = false;
let pendingShortcut = null;

recordBtn.addEventListener('click', () => {
  if (isRecording) {
    cancelRecording();
  } else {
    startRecording();
  }
});

function startRecording() {
  isRecording = true;
  pendingShortcut = null;
  shortcutEditor.classList.add('recording');
  recordBtn.textContent = 'Cancel';
  recordBtn.classList.add('recording');
  shortcutInput.value = 'Recording... Press keys';
  shortcutInput.placeholder = 'Press modifier + key combination';

  // Listen for the next key combination
  document.addEventListener('keydown', handleKeyRecording);
  document.addEventListener('keyup', handleKeyRecordingEnd);
}

function cancelRecording() {
  isRecording = false;
  pendingShortcut = null;
  shortcutEditor.classList.remove('recording');
  recordBtn.classList.remove('recording');
  recordBtn.textContent = 'Edit';

  // Restore previous value if exists
  window.mosaikAPI.getSettings().then(settings => {
    shortcutInput.value = settings.globalShortcut || 'Ctrl+Space';
  });

  document.removeEventListener('keydown', handleKeyRecording);
  document.removeEventListener('keyup', handleKeyRecordingEnd);
}

function stopRecording() {
  isRecording = false;
  shortcutEditor.classList.remove('recording');
  recordBtn.classList.remove('recording');
  recordBtn.textContent = 'Edit';
  document.removeEventListener('keydown', handleKeyRecording);
  document.removeEventListener('keyup', handleKeyRecordingEnd);
}

let currentCombo = null;
let modifiersPressed = new Set();
let lastKeyPressed = null;

function handleKeyRecording(e) {
  e.preventDefault();
  e.stopPropagation();

  const key = e.key;

  // Track modifier keys
  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
    modifiersPressed.add(key);
    updateShortcutPreview();
    return;
  }

  // Handle spacebar specifically (prevents scrolling)
  if (e.code === 'Space' || key === ' ') {
    lastKeyPressed = 'Space';
    updateShortcutPreview();
    return;
  }

  // Ignore if no modifiers are pressed (require at least one)
  if (modifiersPressed.size === 0) {
    shortcutInput.value = 'Hold Ctrl, Alt, or Shift...';
    return;
  }

  lastKeyPressed = key;
  updateShortcutPreview();
}

function updateShortcutPreview() {
  if (modifiersPressed.size === 0 && !lastKeyPressed) {
    shortcutInput.value = 'Recording... Press keys';
    return;
  }

  const modifiers = [];
  if (modifiersPressed.has('Control')) modifiers.push('Ctrl');
  if (modifiersPressed.has('Alt')) modifiers.push('Alt');
  if (modifiersPressed.has('Shift')) modifiers.push('Shift');
  if (modifiersPressed.has('Meta')) modifiers.push('Cmd');

  if (lastKeyPressed) {
    const combo = [...modifiers, lastKeyPressed].join('+');
    currentCombo = combo;
    shortcutInput.value = `${combo} (Press Enter to save)`;
  } else {
    shortcutInput.value = `${modifiers.join('+')} + ...`;
  }
}

function handleKeyRecordingEnd(e) {
  const key = e.key;

  // Remove modifier from tracking
  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
    modifiersPressed.delete(key);
    return;
  }

  // Check if Enter was pressed to confirm
  if (key === 'Enter' && currentCombo && modifiersPressed.size === 0) {
    e.preventDefault();
    confirmShortcut(currentCombo);
    return;
  }

  // If all keys are released and we have a combo, wait for Enter
  if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
    if (currentCombo && lastKeyPressed) {
      // Show confirmation state
      shortcutInput.value = `${currentCombo} (Press Enter to save)`;
    }
  }
}

function confirmShortcut(shortcut) {
  // Convert to Electron's expected format
  const electronShortcut = convertToElectronShortcut(shortcut);

  // Validate it has both modifiers and a key
  if (!isValidShortcut(electronShortcut)) {
    shortcutInput.value = 'Invalid shortcut. Try again.';
    setTimeout(() => {
      if (isRecording) {
        shortcutInput.value = 'Recording... Press keys';
      }
    }, 1500);
    return;
  }

  // Save the shortcut
  saveShortcut(electronShortcut);
  stopRecording();
}

function convertToElectronShortcut(shortcut) {
  // Convert from web key names to Electron's expected format
  return shortcut
    .replace(/Ctrl/g, 'CommandOrControl')
    .replace(/Cmd/g, 'Command');
}

function isValidShortcut(shortcut) {
  // Must contain at least one modifier and a non-modifier key
  const hasModifier = /Command|CommandOrControl|Alt|Shift|Ctrl|Super/.test(shortcut);
  const parts = shortcut.split('+');
  const lastPart = parts[parts.length - 1];
  const hasKey = lastPart && !/Command|CommandOrControl|Alt|Shift|Ctrl|Super/.test(lastPart);

  return hasModifier && hasKey;
}

async function saveShortcut(shortcut) {
  try {
    // Save to configuration
    await window.mosaikAPI.saveSettings({ globalShortcut: shortcut });
    shortcutInput.value = shortcut;
  } catch (error) {
    console.error('Failed to save shortcut:', error);
    shortcutInput.value = 'Error saving shortcut';
  }
}

// Initialize shortcut display
(async function initShortcutDisplay() {
  const settings = await window.mosaikAPI.getSettings();
  if (settings && settings.globalShortcut) {
    shortcutInput.value = settings.globalShortcut;
  }
})();

// Search mode toggle
const searchModeToggle = document.getElementById('searchModeToggle');
const searchModeLabel = document.getElementById('searchModeLabel');
let isGlobalMode = true;

// Initialize from settings
(async function initSearchModeToggle() {
  const settings = await window.mosaikAPI.getSettings();
  if (settings && settings.searchMode) {
    isGlobalMode = settings.searchMode === 'global';
    if (searchModeToggle) {
      searchModeToggle.classList.toggle('active', isGlobalMode);
    }
    if (searchModeLabel) {
      searchModeLabel.textContent = isGlobalMode ? 'Global' : 'App-only';
    }
  }
})();

if (searchModeToggle) {
  searchModeToggle.addEventListener('click', async () => {
    isGlobalMode = !isGlobalMode;
    searchModeToggle.classList.toggle('active', isGlobalMode);
    if (searchModeLabel) {
      searchModeLabel.textContent = isGlobalMode ? 'Global' : 'App-only';
    }

    await window.mosaikAPI.saveSettings({ searchMode: isGlobalMode ? 'global' : 'app' });
  });
}

// Initial load
loadServices();
