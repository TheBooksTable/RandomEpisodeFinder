// ----------------------------
// script.js (fixed + siri-wave appended)
// ----------------------------

const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
const SURPRISE_LIST = [
  'Breaking Bad','The Office','Friends','SpongeBob SquarePants',
  'Rick and Morty','Stranger Things','The Simpsons','Archer',
  'Seinfeld','Avatar: The Last Airbender', 'Smiling Friends',
  'BoJack Horseman', 'Black Mirror', 'Brooklyn Nine-Nine',
  'Supernatural', 'South Park', 'Twin Peaks','Fargo',
  'Better Call Saul','Smiling Friends', 'Infinity Train',
  'Kipo and the Age of Wonderbeasts', 'Tuca & Bertie',
  'Final Space', 'The Midnight Gospel', 'Undone',
  'Close Enough', 'Hilda', 'F Is for Family',
  'Solar Opposites', 'Golan the Insatiable',
  'Adventure Time: Distant Lands', 'Over the Garden Wall',
  'Primal', 'Magical Girl Raising Project', 'Welcome to the Ballroom',
  'Aggretsuko', 'Bee and PuppyCat', 'King Star King',
  'The Shivering Truth', '12 oz. Mouse', 'The Brak Show',
  'Drawn Together', 'Superjail!'
];

function loadFavorites(){
  try { return JSON.parse(localStorage.getItem('ref-favs')||'[]'); } catch(e){ return []; }
}
function saveFavorites(list){ localStorage.setItem('ref-favs', JSON.stringify(list)); }

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
    li.innerHTML = `
      <span class="favItem" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
      <button data-id="${s.id}" class="removeFav">✖</button>
    `;
    ul.appendChild(li);
  });

  // Clicking a favorite runs a search
  document.querySelectorAll('.favItem').forEach(el => {
    el.addEventListener('click', e => {
      const name = e.currentTarget.dataset.name;
      if($('searchInput')) $('searchInput').value = name;
      if($('searchBtn')) $('searchBtn').click();
    });
  });

  // Remove favorite buttons
  document.querySelectorAll('.removeFav').forEach(b =>
    b.addEventListener('click', e => {
      const id = Number(e.currentTarget.dataset.id);
      const newList = loadFavorites().filter(x => x.id !== id);
      saveFavorites(newList);
      renderFavorites();
    })
  );
}

function escapeHtml(str){
  return (''+str).replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

// Safe fetch wrappers (keeps errors visible but doesn't break rest if something else fails)
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
  from.value = seasons[0];
  to.value = seasons[seasons.length-1];
}

// Remove HTML comments conservatively
function removeHtmlComments(str){
  return (''+str).replace(/<!--[\s\S]*?-->/g, '');
}

// Strips all HTML tags using safe DOM APIs.
function simpleSanitizeHtml(str) {
  const div = document.createElement('div');
  div.innerHTML = str || '';
  return div.textContent || div.innerText || "";
}

function filterEpisodesBySeasonRange(eps, fromS, toS){
  return eps.filter(e => e.season >= fromS && e.season <= toS);
}
function pickRandom(arr){ return arr && arr.length ? arr[Math.floor(Math.random()*arr.length)] : null; }

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
    <div class="thumb"><img src="${img}" alt="thumb"/></div>
    <div class="meta">
      <div class="muted">${escapeHtml(show.name)} — S${episode.season}E${episode.number}</div>
      <h2>${escapeHtml(episode.name || 'Untitled')}</h2>
      <p class="muted">Aired: ${escapeHtml(episode.airdate || 'Unknown')}</p>
      <p>${escapeHtml(summaryText)}</p>
      <button id="saveFav" class="btn btn-clear">♡ Save Show</button>
    </div>
    <div class="rating">${escapeHtml(rating)}</div>
  `;

  const saveBtn = $('saveFav');
  if(saveBtn){
    saveBtn.addEventListener('click', () => {
      const favs = loadFavorites();
      if(!favs.find(f=>f.id===show.id)){
        favs.push({id: show.id, name: show.name});
        saveFavorites(favs);
        renderFavorites();
        alert('Saved to favorites!');
      } else {
        alert('Already in favorites');
      }
    });
  }
}

// --- Events ---
if ($('searchBtn')) {
  $('searchBtn').addEventListener('click', async () => {
    const q = $('searchInput') ? $('searchInput').value.trim() : '';
    if(!q){ alert('Type a show name'); return; }
    try {
      const data = await searchShow(q);
      if(!data || data.length===0){ alert('No shows found'); return; }
      currentShow = data[0].show;
      allEpisodes = await getEpisodesForShow(currentShow.id);
      populateSeasonSelectors(allEpisodes);
      const ep = pickRandom(allEpisodes);
      if(ep) renderResult(ep, currentShow);
    } catch(err) { console.error(err); alert('Error: '+err.message); }
  });
}

if ($('findBtn')) {
  $('findBtn').addEventListener('click', () => {
    if(!currentShow || !allEpisodes || allEpisodes.length===0){ alert('Search a show first'); return; }
    const fromS = Number($('fromSeason').value);
    const toS = Number($('toSeason').value);
    const filtered = filterEpisodesBySeasonRange(allEpisodes, fromS, toS);
    if(!filtered || filtered.length===0){ alert('No episodes in that range'); return; }
    renderResult(pickRandom(filtered), currentShow);
  });
}

if ($('surpriseBtn')) {
  $('surpriseBtn').addEventListener('click', () => {
    const showName = pickRandom(SURPRISE_LIST);
    if($('searchInput')) $('searchInput').value = showName;
    if($('searchBtn')) $('searchBtn').click();
  });
}

if ($('clearBtn')) {
  $('clearBtn').addEventListener('click', () => {
    if(confirm('Clear all favorites?')){
      localStorage.removeItem('ref-favs');
      renderFavorites();
    }
  });
}

if ($('searchInput')) {
  $('searchInput').addEventListener('keydown', e => {
    if(e.key==='Enter') {
      if($('searchBtn')) $('searchBtn').click();
    }
  });
}

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
// Siri-style wave: robust, mobile-friendly
// Append this final IIFE at the end of the file
// -----------------------------

(function initSiriWave(){
  try {
    // ensure canvas exists (your HTML already has it but we guard anyway)
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

    // device pixel ratio support
    let width = 0, height = 0;
    function resizeCanvas(){
      const ratio = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(window.innerWidth));
      const h = Math.max(1, Math.round(window.innerHeight));
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // normalize drawing
      width = w; height = h;
    }
    resizeCanvas();

    // inject minimal CSS if missing (keeps canvas behind UI)
    if (!document.querySelector('style[data-siriwave]')) {
      const css = `
        #siriWave { position: fixed; top:0; left:0; width:100vw; height:100vh; z-index:-1; pointer-events:none; }
      `;
      const st = document.createElement('style');
      st.setAttribute('data-siriwave','1');
      st.appendChild(document.createTextNode(css));
      document.head.appendChild(st);
    }

    // pointer tracking
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

    // multi-layer waves
    const waves = [
      { baseAmplitude: 25, wavelength: 300, speed: 0.02, phase: 0 },
      { baseAmplitude: 18, wavelength: 240, speed: 0.018, phase: 0 },
      { baseAmplitude: 14, wavelength: 180, speed: 0.025, phase: 0 }
    ];

    function lerp(a,b,t){ return a + (b - a) * t; }
    function createGradient(){
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, 'rgba(0,150,255,0.55)');
      g.addColorStop(0.35, 'rgba(255,0,255,0.45)');
      g.addColorStop(0.7, 'rgba(0,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0.18)');
      return g;
    }

    function drawWave(wave){
      ctx.beginPath();
      ctx.moveTo(0, pointer.y);
      // step by 2 for perf
      for(let x=0; x<width; x+=2){
        const dx = x - pointer.x;
        const distanceFactor = Math.exp(-Math.abs(dx)/150);
        const amplitude = wave.baseAmplitude + Math.sin(Date.now()*0.002 + x*0.01) * 5;
        const y = pointer.y
          + amplitude * Math.sin((x / wave.wavelength) * 2 * Math.PI + wave.phase)
          - distanceFactor * (pointer.y - height/2) * 0.33;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = createGradient();
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    let raf = null;
    function draw(){
      ctx.clearRect(0,0,width,height);
      pointer.x = lerp(pointer.x, targetPointer.x, 0.06);
      pointer.y = lerp(pointer.y, targetPointer.y, 0.06);
      for(let i=0;i<waves.length;i++){
        drawWave(waves[i]);
        waves[i].phase += waves[i].speed;
      }
      raf = requestAnimationFrame(draw);
    }
    draw();

    // resize handling (throttled)
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
        if(!raf) draw();
      }
    });

    // low-memory devices: reduce layers
    if(navigator.deviceMemory && navigator.deviceMemory <= 1.5 && waves.length > 2) {
      waves.splice(2);
    }

  } catch(err) {
    console.error('siriWave init error:', err);
  }
})();
