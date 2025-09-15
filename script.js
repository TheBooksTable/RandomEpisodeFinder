// Full app + waves JS
// - Matches HTML/CSS above
// - Spinner + inline errors + keyboard shortcuts S/R
// - Siri-like wave canvas behind UI, randomized intensity (non-repeating)
// - Smart Surprise (curated list + optional live fetch)
// - Minimal results list UI injection

// --- Utilities ---
const $ = id => document.getElementById(id);

const searchInput = $("search-input");
const searchButton = $("search-button");
const randomButton = $("random-button");
const resultsDiv = $("results");
const spinner = $("spinner");
const errorDiv = $("error-message");

let isLoading = false;
let tframe = 0;

// Ensure elements exist
if (!searchInput || !searchButton || !randomButton || !resultsDiv || !spinner || !errorDiv) {
  console.error("Missing expected DOM elements. Make sure index.html matches the supplied structure.");
}

// --- SURPRISE list (dedupe not necessary here) ---
const SURPRISE_LIST = [
  "Breaking Bad","The Office","Friends","SpongeBob SquarePants",
  "Rick and Morty","Stranger Things","The Simpsons","Archer",
  "Seinfeld","Avatar: The Last Airbender","Smiling Friends",
  "BoJack Horseman","Black Mirror","Brooklyn Nine-Nine",
  "Gravity Falls","Adventure Time","The Mandalorian","Futurama",
  "Community","Parks and Recreation"
];

// --- UI helpers ---
function setLoading(state) {
  isLoading = !!state;
  spinner.hidden = !state;
  spinner.setAttribute('aria-hidden', (!state).toString());
  searchButton.disabled = state;
  randomButton.disabled = state;
  searchInput.disabled = state;
  if (state) {
    // clear previous error
    clearError();
  }
}

function showError(msg) {
  errorDiv.hidden = false;
  errorDiv.textContent = msg;
}
function clearError() {
  errorDiv.hidden = true;
  errorDiv.textContent = "";
}

function sanitizeHtml(str) {
  const d = document.createElement('div');
  d.innerHTML = str || '';
  return d.textContent || d.innerText || '';
}

// --- Fetch/search logic ---
async function fetchShow(query) {
  if (!query) return;
  try {
    setLoading(true);
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      showError("No results found.");
      resultsDiv.innerHTML = "";
      return;
    }
    renderSearchResults(data);
  } catch (err) {
    console.error(err);
    showError("Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
}

// Render an array of search results (tvmaze search response)
function renderSearchResults(results) {
  resultsDiv.innerHTML = "";
  results.forEach(entry => {
    const s = entry.show || entry;
    const card = document.createElement('article');
    card.className = 'show-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open ${s.name}`);
    const img = s.image ? `<img src="${s.image.medium}" alt="Poster for ${sanitizeHtml(s.name)}">` : '';
    const summary = s.summary ? sanitizeHtml(s.summary) : 'No description available.';
    card.innerHTML = `<h3>${sanitizeHtml(s.name)}</h3>${img}<p>${summary}</p>`;
    card.addEventListener('click', () => openShowDetails(s));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openShowDetails(s); });
    resultsDiv.appendChild(card);
  });
  // focus first result for keyboard users
  if (resultsDiv.firstChild) resultsDiv.firstChild.focus();
}

// Open details (for now: fetch episodes and pick a random one to show details)
async function openShowDetails(show) {
  try {
    setLoading(true);
    const res = await fetch(`https://api.tvmaze.com/shows/${show.id}/episodes`);
    if (!res.ok) throw new Error('Episodes fetch failed');
    const eps = await res.json();
    if (!Array.isArray(eps) || eps.length === 0) {
      showError('No episodes found for this show.');
      return;
    }
    const ep = eps[Math.floor(Math.random() * eps.length)];
    renderEpisodeCard(show, ep);
  } catch (err) {
    console.error(err);
    showError('Failed to load episodes.');
  } finally {
    setLoading(false);
  }
}

function renderEpisodeCard(show, ep) {
  resultsDiv.innerHTML = '';
  const card = document.createElement('article');
  card.className = 'show-card';
  card.tabIndex = -1;
  const img = (ep.image && ep.image.medium) || (show.image && show.image.medium) || '';
  const summary = ep.summary ? sanitizeHtml(ep.summary) : 'No summary available.';
  card.innerHTML = `
    <h3>${sanitizeHtml(show.name)} — S${ep.season}E${ep.number} ${sanitizeHtml(ep.name || '')}</h3>
    ${img ? `<img src="${img}" alt="">` : ''}
    <p>${summary}</p>
    <div style="margin-top:8px;display:flex;gap:8px">
      <a class="btn btn-primary" href="${ep.url || '#'}" target="_blank" rel="noopener">Open on TVMaze</a>
    </div>
  `;
  resultsDiv.appendChild(card);
  card.focus();
}

// --- Smart surprise ---
async function smartSurprise() {
  try {
    setLoading(true);
    clearError();
    // 80% local, 20% live fetch random show (best-effort)
    if (Math.random() < 0.8) {
      const pick = SURPRISE_LIST[Math.floor(Math.random() * SURPRISE_LIST.length)];
      await fetchShow(pick);
    } else {
      const res = await fetch('https://api.tvmaze.com/shows');
      if (!res.ok) throw new Error('TVMaze list fetch failed');
      const data = await res.json();
      const randomPick = data[Math.floor(Math.random() * data.length)];
      renderSearchResults([{ show: randomPick }]);
    }
  } catch (err) {
    console.error(err);
    showError('Surprise failed; please try again.');
  } finally {
    setLoading(false);
  }
}

// Keyboard shortcuts: S -> focus search, R -> surprise
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 's') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  } else if (e.key.toLowerCase() === 'r') {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      // do not override typing
      return;
    }
    e.preventDefault();
    smartSurprise();
  }
});

// Event bindings
searchButton.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (!q) { showError('Type a show name.'); return; }
  fetchShow(q);
});
randomButton.addEventListener('click', smartSurprise);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (!q) { showError('Type a show name.'); return; }
    fetchShow(q);
  }
});

// --- Siri-style waves: randomized non-repeating animation --- //
(function initWaves(){
  const canvas = document.getElementById('wave-canvas');
  if (!canvas) {
    console.warn('Wave canvas missing');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('2d ctx not available; skipping waves');
    return;
  }

  let width = 0, height = 0;
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(window.innerWidth));
    const h = Math.max(1, Math.round(window.innerHeight));
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(ratio,0,0,ratio,0,0);
    width = w; height = h;
  }
  resize();
  window.addEventListener('resize', () => { setTimeout(resize, 60); }, { passive: true });

  // Layers tuned; more layers / color chosen for pleasant look
  const layers = [
    { base:36, wavelength:420, speed:0.0095, phase:0, amp:36, ampTarget:36, jitter:0.6, lineWidth:3.2 },
    { base:24, wavelength:300, speed:0.012, phase:0.6, amp:24, ampTarget:24, jitter:0.9, lineWidth:2.6 },
    { base:15, wavelength:200, speed:0.016, phase:1.2, amp:15, ampTarget:15, jitter:1.4, lineWidth:1.8 },
    { base:10, wavelength:140, speed:0.02, phase:2.0, amp:10, ampTarget:10, jitter:1.9, lineWidth:1.2 }
  ];

  function randRange(a,b){ return a + Math.random()*(b-a); }
  function lerp(a,b,t){ return a + (b-a)*t; }

  // wander targets to avoid repeating patterns
  function wanderTargets(){
    layers.forEach(layer => {
      const variance = Math.max(6, layer.base * 0.85);
      layer.ampTarget = Math.max(4, layer.base + randRange(-variance, variance));
      layer.wavelength = Math.max(80, layer.wavelength + randRange(-50,50));
      layer.speed = Math.max(0.005, layer.speed + randRange(-0.006,0.006));
      layer.jitter = Math.max(0.2, layer.jitter + randRange(-0.6,0.6));
    });
    setTimeout(wanderTargets, 700 + Math.random() * 2600);
  }
  wanderTargets();

  // pointer tracking for natural motion
  let pointer = { x: width/2, y: height/2 };
  let targetPointer = { x: width/2, y: height/2 };
  function updatePointer(x,y){
    targetPointer.x = Math.max(0, Math.min(window.innerWidth, x || 0));
    targetPointer.y = Math.max(0, Math.min(window.innerHeight, y || 0));
  }
  window.addEventListener('mousemove', e => updatePointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', e => {
    if (e.touches && e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  function gradient(alpha){
    const g = ctx.createLinearGradient(0,0,width,height);
    g.addColorStop(0, `rgba(167,140,255,${0.42 * alpha})`);
    g.addColorStop(0.35, `rgba(255,140,180,${0.34 * alpha})`);
    g.addColorStop(0.65, `rgba(120,220,245,${0.28 * alpha})`);
    g.addColorStop(1, `rgba(255,255,255,${0.12 * alpha})`);
    return g;
  }

  function drawLayer(layer, index, time){
    ctx.beginPath();
    const baseline = height * (0.48 + 0.06 * Math.sin(time*0.0007 + index*0.7));
    const step = Math.max(1, Math.floor(width / 420));
    for (let x = 0; x <= width; x += step) {
      const dx = x - pointer.x;
      const distFactor = Math.exp(-Math.abs(dx) / (170 + index*50));
      const microNoise = Math.sin((x * (0.002 + index*0.0007)) + time*0.0011 + index) * (layer.jitter);
      const amplitude = Math.max(3, layer.amp + microNoise);
      const phase = (x / layer.wavelength) * 2 * Math.PI + layer.phase + Math.sin(time * (0.0005 + index*0.00015));
      const y = baseline + amplitude * Math.sin(phase) - distFactor * (pointer.y - height/2) * 0.36;
      if (x === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle = gradient(1 - index * 0.11);
    ctx.lineWidth = Math.max(1.2, layer.lineWidth);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  let last = performance.now();
  let raf = null;
  function animate(now){
    const dt = now - last;
    last = now;
    ctx.clearRect(0,0,width,height);
    // ease pointer
    pointer.x = lerp(pointer.x, targetPointer.x, 0.08);
    pointer.y = lerp(pointer.y, targetPointer.y, 0.08);
    layers.forEach(layer => {
      layer.amp = lerp(layer.amp, layer.ampTarget, 0.02);
      layer.phase += layer.speed * (1 + Math.sin(now * 0.00035 + layer.phase));
    });
    for (let i = 0; i < layers.length; i++) drawLayer(layers[i], i, now);
    raf = requestAnimationFrame(animate);
  }
  raf = requestAnimationFrame(animate);

  // conserve on low-memory devices
  if (navigator.deviceMemory && navigator.deviceMemory <= 1.5 && layers.length > 2) {
    layers.splice(2);
    console.info('[waves] reduced layers for low memory device');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else { if (!raf) raf = requestAnimationFrame(animate); }
  });
})();

// initial small focus
searchInput && searchInput.focus();
