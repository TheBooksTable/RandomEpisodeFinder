

const $ = id => document.getElementById(id);

// State
let currentShow = null;
let allEpisodes = [];
let isFetching = false;

// ----- SURPRISE LIST -----
const RAW_SURPRISE = [
  'Breaking Bad','The Office','Friends','SpongeBob SquarePants',
  'Rick and Morty','Stranger Things','The Simpsons','Archer',
  'Seinfeld','Avatar: The Last Airbender', 'Smiling Friends',
  'BoJack Horseman', 'Black Mirror', 'Brooklyn Nine-Nine',
  'Supernatural', 'South Park', 'Twin Peaks','Fargo',
  'Better Call Saul', 'Infinity Train',
  'Kipo and the Age of Wonderbeasts', 'Tuca & Bertie',
  'Final Space', 'The Midnight Gospel', 'Undone',
  'Close Enough', 'Hilda', 'F Is for Family',
  'Solar Opposites', 'Golan the Insatiable',
  'Adventure Time: Distant Lands', 'Over the Garden Wall',
  'Primal', 'Aggretsuko', 'Bee and PuppyCat', 'Drawn Together'
];

// Remove duplicates, preserve order
const SURPRISE_DEDUPE = Array.from(new Set(RAW_SURPRISE.map(s => s.trim())));

// Create a weighted array: earlier items slightly more likely
const SURPRISE_WEIGHTED = (() => {
  const arr = [];
  for (let i = 0; i < SURPRISE_DEDUPE.length; i++) {
    // weight is higher for earlier entries but never zero
    const weight = Math.max(1, Math.round(3 - (i / 12)));
    for (let k = 0; k < weight; k++) arr.push(SURPRISE_DEDUPE[i]);
  }
  return arr;
})();

// ----- Storage helpers -----
function loadFavorites(){
  try { return JSON.parse(localStorage.getItem('ref-favs')||'[]'); } catch(e){ return []; }
}
function saveFavorites(list){ localStorage.setItem('ref-favs', JSON.stringify(list)); }

function showMessage(text, kind = 'info', timeout = 4500){
  const box = $('message');
  if(!box) return;
  box.hidden = false;
  box.textContent = text;
  box.setAttribute('data-kind', kind);
  if(timeout > 0){
    clearTimeout(box._t);
    box._t = setTimeout(() => {
      box.hidden = true;
    }, timeout);
  }
}

// Accessibility focus helpers
function focusResult() {
  const container = $('resultArea');
  if (container && !container.classList.contains('hidden')) {
    container.setAttribute('tabindex','-1');
    container.focus({ preventScroll: false });
  }
}

// render favorites list (now includes lastPickedEpisode if present)
function renderFavorites(){
  const list = loadFavorites();
  const ul = $('favoritesList');
  if(!ul) return;
  ul.innerHTML = '';
  if(list.length===0){
    ul.innerHTML = '<li class="muted">No favorites yet</li>';
    return;
  }
  list.forEach(s => {
    const li = document.createElement('li');
    const label = s.lastPickedEpisode
      ? `${s.name} — S${s.lastPickedEpisode.season}E${s.lastPickedEpisode.number} ${s.lastPickedEpisode.name ? '- ' + s.lastPickedEpisode.name : ''}`
      : s.name;
    li.innerHTML = `
      <button class="favItem" data-id="${s.id}" title="Open ${escapeHtml(s.name)}">${escapeHtml(label)}</button>
      <button data-id="${s.id}" class="removeFav" aria-label="Remove favorite ${escapeHtml(s.name)}">✖</button>
    `;
    ul.appendChild(li);
  });

  ul.querySelectorAll('.favItem').forEach(el => {
    el.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const fav = loadFavorites().find(f => f.id === id);
      if(!fav) return;
      // If lastPickedEpisode is saved, show it; otherwise perform search by name
      if(fav.lastPickedEpisode){
        renderResult(fav.lastPickedEpisode, { id: fav.id, name: fav.name });
      } else {
        $('searchInput').value = fav.name;
        if($('searchBtn')) $('searchBtn').click();
      }
    });
  });

  ul.querySelectorAll('.removeFav').forEach(b =>
    b.addEventListener('click', e => {
      const id = Number(e.currentTarget.dataset.id);
      const newList = loadFavorites().filter(x => x.id !== id);
      saveFavorites(newList);
      renderFavorites();
      showMessage('Favorite removed', 'info', 2200);
    })
  );
}

function escapeHtml(str){
  return (''+str).replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

// ----- Helpers for API -----
async function searchShow(query){
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
  if(!res.ok) throw new Error('Search failed');
  return res.json();
}
async function getEpisodesForShow(showId){
  const res = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
  if(!res.ok) throw new Error('Episodes fetch failed');
  return res.json();
}

// Try to get a random show from TVMaze (best-effort). If unreachable, fallback to local list.
async function fetchRandomTvmazeShow(){
  try {
    // attempt to fetch a page of shows; this endpoint exists on TVMaze but is paginated
    const res = await fetch('https://api.tvmaze.com/shows?page=0');
    if(!res.ok) throw new Error('No TVMaze page');
    const arr = await res.json();
    if(!Array.isArray(arr) || arr.length === 0) throw new Error('TVMaze empty');
    const pick = arr[Math.floor(Math.random() * arr.length)];
    return pick && pick.name ? pick.name : null;
  } catch (err) {
    return null;
  }
}

// Season selectors
function populateSeasonSelectors(episodes){
  const seasons = [...new Set(episodes.map(e=>e.season))].sort((a,b)=>a-b);
  const from = $('fromSeason'); const to = $('toSeason');
  if(!from || !to) return;
  from.innerHTML = ''; to.innerHTML = '';
  seasons.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = `Season ${s}`;
    from.appendChild(opt);
    to.appendChild(opt.cloneNode(true));
  });
  if(seasons.length){
    from.value = seasons[0];
    to.value = seasons[seasons.length-1];
  }
}

// sanitize helpers
function removeHtmlComments(str){
  return (''+str).replace(/<!--[\s\S]*?-->/g, '');
}
function simpleSanitizeHtml(str) {
  const div = document.createElement('div');
  div.innerHTML = str || '';
  return div.textContent || div.innerText || "";
}
function filterEpisodesBySeasonRange(eps, fromS, toS){
  return eps.filter(e => e.season >= fromS && e.season <= toS);
}
function pickRandom(arr){ return arr && arr.length ? arr[Math.floor(Math.random()*arr.length)] : null; }

// render result
function renderResult(episode, show){
  const container = $('resultArea');
  if(!container) return;
  container.classList.remove('hidden');

  const img = (episode && episode.image && episode.image.medium) ||
              (show && show.image && show.image.medium) ||
              'https://via.placeholder.com/300x200?text=No+Image';

  const summaryText = episode && episode.summary
    ? removeHtmlComments(simpleSanitizeHtml(episode.summary)).trim()
    : 'No summary available.';

  const rating = (episode && episode.rating && episode.rating.average) ? episode.rating.average : '';

  container.innerHTML = `
    <div class="thumb" aria-hidden="true"><img src="${img}" alt="" /></div>
    <div class="meta">
      <div class="muted">${escapeHtml(show.name)} — S${episode.season}E${episode.number}</div>
      <h2>${escapeHtml(episode.name || 'Untitled')}</h2>
      <p class="muted">Aired: ${escapeHtml(episode.airdate || 'Unknown')}</p>
      <p>${escapeHtml(summaryText)}</p>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button id="saveFav" class="btn btn-clear" aria-label="Save show to favorites">♡ Save Show</button>
        <button id="openEpBtn" class="btn btn-primary" aria-label="Open episode in TVMaze">Open on TVMaze</button>
      </div>
    </div>
    <div class="rating" aria-hidden="true">${escapeHtml(rating)}</div>
  `;

  // Save favorite (store last-picked episode details)
  const saveBtn = $('saveFav');
  if(saveBtn){
    saveBtn.addEventListener('click', () => {
      const favs = loadFavorites();
      if(!favs.find(f=>f.id===show.id)){
        favs.push({ id: show.id, name: show.name, lastPickedEpisode: episode });
        saveFavorites(favs);
        renderFavorites();
        showMessage('Saved to favorites!');
      } else {
        // update lastPickedEpisode if exists
        const it = favs.find(f => f.id === show.id);
        it.lastPickedEpisode = episode;
        saveFavorites(favs);
        renderFavorites();
        showMessage('Updated saved show with this episode.');
      }
    });
  }

  const openEpBtn = $('openEpBtn');
  if(openEpBtn){
    openEpBtn.addEventListener('click', () => {
      const url = episode.url || (show && `https://www.tvmaze.com/shows/${show.id}`);
      if(url) window.open(url, '_blank', 'noopener');
    });
  }

  // focus result for keyboard users
  focusResult();
}

// -----------------------------
// UI & Events
// -----------------------------
function setFetching(on) {
  isFetching = !!on;
  const btns = ['searchBtn','findBtn','surpriseBtn','clearBtn'];
  btns.forEach(id => {
    const el = $(id);
    if(el) el.disabled = !!on;
  });
  const spinner = $('spinner');
  if(spinner){
    spinner.hidden = !on;
    spinner.setAttribute('aria-hidden', (!on).toString());
  }
}

// search event
if ($('searchBtn')) {
  $('searchBtn').addEventListener('click', async () => {
    const q = $('searchInput') ? $('searchInput').value.trim() : '';
    if(!q){ showMessage('Type a show name', 'error'); return; }
    try {
      setFetching(true);
      showMessage('Searching...');
      const data = await searchShow(q);
      if(!data || data.length===0){ showMessage('No shows found for that query', 'error'); setFetching(false); return; }
      currentShow = data[0].show;
      allEpisodes = await getEpisodesForShow(currentShow.id);
      populateSeasonSelectors(allEpisodes);
      const ep = pickRandom(allEpisodes);
      if(ep) renderResult(ep, currentShow);
      showMessage('Show loaded', 'info', 2400);
    } catch(err) {
      console.error(err);
      showMessage('Error: ' + (err && err.message ? err.message : String(err)), 'error', 6000);
    } finally {
      setFetching(false);
    }
  });
}

// find random in range
if ($('findBtn')) {
  $('findBtn').addEventListener('click', () => {
    if(!currentShow || !allEpisodes || allEpisodes.length===0){ showMessage('Search a show first', 'error'); return; }
    const fromS = Number($('fromSeason').value);
    const toS = Number($('toSeason').value);
    const filtered = filterEpisodesBySeasonRange(allEpisodes, fromS, toS);
    if(!filtered || filtered.length===0){ showMessage('No episodes in that range', 'error'); return; }
    renderResult(pickRandom(filtered), currentShow);
  });
}

// Surprise button: prefer a weighted local pick, but attempt live random from TVMaze as optional
if ($('surpriseBtn')) {
  $('surpriseBtn').addEventListener('click', async () => {
    try {
      setFetching(true);
      showMessage('Picking a surprise...');
      // 30% chance to attempt a live TVMaze random show (best-effort)
      let showName = null;
      if (Math.random() < 0.30) {
        showName = await fetchRandomTvmazeShow();
      }
      // fallback to weighted local list
      if(!showName) {
        showName = SURPRISE_WEIGHTED[Math.floor(Math.random() * SURPRISE_WEIGHTED.length)];
      }
      $('searchInput').value = showName;
      if($('searchBtn')) $('searchBtn').click();
    } catch (err) {
      console.error(err);
      showMessage('Surprise failed; try again.', 'error');
    } finally {
      setFetching(false);
    }
  });
}

// clear favorites
if ($('clearBtn')) {
  $('clearBtn').addEventListener('click', () => {
    if(confirm('Clear all favorites?')){ // confirm is okay for destructive action
      localStorage.removeItem('ref-favs');
      renderFavorites();
      showMessage('Favorites cleared', 'info');
    }
  });
}

// enter => search
if ($('searchInput')) {
  $('searchInput').addEventListener('keydown', e => {
    if(e.key==='Enter') {
      if($('searchBtn')) $('searchBtn').click();
    }
  });
}

// keyboard shortcuts
window.addEventListener('keydown', (e) => {
  // ignore when focused on inputs except for S shortcut which focuses search
  const tag = document.activeElement && document.activeElement.tagName;
  if(!e.ctrlKey && !e.metaKey && !e.altKey){
    if(e.key.toLowerCase() === 's'){ // focus search
      e.preventDefault();
      const si = $('searchInput');
      if(si){ si.focus(); si.select(); showMessage('Focused search (S)'); }
    } else if(e.key.toLowerCase() === 'r'){ // surprise
      if(tag === 'INPUT' || tag === 'TEXTAREA') {
        // allow R in input to act normally
        return;
      }
      e.preventDefault();
      if($('surpriseBtn')) $('surpriseBtn').click();
    }
  }
});

// initial render
renderFavorites();

// UI helpers: mobile favorites toggle + install button
(function(){
  const favToggle = document.getElementById('favToggle');
  const installBtn = document.getElementById('installBtn');

  function updateToggleVisibility(){
    if(window.innerWidth <= 900){
      if(favToggle) favToggle.style.display = 'inline-block';
    } else {
      if(favToggle) favToggle.style.display = 'none';
    }
  }
  updateToggleVisibility();
  window.addEventListener('resize', updateToggleVisibility, { passive: true });

  if(favToggle){
    favToggle.addEventListener('click', () => {
      const appEl = document.querySelector('.app');
      if(appEl) appEl.classList.toggle('favs-collapsed');
      const pressed = appEl && appEl.classList.contains('favs-collapsed');
      favToggle.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      if(!document.querySelector('.app').classList.contains('favs-collapsed')){
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if(installBtn) { installBtn.style.display = 'inline-block'; }
  });

  if(installBtn){
    installBtn.addEventListener('click', async () => {
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if(choice.outcome === 'accepted') {
        console.log('User accepted install');
      }
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }
})();

// -----------------------------
// Siri-style wave: randomized, non-repeating-looking motion
// - Uses layered sine + per-frame random modulation + easing so it never "loops" exactly
// -----------------------------
(function initSiriWave(){
  try {
    let canvas = document.getElementById('siriWave');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'siriWave';
      document.body.insertBefore(canvas, document.body.firstChild);
    }

    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
      console.warn('Canvas 2D not available; siriWave disabled.');
      return;
    }

    let width = 0, height = 0;
    function resizeCanvas(){
      const ratio = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(window.innerWidth));
      const h = Math.max(1, Math.round(window.innerHeight));
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      width = w; height = h;
    }
    resizeCanvas();

    // Layers: each layer has dynamic amplitude that slowly wanders using random targets
    const layers = [
      { base: 26, wavelength: 320, speed: 0.012, phase: 0, ampTarget: 26, amp: 26, jitter: 0.4 },
      { base: 18, wavelength: 240, speed: 0.018, phase: 0.5, ampTarget: 18, amp: 18, jitter: 0.8 },
      { base: 12, wavelength: 160, speed: 0.02, phase: 1.0, ampTarget: 12, amp: 12, jitter: 1.0 }
    ];

    // random seed helpers
    function randRange(a,b){ return a + Math.random()*(b-a); }
    function lerp(a,b,t){ return a + (b-a)*t; }

    // occasionally pick new amplitude targets to avoid repeating patterns
    function wanderTargets(){
      layers.forEach(layer => {
        // choose a new target amplitude that varies around base
        const variance = layer.base * 0.9;
        layer.ampTarget = layer.base + randRange(-variance, variance);
        // also nudge wavelength and speed lightly
        layer.wavelength = Math.max(80, layer.wavelength + randRange(-40,40));
        layer.speed = Math.max(0.006, layer.speed + randRange(-0.01,0.01));
      });
      // schedule next wander at a random interval between 600ms and 2500ms
      setTimeout(wanderTargets, 600 + Math.random()*1900);
    }
    wanderTargets();

    // pointer that waves "look at" - gently follows pointer for natural motion
    let pointer = { x: width/2, y: height/2 };
    let targetPointer = { x: width/2, y: height/2 };
    function updatePointer(x, y){
      targetPointer.x = Math.max(0, Math.min(window.innerWidth, x || 0));
      targetPointer.y = Math.max(0, Math.min(window.innerHeight, y || 0));
    }

    window.addEventListener('mousemove', e => updatePointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => {
      if(e.touches && e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    // create gradient for strokes
    function createGradient(alpha){
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, `rgba(85,100,255,${0.25 * alpha})`);
      g.addColorStop(0.35, `rgba(255,80,200,${0.22 * alpha})`);
      g.addColorStop(0.7, `rgba(0,220,255,${0.18 * alpha})`);
      g.addColorStop(1, `rgba(255,255,255,${0.08 * alpha})`);
      return g;
    }

    // draw a single layer with per-frame randomized micro-noise
    function drawLayer(layer, index, time){
      ctx.beginPath();
      // baseline y is slightly shifted by global noise so waves drift up/down
      const baseline = height * (0.45 + 0.1 * Math.sin(time*0.0008 + index));
      // step size varies depending on width for performance
      const step = Math.max(1, Math.floor(width / 350));
      for (let x = 0; x <= width; x += step) {
        // move pointer gradually
        const dx = x - pointer.x;
        const distFactor = Math.exp(-Math.abs(dx) / (150 + index*40));
        // amplitude uses layer.amp with tiny per-x noise to break repeating pattern
        const microNoise = Math.sin((x * (0.003 + index*0.0006)) + time*0.0013 + index) * (layer.jitter);
        const amplitude = Math.max(4, layer.amp + microNoise);
        // phase shift includes sin of time for complex non-looping behavior
        const phase = (x / layer.wavelength) * 2 * Math.PI + layer.phase + Math.sin(time * (0.0006 + index*0.0002));
        // pointer influence (waves are attracted to the pointer y)
        const y = baseline + amplitude * Math.sin(phase) - distFactor * (pointer.y - height/2) * 0.35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = createGradient(1 - index * 0.12);
      ctx.lineWidth = Math.max(1.2, 2.4 - index * 0.5);
      ctx.stroke();
    }

    // animate
    let last = performance.now();
    let raf = null;
    function animate(now){
      const dt = now - last;
      last = now;

      ctx.clearRect(0,0,width,height);

      // slowly approach pointer
      pointer.x = lerp(pointer.x, targetPointer.x, 0.08);
      pointer.y = lerp(pointer.y, targetPointer.y, 0.08);

      // ease layer amps toward targets
      layers.forEach(layer => {
        layer.amp = lerp(layer.amp, layer.ampTarget, 0.02);
        layer.phase += layer.speed * (1 + Math.sin(now * 0.0004 + layer.phase));
      });

      // draw layers in order
      for (let i = 0; i < layers.length; i++) {
        drawLayer(layers[i], i, now);
      }

      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    // responsiveness
    let resizeTimer = null;
    window.addEventListener('resize', function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){
        resizeCanvas();
        pointer.x = targetPointer.x = width/2;
        pointer.y = targetPointer.y = height/2;
      }, 80);
    }, { passive: true });

    document.addEventListener('visibilitychange', function(){
      if(document.hidden) {
        if(raf) cancelAnimationFrame(raf);
        raf = null;
      } else {
        if(!raf) raf = requestAnimationFrame(animate);
      }
    });

    // low-memory devices: reduce layers
    if(navigator.deviceMemory && navigator.deviceMemory <= 1.5 && layers.length > 2) {
      layers.splice(2);
    }

  } catch(err) {
    console.error('siriWave init error:', err);
  }
})();
