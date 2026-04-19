let services = [];
let filteredServices = [];
let selectedIndex = 0;

const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('resultsList');

// Load and display services
async function loadServices() {
    services = await window.mosaikAPI.getEnabledServices();
    filteredServices = [...services];
    selectedIndex = 0;
    renderResults();
}

function renderResults() {
    resultsList.innerHTML = '';

    if (filteredServices.length === 0) {
        resultsList.innerHTML = '<div class="no-results">No services found</div>';
        return;
    }

    filteredServices.forEach((service, index) => {
        const item = document.createElement('div');
        item.className = `result-item ${index === selectedIndex ? 'selected' : ''}`;

        // Icon
        if (service.iconPath) {
            const img = document.createElement('img');
            img.src = service.iconPath;
            img.alt = service.name;
            item.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'icon-placeholder';
            placeholder.textContent = service.name[0].toUpperCase();
            item.appendChild(placeholder);
        }

        // Name
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = service.name;
        item.appendChild(name);

        item.addEventListener('click', () => selectService(service.id));
        resultsList.appendChild(item);
    });
}

function selectService(serviceId) {
    window.mosaikAPI.selectService(serviceId);
}

function filterServices(query) {
    const lowerQuery = query.toLowerCase();
    filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(lowerQuery)
    );
    selectedIndex = 0;
    renderResults();
}

// Search input handling
searchInput.addEventListener('input', (e) => {
    filterServices(e.target.value);
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredServices.length - 1);
            renderResults();
            break;
        case 'ArrowUp':
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            renderResults();
            break;
        case 'Enter':
            e.preventDefault();
            if (filteredServices[selectedIndex]) {
                selectService(filteredServices[selectedIndex].id);
            }
            break;
        case 'Escape':
            e.preventDefault();
            window.mosaikAPI.selectService(null); // Closes palette
            break;
    }
});

// When palette is shown, focus the input
window.mosaikAPI.onPaletteShown(() => {
    searchInput.value = '';
    selectedIndex = 0;
    loadServices();
    setTimeout(() => {
        searchInput.focus();
    }, 50);
});

// Reload when services updated
window.mosaikAPI.onServicesUpdated(() => {
    loadServices();
});

// Initial load
loadServices();
