const $ = id => document.getElementById(id);

let currentShow = null;
let allEpisodes = [];
let isFetching = false;

// --- SURPRISE LIST (deduplicated) ---
const SURPRISE_LIST = Array.from(new Set([
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
  '12 oz. Mouse','The Brak Show','Drawn Together','Superjail!'
]));

// --- FAVORITES STORAGE ---
function loadFavorites(){ 
  try { return JSON.parse(localStorage.getItem('ref-favs')||'[]'); } 
  catch(e){ return []; } 
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

function escapeHtml(str){
  return (''+str).replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

// --- SIMPLE SANITIZER FIX ---
function simpleSanitizeHtml(str){
  // Remove all HTML tags (basic, safe for summaries)
  return (''+str).replace(/<[^>]*>?/gm, '');
}

// --- FETCH HELPERS ---
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

function filterEpisodesBySeasonRange(eps, fromS, toS){
  return eps.filter(e=>e.season>=fromS && e.season<=toS);
}

// --- RENDER EPISODE ---
function renderResult(episode, show){
  const container = $('resultArea');
  if(!container) return;
  container.classList.remove('hidden');
  container.setAttribute('tabindex','-1');
  container.focus();

  const img = (episode && episode.image && episode.image.medium) ||
              (show && show.image && show.image.medium) ||
              'https://via.placeholder.com/300x200?text=No+Image';

  const summaryText = episode && episode.summary
    ? simpleSanitizeHtml(episode.summary).trim()
    : 'No summary available.';

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
      }
    });
  }
}

// --- INLINE ERROR / LOADING ---
function setLoading(state){
  if($('loadingSpinner')) $('loadingSpinner').classList.toggle('hidden', !state);
  $('searchBtn').disabled = $('findBtn').disabled = $('surpriseBtn').disabled = state;
}
function setError(msg){
  const err = $('errorMsg'); if(err){ err.textContent = msg; err.style.display = msg?'block':'none'; }
}

// --- RANDOM EPISODE FETCH ---
async function findRandomEpisode(){
  if(isFetching) return;
  isFetching = true;
  setLoading(true); setError('');

  try{
    const query = $('searchInput').value.trim();
    if(!query) throw new Error('Please type a show name or use Surprise');
    const data = await searchShow(query);
    if(!data.length) throw new Error('No show found');
    currentShow = data[0].show;
    allEpisodes = await getEpisodesForShow(currentShow.id);
    populateSeasonSelectors(allEpisodes);

    const fromS = parseInt($('fromSeason').value), toS=parseInt($('toSeason').value);
    const filtered = filterEpisodesBySeasonRange(allEpisodes, fromS, toS);
    if(!filtered.length) throw new Error('No episodes found in selected seasons');
    const ep = filtered[Math.floor(Math.random()*filtered.length)];
    renderResult(ep, currentShow);
  } catch(err){
    setError(err.message);
  } finally{ setLoading(false); isFetching=false; }
}

// --- SURPRISE ---
async function surprise(){
  const name = SURPRISE_LIST[Math.floor(Math.random()*SURPRISE_LIST.length)];
  $('searchInput').value = name;
  await findRandomEpisode();
}

// --- EVENTS ---
document.addEventListener('DOMContentLoaded', () => {
  renderFavorites();
  if($('searchBtn')) $('searchBtn').addEventListener('click', findRandomEpisode);
  if($('surpriseBtn')) $('surpriseBtn').addEventListener('click', surprise);

  // keyboard shortcuts
  document.addEventListener('keydown', e=>{
    if(e.key==='Enter') $('searchBtn').click();
    if(e.key.toLowerCase()==='r') $('surpriseBtn').click();
  });
});

// ----------------------------
// Siri-style glowing waves
// ----------------------------
const waveCanvas = $('siriWave');
if(waveCanvas){
  const waveCtx = waveCanvas.getContext('2d');
  let width = waveCanvas.width = window.innerWidth;
  let height = waveCanvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = waveCanvas.width = window.innerWidth;
    height = waveCanvas.height = window.innerHeight;
  });

  class SiriWave {
    constructor(color, baseAmp, speed, wavelength, phase){
      this.color=color; this.baseAmp=baseAmp; this.amp=baseAmp;
      this.speed=speed; this.wavelength=wavelength; this.phase=phase; this.offset=0;
    }
    draw(){
      waveCtx.beginPath();
      for(let x=0;x<=width;x++){
        const y = height/2 + Math.sin((x*this.wavelength)+this.offset+this.phase)*
                  this.amp*(0.5+Math.random()*0.5);
        waveCtx.lineTo(x,y);
      }
      waveCtx.strokeStyle=this.color;
      waveCtx.lineWidth=2;
      waveCtx.shadowBlur = 12;
      waveCtx.shadowColor = this.color;
      waveCtx.stroke();
      this.amp=this.baseAmp + Math.sin(this.offset*0.3)*5 + (Math.random()*2-1)*3;
      this.offset += this.speed;
    }
  }

  const waves = [
    new SiriWave('rgba(109,142,255,0.3)', 25, 0.02, 0.02, 0),
    new SiriWave('rgba(255,109,142,0.2)', 15, 0.015, 0.018, Math.PI/3),
    new SiriWave('rgba(255,255,255,0.15)', 35, 0.01, 0.025, Math.PI/2),
    new SiriWave('rgba(138,99,255,0.1)', 20, 0.018, 0.03, Math.PI/4)
  ];

  (function animateWaves(){
    waveCtx.clearRect(0,0,width,height);
    waves.forEach(w=>w.draw());
    requestAnimationFrame(animateWaves);
  })();
}
