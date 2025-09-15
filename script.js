// ----------------------------
// script.js fully rewritten
// ----------------------------

const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
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
  '12 oz. Mouse','The Brak Show','Drawn Together','Superjail!'
];

// ----------------------------
// Favorites + LocalStorage
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
      <button data-id="${s.id}" class="removeFav" aria-label="Remove favorite">✖</button>
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll('.favItem').forEach(el=>{
    el.addEventListener('click', e=>{
      const name = e.currentTarget.dataset.name;
      $('searchInput').value = name;
      $('searchBtn').click();
    });
  });

  document.querySelectorAll('.removeFav').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = Number(e.currentTarget.dataset.id);
      const newList = loadFavorites().filter(x=>x.id!==id);
      saveFavorites(newList);
      renderFavorites();
    });
  });
}

function escapeHtml(str){
  return (''+str).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ----------------------------
// Fetch helpers
// ----------------------------
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

// ----------------------------
// UI Helpers
// ----------------------------
function showMessage(msg){ const el=$('inlineMessage'); if(el) el.textContent=msg; }
function clearMessage(){ const el=$('inlineMessage'); if(el) el.textContent=''; }
function setLoading(isLoading){
  ['searchBtn','findBtn','surpriseBtn'].forEach(id=>{
    const b=$(id); if(b) b.disabled=isLoading;
  });
}

// ----------------------------
// Episode rendering
// ----------------------------
function populateSeasonSelectors(episodes){
  const seasons=[...new Set(episodes.map(e=>e.season))].sort((a,b)=>a-b);
  const from=$('fromSeason'), to=$('toSeason'); if(!from||!to) return;
  from.innerHTML=''; to.innerHTML='';
  seasons.forEach(s=>{
    const opt=document.createElement('option');
    opt.value=s; opt.textContent=`Season ${s}`;
    from.appendChild(opt); to.appendChild(opt.cloneNode(true));
  });
  from.value=seasons[0]; to.value=seasons[seasons.length-1];
}

function simpleSanitizeHtml(str){ const div=document.createElement('div'); div.innerHTML=str||''; return div.textContent||div.innerText||''; }
function removeHtmlComments(str){ return (''+str).replace(/<!--[\s\S]*?-->/g,''); }
function filterEpisodesBySeasonRange(eps, fromS, toS){ return eps.filter(e=>e.season>=fromS && e.season<=toS); }
function pickRandom(arr){ return arr&&arr.length?arr[Math.floor(Math.random()*arr.length)]:null; }

function renderResult(episode, show){
  const container=$('resultArea'); if(!container) return;
  container.classList.remove('hidden');

  const img=(episode&&episode.image&&episode.image.medium)||(show&&show.image&&show.image.medium)||'https://via.placeholder.com/300x200?text=No+Image';
  const summaryText=episode&&episode.summary? removeHtmlComments(simpleSanitizeHtml(episode.summary)).trim():'No summary available.';
  const rating=(episode&&episode.rating&&episode.rating.average)?episode.rating.average:'';

  container.innerHTML=`
    <div class="thumb"><img src="${img}" alt="thumb"/></div>
    <div class="meta">
      <div class="muted">${escapeHtml(show.name)} — S${episode.season}E${episode.number}</div>
      <h2>${escapeHtml(episode.name||'Untitled')}</h2>
      <p class="muted">Aired: ${escapeHtml(episode.airdate||'Unknown')}</p>
      <p>${escapeHtml(summaryText)}</p>
      <button id="saveFav" class="btn btn-clear">♡ Save Show</button>
    </div>
    <div class="rating">${escapeHtml(rating)}</div>
  `;

  const saveBtn=$('saveFav');
  if(saveBtn){
    saveBtn.addEventListener('click',()=>{
      const favs=loadFavorites();
      if(!favs.find(f=>f.id===show.id)){
        favs.push({id:show.id,name:show.name});
        saveFavorites(favs);
        renderFavorites();
        showMessage('Saved to favorites!');
        setTimeout(clearMessage,2500);
      } else {
        showMessage('Already in favorites');
        setTimeout(clearMessage,2500);
      }
    });
  }
}

// ----------------------------
// Events
// ----------------------------
if($('searchBtn')) $('searchBtn').addEventListener('click',async()=>{
  const q=$('searchInput').value.trim(); if(!q){ showMessage('Type a show name'); return; }
  setLoading(true); showMessage('Searching...');
  try{
    const data=await searchShow(q); if(!data||data.length===0){ showMessage('No shows found'); return; }
    currentShow=data[0].show;
    allEpisodes=await getEpisodesForShow(currentShow.id);
    populateSeasonSelectors(allEpisodes);
    const ep=pickRandom(allEpisodes);
    if(ep) renderResult(ep,currentShow);
    clearMessage();
  } catch(err){ console.error(err); showMessage('Error: '+err.message); }
  setLoading(false);
});

if($('findBtn')) $('findBtn').addEventListener('click',()=>{
  if(!currentShow||!allEpisodes||allEpisodes.length===0){ showMessage('Search a show first'); return; }
  const fromS=Number($('fromSeason').value), toS=Number($('toSeason').value);
  const filtered=filterEpisodesBySeasonRange(allEpisodes,fromS,toS);
  if(!filtered||filtered.length===0){ showMessage('No episodes in that range'); return; }
  renderResult(pickRandom(filtered),currentShow);
});

if($('surpriseBtn')) $('surpriseBtn').addEventListener('click',()=>{
  const deduped=[...new Set(SURPRISE_LIST)];
  const showName=pickRandom(deduped);
  $('searchInput').value=showName;
  $('searchBtn').click();
});

if($('clearBtn')) $('clearBtn').addEventListener('click',()=>{
  if(confirm('Clear all favorites?')){
    localStorage.removeItem('ref-favs');
    renderFavorites();
  }
});

if($('searchInput')) $('searchInput').addEventListener('keydown', e=>{
  if(e.key==='Enter') $('searchBtn').click();
});

renderFavorites();

// ----------------------------
// UI helpers: toggle + install
// ----------------------------
(function(){
  const favToggle=$('favToggle'); const installBtn=$('installBtn');
  function updateToggleVisibility(){ if(window.innerWidth<=900){ if(favToggle) favToggle.style.display='inline-block'; } else { if(favToggle) favToggle.style.display='none'; } }
  updateToggleVisibility();
  window.addEventListener('resize',updateToggleVisibility,{passive:true});

  if(favToggle) favToggle.addEventListener('click',()=>{
    const appEl=document.querySelector('.app');
    if(appEl) appEl.classList.toggle('showFavs');
  });
})();

// ----------------------------
// Siri-style waves
// ----------------------------
(function initSiriWave(){
  const canvas=document.getElementById('siriWave');
  if(!canvas) return;
  const ctx=canvas.getContext('2d'); if(!ctx) return;

  canvas.style.position='fixed';
  canvas.style.top='0';
  canvas.style.left='0';
  canvas.style.zIndex='-1';
  canvas.style.pointerEvents='none';

  let width=window.innerWidth, height=window.innerHeight;
  function resizeCanvas(){
    const ratio=window.devicePixelRatio||1;
    width=window.innerWidth; height=window.innerHeight;
    canvas.width=width*ratio; canvas.height=height*ratio;
    canvas.style.width=width+'px'; canvas.style.height=height+'px';
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  resizeCanvas();

  let pointer={x:width/2,y:height/2};
  let target={x:width/2,y:height/2};
  window.addEventListener('mousemove',e=>{ target.x=e.clientX; target.y=e.clientY; },{passive:true});

  const waves=[
    {amplitude:25,wavelength:300,speed:0.02,phase:0,color:'rgba(138,99,255,0.4)'},
    {amplitude:18,wavelength:240,speed:0.018,phase:0,color:'rgba(109,142,255,0.3)'},
    {amplitude:12,wavelength:180,speed:0.025,phase:0,color:'rgba(173,99,255,0.25)'}
  ];

  function lerp(a,b,t){ return a + (b-a)*t; }

  function drawWave(wave){
    ctx.beginPath();
    for(let x=0;x<width;x+=2){
      const dx=x-pointer.x;
      const dist=Math.exp(-Math.abs(dx)/150);
      const randomFactor=(Math.random()-0.5)*0.3;
      const y=pointer.y + Math.sin((x/wave.wavelength)*2*Math.PI + wave.phase)*wave.amplitude + dist*randomFactor*50;
      if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=wave.color;
    ctx.lineWidth=2;
    ctx.stroke();
    wave.phase+=wave.speed;
  }

  function animate(){
    ctx.clearRect(0,0,width,height);
    pointer.x=lerp(pointer.x,target.x,0.06);
    pointer.y=lerp(pointer.y,target.y,0.06);
    waves.forEach(drawWave);
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('resize',resizeCanvas,{passive:true});
})();
