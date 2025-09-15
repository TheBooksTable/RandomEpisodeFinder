const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
let isLoading = false;

// ----------------------------
// SURPRISE LIST with weights
// ----------------------------
const SURPRISE_LIST = [
  'Breaking Bad','The Office','Friends','SpongeBob SquarePants',
  'Rick and Morty','Stranger Things','The Simpsons','Archer',
  'Seinfeld','Avatar: The Last Airbender', 'Smiling Friends',
  'BoJack Horseman', 'Black Mirror', 'Brooklyn Nine-Nine',
  'Supernatural', 'South Park', 'Twin Peaks','Fargo',
  'Better Call Saul','Infinity Train','Kipo and the Age of Wonderbeasts',
  'Tuca & Bertie','Final Space', 'The Midnight Gospel', 'Undone',
  'Close Enough', 'Hilda', 'F Is for Family','Solar Opposites',
  'Golan the Insatiable','Adventure Time: Distant Lands',
  'Over the Garden Wall','Primal','Magical Girl Raising Project',
  'Welcome to the Ballroom','Aggretsuko','Bee and PuppyCat',
  'King Star King','The Shivering Truth','12 oz. Mouse','The Brak Show',
  'Drawn Together','Superjail!'
];

// De-duplicate and create weighted array
const weightedSURPRISE = [];
SURPRISE_LIST.forEach(s => {
  // give some shows higher weight (more likely)
  const weight = Math.floor(Math.random()*3)+1;
  for(let i=0;i<weight;i++) weightedSURPRISE.push(s);
});

// ----------------------------
// Loading / Error UI helpers
// ----------------------------
function showSpinner(btn){
  if(btn) btn.disabled = true;
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  spinner.innerHTML = '⏳';
  return spinner;
}

function hideSpinner(btn, spinner){
  if(btn) btn.disabled = false;
  if(spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
}

function showError(message){
  let errEl = $('errorMsg');
  if(!errEl){
    errEl = document.createElement('div');
    errEl.id = 'errorMsg';
    errEl.style.color = '#ff6666';
    errEl.style.margin = '10px 0';
    $('resultArea').parentNode.insertBefore(errEl, $('resultArea'));
  }
  errEl.textContent = message;
}

// ----------------------------
// Favorites
// ----------------------------
function loadFavorites(){ try { return JSON.parse(localStorage.getItem('ref-favs')||'[]'); } catch(e){ return []; } }
function saveFavorites(list){ localStorage.setItem('ref-favs', JSON.stringify(list)); }

function renderFavorites(){
  const list = loadFavorites();
  const ul = $('favoritesList');
  if(!ul) return;
  ul.innerHTML = '';
  if(list.length===0){ ul.innerHTML = '<li class="muted">No favorites yet</li>'; return; }
  list.forEach(s => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="favItem" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
      <button data-id="${s.id}" class="removeFav">✖</button>
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll('.favItem').forEach(el => {
    el.addEventListener('click', e => {
      const name = e.currentTarget.dataset.name;
      if($('searchInput')) $('searchInput').value = name;
      if($('searchBtn')) $('searchBtn').click();
    });
  });

  document.querySelectorAll('.removeFav').forEach(b =>
    b.addEventListener('click', e => {
      const id = Number(e.currentTarget.dataset.id);
      const newList = loadFavorites().filter(x => x.id !== id);
      saveFavorites(newList);
      renderFavorites();
    })
  );
}

function escapeHtml(str){ return (''+str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ----------------------------
// API helpers
// ----------------------------
async function searchShow(query){
  try{
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    if(!res.ok) throw new Error('Search failed');
    return res.json();
  }catch(e){ throw new Error('Search failed: '+e.message); }
}

async function getEpisodesForShow(showId){
  try{
    const res = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
    if(!res.ok) throw new Error('Episodes fetch failed');
    return res.json();
  }catch(e){ throw new Error('Episodes fetch failed: '+e.message); }
}

// ----------------------------
// Season selectors
// ----------------------------
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

function filterEpisodesBySeasonRange(eps, fromS, toS){ return eps.filter(e => e.season >= fromS && e.season <= toS); }
function pickRandom(arr){ return arr && arr.length ? arr[Math.floor(Math.random()*arr.length)] : null; }

// ----------------------------
// Rendering result
// ----------------------------
function renderResult(episode, show){
  showError(''); // clear error
  const container = $('resultArea');
  if(!container) return;
  container.classList.remove('hidden');

  const img = (episode && episode.image && episode.image.medium) || (show && show.image && show.image.medium) || 'https://via.placeholder.com/300x200?text=No+Image';
  const summaryText = episode && episode.summary ? stripHtml(episode.summary).trim() : 'No summary available.';
  const rating = (episode && episode.rating && episode.rating.average) ? episode.rating.average : '';

  container.innerHTML = `
    <div class="thumb"><img src="${img}" alt="thumb"/></div>
    <div class="meta">
      <div class="muted">${escapeHtml(show.name)} — S${episode.season}E${episode.number}</div>
      <h2>${escapeHtml(episode.name || 'Untitled')}</h2>
      <p class="muted">Aired: ${escapeHtml(episode.airdate || 'Unknown')}</p>
      <p>${escapeHtml(summaryText)}</p>
      <button id="saveFav" class="btn btn-clear" aria-label="Save to favorites">♡ Save Show</button>
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
      } else { alert('Already in favorites'); }
    });
  }
}

function stripHtml(str){
  const div = document.createElement('div');
  div.innerHTML = str || '';
  return div.textContent || div.innerText || '';
}

// ----------------------------
// Event handlers
// ----------------------------
async function handleSearch(){
  const btn = $('searchBtn');
  const query = $('searchInput') ? $('searchInput').value.trim() : '';
  if(!query){ showError('Please type a show name'); return; }
  const spinner = showSpinner(btn);
  try{
    const data = await searchShow(query);
    if(!data || data.length===0){ showError('No shows found'); return; }
    currentShow = data[0].show;
    allEpisodes = await getEpisodesForShow(currentShow.id);
    populateSeasonSelectors(allEpisodes);
    const ep = pickRandom(allEpisodes);
    if(ep) renderResult(ep, currentShow);
  }catch(err){ showError(err.message); }
  finally{ hideSpinner(btn, spinner); }
}

function handleRandom(){
  if(!currentShow || !allEpisodes || allEpisodes.length===0){ showError('Search a show first'); return; }
  const fromS = Number($('fromSeason').value);
  const toS = Number($('toSeason').value);
  const filtered = filterEpisodesBySeasonRange(allEpisodes, fromS, toS);
  if(!filtered || filtered.length===0){ showError('No episodes in that range'); return; }
  renderResult(pickRandom(filtered), currentShow);
}

function handleSurprise(){
  const showName = pickRandom(weightedSURPRISE);
  if($('searchInput')) $('searchInput').value = showName;
  handleSearch();
}

// ----------------------------
// Setup event listeners
// ----------------------------
if ($('searchBtn')) $('searchBtn').addEventListener('click', handleSearch);
if ($('findBtn')) $('findBtn').addEventListener('click', handleRandom);
if ($('surpriseBtn')) $('surpriseBtn').addEventListener('click', handleSurprise);
if ($('clearBtn')) $('clearBtn').addEventListener('click', () => {
  if(confirm('Clear all favorites?')){
    localStorage.removeItem('ref-favs');
    renderFavorites();
  }
});

if($('searchInput')){
  $('searchInput').addEventListener('keydown', e => {
    if(e.key==='Enter') handleSearch();
  });
}

// Keyboard shortcuts
window.addEventListener('keydown', e=>{
  if(e.target.tagName==='INPUT') return; // skip typing
  if(e.key.toLowerCase()==='s') handleSearch();
  if(e.key.toLowerCase()==='r') handleSurprise();
});

renderFavorites();

// ----------------------------
// Siri-style waves
// ----------------------------
(function initSiriWave(){
  let canvas = $('siriWave');
  if(!canvas){
    canvas = document.createElement('canvas');
    canvas.id = 'siriWave';
    document.body.insertBefore(canvas, document.body.firstChild);
  }
  const ctx = canvas.getContext('2d');
  if(!ctx) return;

  let width = 0, height = 0;
  function resizeCanvas(){
    const ratio = window.devicePixelRatio || 1;
    width = Math.max(1, Math.round(window.innerWidth));
    height = Math.max(1, Math.round(window.innerHeight));
    canvas.width = width*ratio;
    canvas.height = height*ratio;
    canvas.style.width = width+'px';
    canvas.style.height = height+'px';
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  resizeCanvas();

  const waves = [
    { amp: 20, wavelength: 300, speed:0.02, phase:0 },
    { amp: 15, wavelength: 200, speed:0.025, phase:0 },
    { amp: 10, wavelength: 150, speed:0.018, phase:0 }
  ];

  let pointer = {x: width/2, y: height/2};
  let target = {x: width/2, y: height/2};
  function updatePointer(x,y){
    target.x = Math.max(0, Math.min(width, x||0));
    target.y = Math.max(0, Math.min(height, y||0));
  }

  window.addEventListener('mousemove', e=>updatePointer(e.clientX,e.clientY), {passive:true});
  window.addEventListener('touchmove', e=>{
    if(e.touches && e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
  },{passive:true});

  function lerp(a,b,t){ return a+(b-a)*t; }

  function drawWave(w){
    ctx.beginPath();
    ctx.moveTo(0, pointer.y);
    for(let x=0;x<width;x+=2){
      const dx = x-pointer.x;
      const df = Math.exp(-Math.abs(dx)/150);
      const y = pointer.y + (w.amp + Math.sin(Date.now()*0.002 + x*0.01)*5) * Math.sin((x/w.wavelength)*2*Math.PI + w.phase) - df*(pointer.y-height/2)*0.33;
      ctx.lineTo(x,y);
    }
    const grad = ctx.createLinearGradient(0,0,width,height);
    grad.addColorStop(0,'rgba(0,150,255,0.55)');
    grad.addColorStop(0.35,'rgba(255,0,255,0.45)');
    grad.addColorStop(0.7,'rgba(0,255,255,0.35)');
    grad.addColorStop(1,'rgba(255,255,255,0.18)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  let raf=null;
  function draw(){
    ctx.clearRect(0,0,width,height);
    pointer.x = lerp(pointer.x,target.x,0.06);
    pointer.y = lerp(pointer.y,target.y,0.06);
    waves.forEach(w=>{
      drawWave(w);
      w.phase+=w.speed;
    });
    raf=requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', resizeCanvas);
})();
