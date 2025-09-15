// ----------------------------
// script.js (full updated)
// ----------------------------
const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
let isFetching = false;

// --- Deduplicated and weighted surprise list ---
const SURPRISE_LIST = Array.from(new Set([
  'Breaking Bad','The Office','Friends','SpongeBob SquarePants',
  'Rick and Morty','Stranger Things','The Simpsons','Archer',
  'Seinfeld','Avatar: The Last Airbender', 'Smiling Friends',
  'BoJack Horseman', 'Black Mirror', 'Brooklyn Nine-Nine',
  'Supernatural', 'South Park', 'Twin Peaks','Fargo',
  'Better Call Saul', 'Infinity Train', 'Kipo and the Age of Wonderbeasts',
  'Tuca & Bertie', 'Final Space', 'The Midnight Gospel', 'Undone',
  'Close Enough', 'Hilda', 'F Is for Family', 'Solar Opposites', 'Golan the Insatiable',
  'Adventure Time: Distant Lands', 'Over the Garden Wall', 'Primal', 'Magical Girl Raising Project',
  'Welcome to the Ballroom', 'Aggretsuko', 'Bee and PuppyCat', 'King Star King',
  'The Shivering Truth', '12 oz. Mouse', 'The Brak Show', 'Drawn Together', 'Superjail!'
]));

// --- Favorites ---
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
    li.innerHTML = `<span class="favItem" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span><button data-id="${s.id}" class="removeFav">✖</button>`;
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

// --- Safe fetch ---
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

// --- Populate seasons ---
function populateSeasonSelectors(episodes){
  const seasons = [...new Set(episodes.map(e=>e.season))].sort((a,b)=>a-b);
  const from = $('fromSeason'); const to = $('toSeason');
  if(!from || !to) return;
  from.innerHTML = ''; to.innerHTML = '';
  seasons.forEach(s => { const opt = document.createElement('option'); opt.value=s; opt.textContent=`Season ${s}`; from.appendChild(opt); to.appendChild(opt.cloneNode(true)); });
  from.value = seasons[0]; to.value = seasons[seasons.length-1];
}

function removeHtmlComments(str){ return (''+str).replace(/<!--[\s\S]*?-->/g, ''); }
function simpleSanitizeHtml(str){ const div=document.createElement('div'); div.innerHTML=str||''; return div.textContent||div.innerText||""; }
function filterEpisodesBySeasonRange(eps, fromS, toS){ return eps.filter(e=>e.season>=fromS && e.season<=toS); }

async function findRandomEpisode(){
  if(isFetching) return;
  isFetching = true;
  $('loadingSpinner').classList.remove('hidden');
  $('errorMsg').style.display='none';
  $('resultArea').classList.add('hidden');

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
    displayEpisode(ep, currentShow);
  } catch(err){
    $('errorMsg').textContent = err.message; $('errorMsg').style.display='block';
  } finally{ $('loadingSpinner').classList.add('hidden'); isFetching=false; }
}

function displayEpisode(ep, show){
  const r = $('resultArea'); r.innerHTML='';
  const thumb = document.createElement('div'); thumb.className='thumb';
  thumb.innerHTML = `<img src="${show.image?.medium||''}" alt="${escapeHtml(show.name)} poster">`;
  const meta = document.createElement('div'); meta.className='meta';
  meta.innerHTML = `<h2>${escapeHtml(show.name)} S${ep.season}E${ep.number} - ${escapeHtml(ep.name||'')}</h2><div>${simpleSanitizeHtml(ep.summary||'No summary')}</div>`;
  r.appendChild(thumb); r.appendChild(meta);
  r.classList.remove('hidden');
  r.focus();
}

// --- Surprise ---
async function surprise(){
  const name = SURPRISE_LIST[Math.floor(Math.random()*SURPRISE_LIST.length)];
  $('searchInput').value = name;
  await findRandomEpisode();
}

// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
  renderFavorites();
  $('searchBtn').addEventListener('click', findRandomEpisode);
  $('surpriseBtn').addEventListener('click', surprise);

  // keyboard shortcuts
  document.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ $('searchBtn').click(); }
    if(e.key.toLowerCase()==='r'){ $('surpriseBtn').click(); }
  });
});

// ----------------------------
// Siri-style wave animation
// ----------------------------
const canvas = $('siriWave');
const ctx = canvas.getContext('2d');
let width=canvas.width=window.innerWidth;
let height=canvas.height=window.innerHeight;

window.addEventListener('resize', ()=>{
  width=canvas.width=window.innerWidth;
  height=canvas.height=window.innerHeight;
});

class Wave {
  constructor(color, amp, speed){ this.color=color; this.amp=amp; this.speed=speed; this.offset=0; }
  draw(t){
    ctx.beginPath();
    for(let x=0;x<width;x++){
      const y = height/2 + Math.sin((x*0.02)+this.offset)*this.amp*(0.5+Math.random()*0.5);
      ctx.lineTo(x,y);
    }
    ctx.strokeStyle=this.color;
    ctx.lineWidth=2;
    ctx.stroke();
    this.offset += this.speed;
  }
}
const waves = [
  new Wave('rgba(109,142,255,0.3)', 25, 0.02),
  new Wave('rgba(255,109,142,0.2)', 15, 0.015),
  new Wave('rgba(255,255,255,0.1)', 35, 0.01)
];

function animate(){
  ctx.clearRect(0,0,width,height);
  waves.forEach(w=>w.draw(Date.now()*0.002));
  requestAnimationFrame(animate);
}
animate();
