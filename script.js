// --- Helper ---
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

// --- Favorites ---
function loadFavorites(){ try { return JSON.parse(localStorage.getItem('ref-favs')||'[]'); } catch(e){ return []; } }
function saveFavorites(list){ localStorage.setItem('ref-favs', JSON.stringify(list)); }

function renderFavorites(){
  const list = loadFavorites();
  const ul = $('favoritesList');
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
      $('searchInput').value = e.currentTarget.dataset.name;
      $('searchBtn').click();
    });
  });

  document.querySelectorAll('.removeFav').forEach(b => 
    b.addEventListener('click', e => {
      const id = Number(e.currentTarget.dataset.id);
      saveFavorites(loadFavorites().filter(x => x.id !== id));
      renderFavorites();
    })
  );
}

function escapeHtml(str){
  return (''+str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// --- API ---
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
  from.innerHTML=''; to.innerHTML='';
  seasons.forEach(s => {
    const opt = document.createElement('option'); opt.value=s; opt.textContent=`Season ${s}`;
    from.appendChild(opt); to.appendChild(opt.cloneNode(true));
  });
  from.value = seasons[0]; to.value = seasons[seasons.length-1];
}

function removeHtmlComments(str){
  let prev;
  do { prev=str; str=str.replace(/<!--|--!?>/g,""); } while(str!==prev);
  return str;
}
function simpleSanitizeHtml(str){
  const div=document.createElement('div'); div.innerHTML=str;
  return div.textContent || div.innerText || "";
}
function filterEpisodesBySeasonRange(eps,fromS,toS){ return eps.filter(e=>e.season>=fromS && e.season<=toS); }
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function renderResult(episode, show){
  const container = $('resultArea'); container.classList.remove('hidden');
  const img = episode.image ? episode.image.medium : (show.image ? show.image.medium : 'https://via.placeholder.com/300x200?text=No+Image');
  container.innerHTML = `
    <div class="thumb"><img src="${img}" alt="thumb"/></div>
    <div class="meta">
      <div class="muted">${escapeHtml(show.name)} — S${episode.season}E${episode.number}</div>
      <h2>${escapeHtml(episode.name)}</h2>
      <p class="muted">Aired: ${episode.airdate || 'Unknown'}</p>
      <p>${episode.summary ? removeHtmlComments(simpleSanitizeHtml(episode.summary)) : 'No summary available.'}</p>
      <button id="saveFav" class="btn btn-clear">♡ Save Show</button>
    </div>
    <div class="rating">${episode.rating?.average || ''}</div>
  `;
  $('saveFav').addEventListener('click', ()=>{
    const favs = loadFavorites();
    if(!favs.find(f=>f.id===show.id)){ favs.push({id: show.id,name: show.name}); saveFavorites(favs); renderFavorites(); alert('Saved to favorites!'); }
    else alert('Already in favorites');
  });
}

// --- Events ---
$('searchBtn').addEventListener('click', async ()=>{
  const q = $('searchInput').value.trim(); if(!q){ alert('Type a show name'); return; }
  try {
    const data = await searchShow(q); if(data.length===0){ alert('No shows found'); return; }
    currentShow = data[0].show; allEpisodes = await getEpisodesForShow(currentShow.id);
    populateSeasonSelectors(allEpisodes); renderResult(pickRandom(allEpisodes), currentShow);
  } catch(err){ console.error(err); alert('Error: '+err.message); }
});

$('findBtn').addEventListener('click', ()=>{
  if(!currentShow || allEpisodes.length===0){ alert('Search a show first'); return; }
  const fromS=Number($('fromSeason').value), toS=Number($('toSeason').value);
  const filtered=filterEpisodesBySeasonRange(allEpisodes,fromS,toS);
  if(filtered.length===0){ alert('No episodes in that range'); return; }
  renderResult(pickRandom(filtered), currentShow);
});

$('surpriseBtn').addEventListener('click', ()=>{
  $('searchInput').value=pickRandom(SURPRISE_LIST); $('searchBtn').click();
});

$('clearBtn').addEventListener('click', ()=>{
  if(confirm('Clear all favorites?')){ localStorage.removeItem('ref-favs'); renderFavorites(); }
});

$('searchInput').addEventListener('keydown', e=>{ if(e.key==='Enter') $('searchBtn').click(); });
renderFavorites();

// --- PWA Install ---
const installBtn = $('installBtn');
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault();
  deferredPrompt = e;
  if(installBtn) installBtn.style.display='inline-block';
});

if(installBtn){
  installBtn.addEventListener('click', async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if(choice.outcome==='accepted') console.log('User accepted install');
    deferredPrompt=null; installBtn.style.display='none';
  });
}

// --- Mobile Favorites Toggle ---
const favToggle = $('favToggle');
function updateToggleVisibility(){
  if(window.innerWidth<=900){ if(favToggle) favToggle.style.display='inline-block'; }
  else { if(favToggle) favToggle.style.display='none'; }
}
updateToggleVisibility(); window.addEventListener('resize', updateToggleVisibility);

if(favToggle){
  favToggle.addEventListener('click', ()=>{
    document.querySelector('.app').classList.toggle('favs-collapsed');
    if(!document.querySelector('.app').classList.contains('favs-collapsed')) window.scrollTo({top:0,behavior:'smooth'});
  });
}

// --- Siri-style Waves ---
const canvas=$('siriWave'); const ctx=canvas.getContext('2d');
let width=canvas.width=window.innerWidth, height=canvas.height=window.innerHeight;
let pointer={x:width/2,y:height/2}, targetPointer={x:width/2,y:height/2};
function updatePointer(x,y){ targetPointer.x=x; targetPointer.y=y; }
window.addEventListener('mousemove', e=>updatePointer(e.clientX,e.clientY));
window.addEventListener('touchmove', e=>updatePointer(e.touches[0].clientX,e.touches[0].clientY));

const waves=[
  {baseAmplitude:25,wavelength:300,speed:0.02,phase:0},
  {baseAmplitude:20,wavelength:250,speed:0.018,phase:0},
  {baseAmplitude:15,wavelength:200,speed:0.025,phase:0}
];
function lerp(a,b,t){ return a+(b-a)*t; }
function createGradient(){
  const gradient=ctx.createLinearGradient(0,0,width,height);
  gradient.addColorStop(0,'rgba(0,150,255,0.6)');
  gradient.addColorStop(0.3,'rgba(255,0,255,0.5)');
  gradient.addColorStop(0.7,'rgba(0,255,255,0.4)');
  gradient.addColorStop(1,'rgba(255,255,255,0.3)');
  return gradient;
}
function drawWave(wave){
  ctx.beginPath();
  for(let x=0;x<width;x++){
    const amplitude=wave.baseAmplitude+Math.sin(Date.now()*0.002+x*0.01)*5;
    const dx=x-pointer.x;
    const distanceFactor=Math.exp(-Math.abs(dx)/150);
    const y=pointer.y + amplitude*Math.sin((x/wave.wavelength)*2*Math.PI+wave.phase) - distanceFactor*(pointer.y-height/2)*0.3;
    ctx.lineTo(x,y);
  }
  ctx.strokeStyle=createGradient(); ctx.lineWidth=2; ctx.stroke();
}

let animationFrame;
function draw(){
  ctx.clearRect(0,0,width,height);
  pointer.x=lerp(pointer.x,targetPointer.x,0.05);
  pointer.y=lerp(pointer.y,targetPointer.y,0.05);
  waves.forEach(wave=>{ drawWave(wave); wave.phase+=wave.speed; });
  animationFrame=requestAnimationFrame(draw);
}
draw();

window.addEventListener('resize', ()=>{
  width=canvas.width=window.innerWidth;
  height=canvas.height=window.innerHeight;
  pointer.x=targetPointer.x=width/2;
  pointer.y=targetPointer.y=height/2;
});

document.addEventListener('visibilitychange', ()=>{
  if(document.hidden) cancelAnimationFrame(animationFrame);
  else draw();
});
