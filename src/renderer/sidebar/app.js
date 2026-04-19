// Debug: Check if mosaikAPI is available
if (typeof window.mosaikAPI === 'undefined') {
  console.error('[Sidebar] CRITICAL: window.mosaikAPI is not defined!');
  document.body.innerHTML = '<div style="color:red; padding:20px;">Error: mosaikAPI not loaded</div>';
} else {
  console.log('[Sidebar] mosaikAPI loaded successfully:', Object.keys(window.mosaikAPI));
}

let currentServiceId = null;

// Search button click handler - send toggle-palette IPC
document.getElementById('searchBtn').addEventListener('click', () => {
  console.log('[Sidebar] Search button clicked - toggling palette');
  if (window.mosaikAPI && typeof window.mosaikAPI.togglePalette === 'function') {
    window.mosaikAPI.togglePalette().then(result => {
      console.log('[Sidebar] togglePalette result:', result);
    }).catch(err => {
      console.error('[Sidebar] togglePalette error:', err);
    });
  } else {
    console.error('[Sidebar] togglePalette method not available on mosaikAPI');
  }
});

// Listen for service changes from main process
if (window.mosaikAPI && window.mosaikAPI.onServiceChanged) {
  window.mosaikAPI.onServiceChanged((event, serviceId) => {
    console.log('[Sidebar] Service changed to:', serviceId);
    currentServiceId = serviceId;
    updateActiveService();
  });
}

// Update sidebar services list with enabled services
async function loadServices() {
  try {
    console.log('[Sidebar] Loading enabled services...');

    if (!window.mosaikAPI || !window.mosaikAPI.getEnabledServices) {
      console.error('[Sidebar] getEnabledServices not available');
      return;
    }

    const services = await window.mosaikAPI.getEnabledServices();
    console.log('[Sidebar] Received services:', services);

    if (!Array.isArray(services)) {
      console.error('[Sidebar] Services is not an array:', services);
      return;
    }

    const container = document.getElementById('service-buttons');
    if (!container) {
      console.error('[Sidebar] Container #service-buttons not found');
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    if (services.length === 0) {
      console.warn('[Sidebar] No enabled services found');
      container.innerHTML = '<div style="color:#888; font-size:12px; text-align:center; padding:10px;">No services enabled</div>';
      return;
    }

    // Render service buttons
    services.forEach(service => {
      const button = document.createElement('div');
      button.className = `service-item ${service.id === currentServiceId ? 'active' : ''}`;
      button.dataset.serviceId = service.id;
      button.title = service.name;
      button.style.cursor = 'pointer';

      // Use icon if available, otherwise show first letter
      if (service.iconPath) {
        const img = document.createElement('img');
        img.src = service.iconPath;
        img.alt = service.name;
        img.style.width = '24px';
        img.style.height = '24px';

        img.onerror = () => {
          console.warn(`[Sidebar] Icon failed to load for ${service.name}`);
          img.style.display = 'none';
          const letter = createLetterIcon(service.name);
          button.appendChild(letter);
        };
        button.appendChild(img);
      } else {
        const letter = createLetterIcon(service.name);
        button.appendChild(letter);
      }

      // Click handler
      button.addEventListener('click', () => {
        console.log('[Sidebar] Service clicked:', service.id);
        if (window.mosaikAPI && window.mosaikAPI.selectService) {
          window.mosaikAPI.selectService(service.id);
        } else {
          console.error('[Sidebar] selectService not available');
        }
      });

      container.appendChild(button);
    });

    console.log(`[Sidebar] Rendered ${services.length} service buttons`);
  } catch (error) {
    console.error('[Sidebar] Error loading services:', error);
    const container = document.getElementById('service-buttons');
    if (container) {
      container.innerHTML = `<div style="color:red; font-size:10px; text-align:center; padding:10px;">Error: ${error.message}</div>`;
    }
  }
}

function createLetterIcon(name) {
  const letter = document.createElement('div');
  letter.textContent = name[0].toUpperCase();
  letter.className = 'icon-letter';
  letter.style.cssText = `
    color: #fff;
    font-weight: bold;
    font-size: 14px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: hsl(${name.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 360}, 60%, 35%);
    border-radius: 6px;
  `;
  return letter;
}

function updateActiveService() {
  document.querySelectorAll('.service-item').forEach(item => {
    item.classList.toggle('active', item.dataset.serviceId === currentServiceId);
  });
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Sidebar] DOM content loaded, loading services...');
  loadServices();
});

// Fallback retry
setTimeout(() => {
  const container = document.getElementById('service-buttons');
  if (container && container.children.length === 0) {
    console.log('[Sidebar] Retrying service load...');
    loadServices();
  }
}, 2000);

// Reload when services updated
if (window.mosaikAPI && window.mosaikAPI.onServicesUpdated) {
  window.mosaikAPI.onServicesUpdated(() => {
    console.log('[Sidebar] Services updated - reloading');
    loadServices();
  });
}
