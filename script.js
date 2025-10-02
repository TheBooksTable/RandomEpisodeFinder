const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
let openOnRender = null;
let draggedItem = null;
let draggedItemType = null; // 'show' or 'episode'
let searchTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

const SURPRISE_LIST = [
   'Breaking Bad','The Office','Friends','SpongeBob SquarePants',
  'Rick and Morty','Stranger Things','The Simpsons','Archer',
  'Seinfeld','Avatar: The Last Airbender','Smiling Friends',
  'BoJack Horseman','Black Mirror','Brooklyn Nine-Nine',
  'Supernatural','South Park','Twin Peaks','Fargo',
  'Better Call Saul','Infinity Train','Kipo and the Age of Wonderbeasts',
  'Tuca & Bertie','Final Space','The Midnight Gospel','Undone',
  'Close Enough','Hilda','F Is for Family','Solar Opposites',
  'Golan the Insatiable','Adventure Time: Distant Lands','Over the Garden Wall',
  'Primal','Magical Girl Raising Project','Welcome to the Ballroom',
  'Aggretsuko','Bee and PuppyCat','King Star King','The Shivering Truth',
  '12 oz. Mouse','The Brak Show','Drawn Together','Superjail!',
  'Gravity Falls','Invincible','Daria','Community','Arrested Development',
  'Rick & Morty: The Vindicators','BoJack Horseman: Horsin’ Around Specials',
  'The Venture Bros.','Futurama','The Legend of Korra','Love, Death & Robots',
  'The Owl House','Castlevania','Animaniacs (2020)','Young Justice'
];

const SHOW_THEMES = {
  'The Simpsons': 'simpsons',
  'Breaking Bad': 'breakingbad',
  'Better Call Saul': 'breakingbad',
  'Smiling Friends': 'smilingfriends',
  'Rick and Morty': 'rickandmorty',
  'Adventure Time': 'adventuretime',
  'Adventure Time: Distant Lands': 'adventuretime',
  'Gravity Falls': 'gravityfalls',
  'Stranger Things': 'strangerthings',
  'The Office': 'theoffice',
  'SpongeBob SquarePants': 'spongebob',
  'BoJack Horseman': 'bojack',
  'Futurama': 'futurama',
  'Avatar: The Last Airbender': 'avatar',
  'The Legend of Korra': 'avatar',
  'South Park': 'southpark',
  'Over the Garden Wall': 'overthegardenwall',
  'The Midnight Gospel': 'midnightgospel',
  'Friends': 'friends',
  'Black Mirror': 'blackmirror',
  'Brooklyn Nine-Nine': 'brooklynninenine'
};

/* ----------------------------
   Search Autocomplete
---------------------------- */
function initSearchAutocomplete() {
  const searchInput = $("searchInput");
  const suggestionsContainer = $("searchSuggestions");

  // Input event with debouncing
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Hide suggestions if query is too short
    if (query.length < 2) {
      hideSuggestions();
      return;
    }
    
    // Show loading state
    showLoadingSuggestions();
    
    // Debounce API calls
    searchTimeout = setTimeout(() => {
      fetchSearchSuggestions(query);
    }, 300);
  });

  // Keyboard navigation
  searchInput.addEventListener("keydown", (e) => {
    if (!suggestionsContainer.classList.contains("hidden")) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          navigateSuggestions(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigateSuggestions(-1);
          break;
        case 'Enter':
          e.preventDefault();
          selectCurrentSuggestion();
          break;
        case 'Escape':
          hideSuggestions();
          break;
      }
    }
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Prevent hiding when clicking inside suggestions
  suggestionsContainer.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

async function fetchSearchSuggestions(query) {
  try {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    currentSuggestions = data.slice(0, 8); // Limit to 8 suggestions
    displaySuggestions(currentSuggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    showErrorSuggestions();
  }
}

function displaySuggestions(suggestions) {
  const container = $("searchSuggestions");
  
  if (suggestions.length === 0) {
    container.innerHTML = '<div class="suggestion-no-results">No shows found</div>';
    container.classList.remove("hidden");
    return;
  }
  
  const suggestionsHTML = suggestions.map((result, index) => {
    const show = result.show;
    const image = show.image?.medium || 'https://via.placeholder.com/40x40/333/fff?text=TV';
    const year = show.premiered ? new Date(show.premiered).getFullYear() : 'N/A';
    const type = show.type || 'Show';
    
    return `
      <div class="search-suggestion ${index === selectedSuggestionIndex ? 'active' : ''}" 
           data-index="${index}" 
           data-show-name="${show.name}">
        <img src="${image}" alt="${show.name}" class="suggestion-image" onerror="this.src='https://via.placeholder.com/40x40/333/fff?text=TV'">
        <div class="suggestion-info">
          <div class="suggestion-name">${show.name}</div>
          <div class="suggestion-details">
            <span class="suggestion-year">${year}</span>
            <span class="suggestion-type">${type}</span>
            ${show.genres?.slice(0, 2).map(genre => `<span>${genre}</span>`).join('') || ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = suggestionsHTML;
  container.classList.remove("hidden");
  
  // Add click event listeners to suggestions
  container.querySelectorAll('.search-suggestion').forEach(suggestion => {
    suggestion.addEventListener('click', () => {
      const index = parseInt(suggestion.dataset.index);
      selectSuggestion(index);
    });
  });
}

function showLoadingSuggestions() {
  const container = $("searchSuggestions");
  container.innerHTML = '<div class="suggestion-loading">Searching...</div>';
  container.classList.remove("hidden");
  selectedSuggestionIndex = -1;
}

function showErrorSuggestions() {
  const container = $("searchSuggestions");
  container.innerHTML = '<div class="suggestion-no-results">Error loading suggestions</div>';
  container.classList.remove("hidden");
}

function hideSuggestions() {
  const container = $("searchSuggestions");
  container.classList.add("hidden");
  selectedSuggestionIndex = -1;
}

function navigateSuggestions(direction) {
  if (currentSuggestions.length === 0) return;
  
  selectedSuggestionIndex += direction;
  
  // Cycle through suggestions
  if (selectedSuggestionIndex < 0) {
    selectedSuggestionIndex = currentSuggestions.length - 1;
  } else if (selectedSuggestionIndex >= currentSuggestions.length) {
    selectedSuggestionIndex = 0;
  }
  
  // Update active class
  const suggestions = $("searchSuggestions").querySelectorAll('.search-suggestion');
  suggestions.forEach((suggestion, index) => {
    suggestion.classList.toggle('active', index === selectedSuggestionIndex);
  });
  
  // Scroll into view if needed
  if (suggestions[selectedSuggestionIndex]) {
    suggestions[selectedSuggestionIndex].scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }
}

function selectCurrentSuggestion() {
  if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
    selectSuggestion(selectedSuggestionIndex);
  } else {
    // If no suggestion selected, perform regular search
    $("searchBtn").click();
    hideSuggestions();
  }
}

function selectSuggestion(index) {
  const selectedShow = currentSuggestions[index].show;
  
  // Fill search input with selected show name
  $("searchInput").value = selectedShow.name;
  
  // Perform search
  doSearch(selectedShow.name);
  
  // Hide suggestions
  hideSuggestions();
}

/* ----------------------------
   Enhanced Notification System
---------------------------- */
function showNotification(message, type = "info", title = null, duration = 4000) {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  });

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: '💡'
  };
  
  const defaultTitles = {
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    info: 'Info'
  };
  
  notification.innerHTML = `
    <div class="notification-icon">${icons[type] || icons.info}</div>
    <div class="notification-content">
      <div class="notification-title">${title || defaultTitles[type]}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close">✕</button>
  `;
  
  document.body.appendChild(notification);
  
  // Add close button functionality
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  });
  
  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }
  
  return notification;
}

/* ----------------------------
   Custom Confirmation Modal
---------------------------- */
function showConfirmationModal(message, confirmText = "Confirm", cancelText = "Cancel") {
  return new Promise((resolve) => {
    const modal = $("confirmationModal");
    const modalContent = modal.querySelector(".modal-content");
    const messageElement = modal.querySelector(".modal-body p");
    const confirmBtn = $("modalConfirm");
    const cancelBtn = $("modalCancel");
    
    // Set modal content
    messageElement.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    
    // Show modal
    modal.classList.remove("hidden");
    
    // Remove any existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Add event listeners
    newConfirmBtn.addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
    
    newCancelBtn.addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
        resolve(false);
      }
    });
    
    // Close on escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeModal();
        resolve(false);
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
    
    function closeModal() {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.classList.add("hidden");
        modal.classList.remove("closing");
        document.removeEventListener("keydown", handleEscape);
      }, 300);
    }
  });
}

/* ----------------------------
   Theme Management
---------------------------- */
function initTheme() {
  const savedTheme = localStorage.getItem('ref-theme') || 'dark';
  const showThemeEnabled = localStorage.getItem('ref-show-theme') === 'true';
  
  $('themeToggle').checked = savedTheme === 'light';
  $('showThemeToggle').checked = showThemeEnabled;
  
  setTheme(savedTheme);
  updateShowTheme(currentShow, showThemeEnabled);
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('ref-theme', theme);
}

function toggleTheme() {
  const newTheme = $('themeToggle').checked ? 'light' : 'dark';
  setTheme(newTheme);
  updateShowTheme(currentShow, $('showThemeToggle').checked);
}

function toggleShowTheme() {
  const enabled = $('showThemeToggle').checked;
  localStorage.setItem('ref-show-theme', enabled);
  updateShowTheme(currentShow, enabled);
}

function updateShowTheme(show, enabled) {
  if (!enabled || !show) {
    const currentTheme = $('themeToggle').checked ? 'light' : 'dark';
    setTheme(currentTheme);
    return;
  }
  
  const themeName = SHOW_THEMES[show.name];
  if (themeName) {
    setTheme(themeName);
  } else {
    const currentTheme = $('themeToggle').checked ? 'light' : 'dark';
    setTheme(currentTheme);
  }
}

/* ----------------------------
   Favorites utils
---------------------------- */
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem("ref-favs") || "[]");
  } catch (e) {
    return [];
  }
}

function saveFavorites(list) {
  localStorage.setItem("ref-favs", JSON.stringify(list));
}

function ensureFav(show) {
  let favs = loadFavorites();
  let fav = favs.find(f => f.id === show.id);
  if (!fav) {
    fav = {
      id: show.id,
      name: show.name,
      episodes: { watchlist: [], watched: [] },
      order: favs.length // Add order for drag & drop
    };
    favs.push(fav);
    saveFavorites(favs);
  }
  return fav;
}

/* ----------------------------
   Drag & Drop Functionality
---------------------------- */
function initDragAndDrop() {
  const container = $("favoritesList");
  
  // Drag start for shows
  container.addEventListener("dragstart", (e) => {
    if (e.target.classList.contains("drag-handle") || e.target.classList.contains("episode-drag-handle")) {
      draggedItem = e.target.closest("details") || e.target.closest("li");
      draggedItemType = e.target.closest("details") ? "show" : "episode";
      
      draggedItem.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      
      // Set drag image to the element itself
      setTimeout(() => {
        draggedItem.style.opacity = "0.5";
      }, 0);
    }
  });
  
  // Drag over for shows and episodes
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    
    const afterElement = getDragAfterElement(container, e.clientY);
    const draggable = document.querySelector(".dragging");
    
    if (draggable && afterElement && afterElement.element) {
      if (draggable === afterElement.element) return;
      
      // Remove drag-over class from all elements
      document.querySelectorAll(".drag-over").forEach(el => {
        el.classList.remove("drag-over");
      });
      
      // Add drag-over class to the element we're hovering over
      afterElement.element.classList.add("drag-over");
    }
  });
  
  // Drop for shows and episodes
  container.addEventListener("drop", (e) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    // Remove drag-over class from all elements
    document.querySelectorAll(".drag-over").forEach(el => {
      el.classList.remove("drag-over");
    });
    
    const afterElement = getDragAfterElement(container, e.clientY);
    const containerEl = afterElement ? afterElement.container : container;
    
    if (draggedItemType === "show") {
      handleShowReorder(draggedItem, afterElement ? afterElement.element : null);
    } else {
      handleEpisodeReorder(draggedItem, afterElement ? afterElement.element : null);
    }
    
    draggedItem.classList.remove("dragging");
    draggedItem.style.opacity = "";
    draggedItem = null;
    draggedItemType = null;
  });
  
  // Drag end cleanup
  container.addEventListener("dragend", () => {
    if (draggedItem) {
      draggedItem.classList.remove("dragging");
      draggedItem.style.opacity = "";
      draggedItem = null;
      draggedItemType = null;
    }
    
    // Remove drag-over class from all elements
    document.querySelectorAll(".drag-over").forEach(el => {
      el.classList.remove("drag-over");
    });
  });
  
  // Touch events for mobile
  initTouchDragAndDrop();
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll("details:not(.dragging), li:not(.dragging)")];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child, container: child.parentNode };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element ? 
    { offset: Number.NEGATIVE_INFINITY, element: draggableElements[draggableElements.length - 1], container: container } : 
    { offset: Number.NEGATIVE_INFINITY, element: null, container: container };
}

function handleShowReorder(draggedShow, afterElement) {
  const favs = loadFavorites();
  const draggedShowId = parseInt(draggedShow.querySelector(".showLink").dataset.name);
  const draggedIndex = favs.findIndex(f => f.id === draggedShowId);
  
  if (draggedIndex === -1) return;
  
  const draggedFav = favs[draggedIndex];
  favs.splice(draggedIndex, 1);
  
  let newIndex;
  if (afterElement) {
    const afterShowId = parseInt(afterElement.querySelector(".showLink").dataset.name);
    newIndex = favs.findIndex(f => f.id === afterShowId);
    if (newIndex !== -1) {
      favs.splice(newIndex, 0, draggedFav);
    } else {
      favs.push(draggedFav);
    }
  } else {
    favs.push(draggedFav);
  }
  
  // Update order property for all shows
  favs.forEach((fav, index) => {
    fav.order = index;
  });
  
  saveFavorites(favs);
  renderFavorites();
  showNotification("Favorites order has been updated", "success", "Order Updated");
}

function handleEpisodeReorder(draggedEpisode, afterElement) {
  const favs = loadFavorites();
  const showId = parseInt(draggedEpisode.querySelector(".epLink").dataset.show);
  const epId = parseInt(draggedEpisode.querySelector(".epLink").dataset.ep);
  const listType = draggedEpisode.closest("ul").previousElementSibling.classList.contains("badge-watchlist") ? "watchlist" : "watched";
  
  const showIndex = favs.findIndex(f => f.id === showId);
  if (showIndex === -1) return;
  
  const episodeList = favs[showIndex].episodes[listType];
  const draggedEpIndex = episodeList.findIndex(e => e.id === epId);
  
  if (draggedEpIndex === -1) return;
  
  const draggedEpisodeData = episodeList[draggedEpIndex];
  episodeList.splice(draggedEpIndex, 1);
  
  let newIndex;
  if (afterElement && afterElement.matches("li")) {
    const afterEpId = parseInt(afterElement.querySelector(".epLink").dataset.ep);
    newIndex = episodeList.findIndex(e => e.id === afterEpId);
    if (newIndex !== -1) {
      episodeList.splice(newIndex, 0, draggedEpisodeData);
    } else {
      episodeList.push(draggedEpisodeData);
    }
  } else {
    episodeList.push(draggedEpisodeData);
  }
  
  saveFavorites(favs);
  renderFavorites();
  showNotification("Episode order has been updated", "success", "Order Updated");
}

function initTouchDragAndDrop() {
  let touchStartY = 0;
  let touchCurrentY = 0;
  let touchDraggedElement = null;
  
  document.addEventListener("touchstart", (e) => {
    if (e.target.classList.contains("drag-handle") || e.target.classList.contains("episode-drag-handle")) {
      touchDraggedElement = e.target.closest("details") || e.target.closest("li");
      touchStartY = e.touches[0].clientY;
      touchDraggedElement.classList.add("dragging");
      e.preventDefault();
    }
  });
  
  document.addEventListener("touchmove", (e) => {
    if (!touchDraggedElement) return;
    
    touchCurrentY = e.touches[0].clientY;
    const deltaY = touchCurrentY - touchStartY;
    
    // Move the element visually
    touchDraggedElement.style.transform = `translateY(${deltaY}px)`;
    
    // Find elements to reorder (simplified for touch)
    const container = $("favoritesList");
    const draggableElements = [...container.querySelectorAll("details:not(.dragging), li:not(.dragging)")];
    
    draggableElements.forEach(el => {
      el.classList.remove("drag-over");
    });
    
    const afterElement = getDragAfterElement(container, touchCurrentY);
    if (afterElement && afterElement.element) {
      afterElement.element.classList.add("drag-over");
    }
    
    e.preventDefault();
  });
  
  document.addEventListener("touchend", () => {
    if (!touchDraggedElement) return;
    
    const container = $("favoritesList");
    const afterElement = getDragAfterElement(container, touchCurrentY);
    
    if (touchDraggedElement.tagName === "DETAILS") {
      handleShowReorder(touchDraggedElement, afterElement ? afterElement.element : null);
    } else {
      handleEpisodeReorder(touchDraggedElement, afterElement ? afterElement.element : null);
    }
    
    touchDraggedElement.classList.remove("dragging");
    touchDraggedElement.style.transform = "";
    touchDraggedElement.style.opacity = "";
    
    // Remove drag-over class from all elements
    document.querySelectorAll(".drag-over").forEach(el => {
      el.classList.remove("drag-over");
    });
    
    touchDraggedElement = null;
  });
}

/* ----------------------------
   Favorites rendering
---------------------------- */
function renderFavorites() {
  let favs = loadFavorites();
  const sortMode = $("favSort")?.value || "recent";

  if (sortMode === "alpha") {
    favs.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortMode === "recent") {
    // Reverse to show most recent first (maintain existing behavior)
    favs = favs.reverse();
  } else if (sortMode === "custom") {
    // Use custom order from drag & drop
    favs.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  const container = $("favoritesList");
  container.innerHTML = "";

  if (favs.length === 0) {
    container.innerHTML = '<p class="hint">No favorites yet</p>';
    return;
  }

  favs.forEach(fav => {
    const details = document.createElement("details");
    details.draggable = true;
    
    const summary = document.createElement("summary");
    summary.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
      <span class="showLink" data-name="${fav.name}">${fav.name}</span>
    `;
    
    // Add remove button for the entire show
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-show";
    removeBtn.innerHTML = "✕";
    removeBtn.title = "Remove show from favorites";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeShowFromFavorites(fav.id);
    });
    
    details.appendChild(summary);
    details.appendChild(removeBtn);

    if (openOnRender === fav.id) details.open = true;

    // Watch Later section
    const wl = document.createElement("div");
    wl.innerHTML = '<span class="category-badge badge-watchlist">📺 Watch Later</span>';

    if (fav.episodes.watchlist.length === 0) {
      wl.innerHTML += '<p class="hint">None</p>';
    } else {
      const ul = document.createElement("ul");
      fav.episodes.watchlist.forEach(ep => {
        const li = document.createElement("li");
        li.draggable = true;
        li.innerHTML = `
          <span class="episode-drag-handle" title="Drag to reorder">⋮⋮</span>
          <span class="epLink" data-show="${fav.id}" data-ep="${ep.id}">
            S${ep.season}E${ep.number} — ${ep.name}
          </span>
          <button class="removeEp" data-show="${fav.id}" data-type="watchlist" data-ep="${ep.id}">✖</button>
        `;
        ul.appendChild(li);
      });
      wl.appendChild(ul);
    }
    details.appendChild(wl);

    // Watched section
    const wd = document.createElement("div");
    wd.innerHTML = '<span class="category-badge badge-watched">✔ Watched</span>';

    if (fav.episodes.watched.length === 0) {
      wd.innerHTML += '<p class="hint">None</p>';
    } else {
      const ul = document.createElement("ul");
      fav.episodes.watched.forEach(ep => {
        const li = document.createElement("li");
        li.draggable = true;
        li.innerHTML = `
          <span class="episode-drag-handle" title="Drag to reorder">⋮⋮</span>
          <span class="epLink" data-show="${fav.id}" data-ep="${ep.id}">
            S${ep.season}E${ep.number} — ${ep.name}
          </span>
          <button class="removeEp" data-show="${fav.id}" data-type="watched" data-ep="${ep.id}">✖</button>
        `;
        ul.appendChild(li);
      });
      wd.appendChild(ul);
    }
    details.appendChild(wd);

    container.appendChild(details);
  });

  // Event listeners
  container.querySelectorAll(".removeEp").forEach(btn => {
    btn.addEventListener("click", () => {
      removeEpisode(+btn.dataset.show, btn.dataset.type, +btn.dataset.ep);
    });
  });

  container.querySelectorAll(".epLink").forEach(el => {
    el.addEventListener("click", () => {
      openEpisode(+el.dataset.show, +el.dataset.ep);
    });
  });

  container.querySelectorAll(".showLink").forEach(el => {
    el.addEventListener("click", async () => {
      $("searchInput").value = el.dataset.name;
      await doSearch(el.dataset.name);
    });
  });

  openOnRender = null;
}

function removeShowFromFavorites(showId) {
  const showName = loadFavorites().find(f => f.id === showId)?.name || "Show";
  
  showConfirmationModal(
    `Remove "${showName}" and all its episodes from favorites?`,
    "Remove Show",
    "Keep Show"
  ).then(confirmed => {
    if (confirmed) {
      let favs = loadFavorites();
      favs = favs.filter(f => f.id !== showId);
      saveFavorites(favs);
      renderFavorites();
      showNotification(
        `"${showName}" has been removed from favorites`,
        "success",
        "Show Removed"
      );
    }
  });
}

/* ----------------------------
   API
---------------------------- */
async function searchShow(query) {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
  return res.json();
}

async function getEpisodesForShow(showId) {
  const res = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
  return res.json();
}

/* ----------------------------
   Loading States
---------------------------- */
function showLoading() {
  $("resultArea").classList.add("hidden");
  $("loadingSkeleton").classList.remove("hidden");
}

function hideLoading() {
  $("loadingSkeleton").classList.add("hidden");
}

function showShuffleAnimation() {
  $("shuffleAnimation").classList.remove("hidden");
}

function hideShuffleAnimation() {
  $("shuffleAnimation").classList.add("hidden");
}

/* ----------------------------
   Episodes
---------------------------- */
function populateSeasonSelectors(episodes) {
  const seasons = [...new Set(episodes.map(e => e.season))].sort((a, b) => a - b);

  $("fromSeason").innerHTML = "";
  $("toSeason").innerHTML = "";

  seasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `Season ${s}`;
    $("fromSeason").appendChild(opt);
    $("toSeason").appendChild(opt.cloneNode(true));
  });

  $("fromSeason").value = seasons[0];
  $("toSeason").value = seasons[seasons.length - 1];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function renderResult(ep, show) {
  const container = $("resultArea");
  const content = container.querySelector(".result-content");
  
  hideLoading();
  container.classList.remove("hidden");
  
  // Update theme if show theme is enabled
  updateShowTheme(show, $('showThemeToggle').checked);

  const img =
    (ep?.image?.medium) ||
    (show?.image?.medium) ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const summary = (ep?.summary || "No summary").replace(/<[^>]*>?/gm, "");
  const rating = ep?.rating?.average || show?.rating?.average || "N/A";

  content.innerHTML = `
    <div class="result fade-in">
      <div class="thumb"><img src="${img}" alt="thumb"/></div>
      <div class="meta">
        <div class="hint">
          <span class="showLink" data-name="${show.name}">${show.name}</span>
          — S${ep.season}E${ep.number}
        </div>
        <h2>${ep.name || "Untitled"} <span class="rating">⭐ ${rating}</span></h2>
        <p class="hint">Aired: ${ep.airdate || "Unknown"}</p>
        <p>${summary}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button id="saveFav" class="btn btn-clear">♡ Add Show</button>
          <button id="watchLater" class="btn btn-primary">📺 Watch Later</button>
          <button id="markWatched" class="btn btn-surprise">✔ Watched</button>
          <button id="shareBtn" class="btn btn-clear">📤 Share</button>
        </div>
      </div>
    </div>
  `;

  $("saveFav")?.addEventListener("click", () => {
    ensureFav(show);
    renderFavorites();
    showNotification(
      `"${show.name}" added to favorites`,
      "success",
      "Show Saved"
    );
  });

  $("watchLater")?.addEventListener("click", () => {
    addEpisode(show, ep, "watchlist");
  });

  $("markWatched")?.addEventListener("click", () => {
    addEpisode(show, ep, "watched");
  });

  $("shareBtn")?.addEventListener("click", () => {
    shareEpisode(show, ep);
  });

  // Make show link clickable
  content.querySelector(".showLink")?.addEventListener("click", async () => {
    $("searchInput").value = show.name;
    await doSearch(show.name);
  });
}

function addEpisode(show, ep, type) {
  let favs = loadFavorites();
  let fav = favs.find(f => f.id === show.id);

  if (!fav) {
    fav = {
      id: show.id,
      name: show.name,
      episodes: { watchlist: [], watched: [] },
      order: favs.length
    };
    favs.push(fav);
  }

  if (!fav.episodes[type].find(e => e.id === ep.id)) {
    fav.episodes[type].push({
      id: ep.id,
      name: ep.name,
      season: ep.season,
      number: ep.number
    });
    saveFavorites(favs);
    openOnRender = show.id;
    renderFavorites();
    
    const typeNames = {
      watchlist: "Watch Later",
      watched: "Watched"
    };
    
    showNotification(
      `"${ep.name}" saved to ${typeNames[type]}`,
      "success",
      "Episode Saved"
    );
  } else {
    showNotification(
      "This episode is already in your list",
      "info",
      "Already Saved"
    );
  }
}

function removeEpisode(showId, type, epId) {
  let favs = loadFavorites();
  let fav = favs.find(f => f.id === showId);
  if (!fav) return;

  const episode = fav.episodes[type].find(e => e.id === epId);
  fav.episodes[type] = fav.episodes[type].filter(e => e.id !== epId);
  saveFavorites(favs);
  openOnRender = showId;
  renderFavorites();
  
  showNotification(
    `Episode removed from ${type}`,
    "success",
    "Episode Removed"
  );
}

async function openEpisode(showId, epId) {
  const favs = loadFavorites();
  const fav = favs.find(f => f.id === showId);
  if (!fav) return;

  showLoading();
  const data = await searchShow(fav.name);
  if (data.length === 0) {
    hideLoading();
    return;
  }

  const show = data[0].show;
  const episodes = await getEpisodesForShow(show.id);
  const ep = episodes.find(e => e.id === epId);

  if (ep) {
    currentShow = show;
    allEpisodes = episodes;
    populateSeasonSelectors(episodes);
    renderResult(ep, show);
  } else {
    hideLoading();
  }
}

/* ----------------------------
   Share Functionality
---------------------------- */
function shareEpisode(show, episode) {
  const shareText = `Check out "${episode.name}" (S${episode.season}E${episode.number}) from ${show.name} - found via Random Episode Finder!`;
  const shareUrl = window.location.href.split('?')[0];
  
  if (navigator.share) {
    navigator.share({
      title: `${show.name} - ${episode.name}`,
      text: shareText,
      url: shareUrl
    }).catch(() => fallbackShare(shareText, shareUrl));
  } else {
    fallbackShare(shareText, shareUrl);
  }
}

function fallbackShare(text, url) {
  const fullText = `${text} ${url}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(fullText).then(() => {
      showNotification('Link copied to clipboard!', 'success', 'Share');
    }).catch(() => {
      prompt('Copy this link:', fullText);
    });
  } else {
    prompt('Copy this link:', fullText);
  }
}

/* ----------------------------
   Search + controls
---------------------------- */
async function doSearch(query) {
  if (!query.trim()) {
    showNotification(
      "Please enter a TV show name to search",
      "warning",
      "Search Empty"
    );
    return;
  }
  
  showLoading();
  const data = await searchShow(query);
  if (data.length === 0) {
    hideLoading();
    showNotification(
      "No TV shows found matching your search",
      "warning",
      "No Results Found"
    );
    return;
  }

  currentShow = data[0].show;
  allEpisodes = await getEpisodesForShow(currentShow.id);

  populateSeasonSelectors(allEpisodes);
  
  // Show shuffle animation before revealing result
  showShuffleAnimation();
  setTimeout(() => {
    hideShuffleAnimation();
    renderResult(pickRandom(allEpisodes), currentShow);
  }, 1500);
}

$("searchBtn").onclick = () => doSearch($("searchInput").value.trim());

$("findBtn").onclick = () => {
  if (!currentShow) {
    showNotification(
      "Please search for a show first",
      "warning",
      "No Show Selected"
    );
    return;
  }
  
  showShuffleAnimation();
  setTimeout(() => {
    const fromS = +$("fromSeason").value;
    const toS = +$("toSeason").value;
    const eps = allEpisodes.filter(e => e.season >= fromS && e.season <= toS);
    
    if (eps.length === 0) {
      hideShuffleAnimation();
      showNotification(
        "No episodes found in the selected season range",
        "warning",
        "No Episodes Found"
      );
      return;
    }
    
    hideShuffleAnimation();
    renderResult(pickRandom(eps), currentShow);
  }, 1500);
};

$("surpriseBtn").onclick = () => {
  const randomShow = pickRandom(SURPRISE_LIST);
  $("searchInput").value = randomShow;
  doSearch(randomShow);
};

$("clearBtn").onclick = async () => {
  const confirmed = await showConfirmationModal(
    "Are you sure you want to clear all favorites? This action cannot be undone.",
    "Clear All",
    "Keep Favorites"
  );
  
  if (confirmed) {
    localStorage.removeItem("ref-favs");
    renderFavorites();
    showNotification(
      "All favorites have been cleared successfully", 
      "success", 
      "Favorites Cleared"
    );
  }
};

$("favSort")?.addEventListener("change", renderFavorites);

// Theme event listeners
$("themeToggle")?.addEventListener("change", toggleTheme);
$("showThemeToggle")?.addEventListener("change", toggleShowTheme);

// Initialize all functionality
initSearchAutocomplete();
initDragAndDrop();
initTheme();
renderFavorites();

/* ----------------------------
   Daily Pick
---------------------------- */
async function loadDailyPick() {
  const today = new Date().toISOString().split("T")[0];
  let dailyData = JSON.parse(localStorage.getItem("ref-daily") || "null");

  if (!dailyData || dailyData.date !== today) {
    const showName = pickRandom(SURPRISE_LIST);
    try {
      const data = await searchShow(showName);
      if (!data || data.length === 0) return;

      const show = data[0].show;
      const episodes = await getEpisodesForShow(show.id);
      const ep = pickRandom(episodes);

      dailyData = { date: today, show, episode: ep };
      localStorage.setItem("ref-daily", JSON.stringify(dailyData));
    } catch (e) {
      console.error("Daily pick failed", e);
      return;
    }
  }

  const container = $("dailyPick");
  const content = $("dailyContent");
  if (!container || !content) return;

  container.classList.remove("hidden");

  const ep = dailyData.episode;
  const show = dailyData.show;
  const rating = ep?.rating?.average || show?.rating?.average || "N/A";

  const img =
    (ep?.image?.medium) ||
    (show?.image?.medium) ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const summary = (ep?.summary || "No summary").replace(/<[^>]*>?/gm, "");

  content.innerHTML = `
    <div class="result fade-in">
      <div class="thumb"><img src="${img}" alt="thumb"/></div>
      <div class="meta">
        <div class="hint">
          <span class="showLink" data-name="${show.name}">${show.name}</span>
          — S${ep.season}E${ep.number}
        </div>
        <h3 class="epLink" data-show="${show.id}" data-ep="${ep.id}">
          ${ep.name || "Untitled"} <span class="rating">⭐ ${rating}</span>
        </h3>
        <p class="hint">Aired: ${ep.airdate || "Unknown"}</p>
        <p>${summary}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button id="dailyFav" class="btn btn-clear">♡ Save Show</button>
          <button id="dailyLater" class="btn btn-primary">📺 Watch Later</button>
          <button id="dailyWatched" class="btn btn-surprise">✔ Watched</button>
          <button id="dailyShare" class="btn btn-clear">📤 Share</button>
        </div>
      </div>
    </div>
  `;

  // Actions
  $("dailyFav")?.addEventListener("click", () => {
    ensureFav(show);
    renderFavorites();
    showNotification(
      `"${show.name}" added to favorites`,
      "success",
      "Show Saved"
    );
  });

  $("dailyLater")?.addEventListener("click", () => {
    addEpisode(show, ep, "watchlist");
  });

  $("dailyWatched")?.addEventListener("click", () => {
    addEpisode(show, ep, "watched");
  });

  $("dailyShare")?.addEventListener("click", () => {
    shareEpisode(show, ep);
  });

  // Make links clickable
  content.querySelectorAll(".showLink").forEach(el => {
    el.addEventListener("click", async () => {
      $("searchInput").value = el.dataset.name;
      await doSearch(el.dataset.name);
    });
  });

  content.querySelectorAll(".epLink").forEach(el => {
    el.addEventListener("click", async () => {
      await openEpisode(show.id, ep.id);
    });
  });
}

loadDailyPick();

/* ----------------------------
   SiriWave background
---------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  if (typeof SiriWave !== "undefined") {
    const siriWave = new SiriWave({
      container: document.getElementById("siriWave"),
      width: window.innerWidth,
      height: window.innerHeight,
      style: "ios9",
      amplitude: 0.6,
      speed: 0.08,
      autostart: true,
      cover: true
    });

    window.addEventListener("resize", () => {
      siriWave.setSize(window.innerWidth, window.innerHeight);
    });
  }
});