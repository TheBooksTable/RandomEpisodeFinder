// ---------------- Helper ----------------
const $ = id => document.getElementById(id);

let currentShow = null;
let allEpisodes = [];
let favorites = [];
const SURPRISE_LIST = [
  'Breaking Bad','The Office','Friends','SpongeBob SquarePants',
  'Rick and Morty','Stranger Things','The Simpsons','Archer',
  'Seinfeld','Avatar: The Last Airbender','Smiling Friends',
  'BoJack Horseman','Black Mirror','Brooklyn Nine-Nine'
];

// ---------------- DOM ----------------
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const findBtn = $('findBtn');
const surpriseBtn = $('surpriseBtn');
const clearBtn = $('clearBtn');
const fromSeason = $('fromSeason');
const toSeason = $('toSeason');
const resultArea = $('resultArea');
const favoritesList = $('favoritesList');

// ---------------- Spinner / Messages ----------------
function showMessage(msg, type='info'){
  resultArea.innerHTML = `<p style="color:${type==='error'?'#ff6b6b':'#a5d6ff'}">${msg}</p>`;
  resultArea.classList.remove('hidden');
}
function toggleSpinner(show){
  if(show) showMessage('Loading...', 'info');
  [searchBtn, findBtn, surpriseBtn].forEach(b => b.disabled = show);
}

// ---------------- Favorites ----------------
function renderFavorites(){
  favoritesList.innerHTML = '';
  if(favorites.length===0){
    favoritesList.innerHTML = '<li class="muted">No favorites yet</li>';
    return;
  }
  favorites.forEach(f => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="favItem">${f}</span> <button class="removeFav">✕</button>`;
    li.querySelector('button').addEventListener('click', ()=>{ favorites = favorites.filter(x=>x!==f); renderFavorites(); });
    favoritesList.appendChild(li);
  });
}
clearBtn.addEventListener('click', ()=>{ favorites = []; renderFavorites(); });

// ---------------- Fetch ----------------
async function fetchShowEpisodes(showName){
  try{
    toggleSpinner(true);
    resultArea.innerHTML = '';
    const resp = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showName)}&embed=episodes`);
    if(!resp.ok) throw new Error('Show not found');
    const data = await resp.json();
    currentShow = data;
    allEpisodes = data._embedded.episodes;
    populateSeasonRange();
    showRandomEpisode();
  }catch(err){
    showMessage(err.message, 'error');
  }finally{
    toggleSpinner(false);
  }
}

// ---------------- Season Range ----------------
function populateSeasonRange(){
  const seasons = [...new Set(allEpisodes.map(ep=>ep.season))].sort((a,b)=>a-b);
  fromSeason.innerHTML = ''; toSeason.innerHTML = '';
  seasons.forEach(s=>{
    const opt1 = document.createElement('option'); opt1.value=s; opt1.textContent=s;
    const opt2 = document.createElement('option'); opt2.value=s; opt2.textContent=s;
    fromSeason.appendChild(opt1); toSeason.appendChild(opt2);
  });
}

// ---------------- Random Episode ----------------
function showRandomEpisode(){
  if(!allEpisodes.length) return showMessage('No episodes loaded', 'error');
  const from = parseInt(fromSeason.value) || 1;
  const to = parseInt(toSeason.value) || Math.max(...allEpisodes.map(e=>e.season));
  const filtered = allEpisodes.filter(e=>e.season>=from && e.season<=to);
  const ep = filtered[Math.floor(Math.random()*filtered.length)];
  renderEpisode(ep);
}
function renderEpisode(ep){
  resultArea.innerHTML = '';
  const div = document.createElement('div');
  div.className='result';
  div.innerHTML=`
    <div class="thumb"><img src="${ep.image?.medium||''}" alt="${ep.name}" /></div>
    <div class="meta">
      <h2>${ep.name}</h2>
      <p>Season ${ep.season}, Episode ${ep.number}</p>
      <p>${ep.summary||''}</p>
      <button class="btn btn-clear">★ Add to Favorites</button>
    </div>`;
  div.querySelector('button').addEventListener('click', ()=>{
    if(!favorites.includes(currentShow.name)) favorites.push(currentShow.name);
    renderFavorites();
  });
  resultArea.appendChild(div);
  resultArea.classList.remove('hidden');
}

// ---------------- Surprise ----------------
function surpriseMe(){
  const list = [...new Set(SURPRISE_LIST)];
  const show = list[Math.floor(Math.random()*list.length)];
  searchInput.value = show;
  fetchShowEpisodes(show);
}

// ---------------- Event Listeners ----------------
searchBtn.addEventListener('click', ()=>fetchShowEpisodes(searchInput.value));
findBtn.addEventListener('click', showRandomEpisode);
surpriseBtn.addEventListener('click', surpriseMe);

// ---------------- Keyboard Shortcuts ----------------
document.addEventListener('keydown', e=>{
  if(e.key==='Enter') searchBtn.click();
  // R shortcut removed
});

// ---------------- Siri Waves ----------------
(function initSiriWave(){
  const canvas = document.getElementById('siriWave');
  const ctx = canvas.getContext('2d');
  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  let pointer = {x: width/2, y: height/2};
  let target = {x: width/2, y: height/2};
  window.addEventListener('mousemove', e=>{ target.x=e.clientX; target.y=e.clientY; }, {passive:true});

  const layers = [
    {amplitude: 20, wavelength: 300, speed: 0.02, phase: 0, color:'rgba(138,99,255,0.4)'},
    {amplitude: 14, wavelength: 240, speed: 0.018, phase: 0, color:'rgba(109,142,255,0.3)'},
    {amplitude: 10, wavelength: 180, speed: 0.025, phase: 0, color:'rgba(173,99,255,0.25)'}
  ];

  function lerp(a,b,t){ return a + (b-a)*t; }

  function draw(){
    ctx.clearRect(0,0,width,height);
    pointer.x = lerp(pointer.x, target.x, 0.06);
    pointer.y = lerp(pointer.y, target.y, 0.06);

    layers.forEach(l=>{
      ctx.beginPath();
      let prevY = pointer.y;
      for(let x=0;x<width;x+=2){
        let dx = x-pointer.x;
        let factor = Math.exp(-Math.abs(dx)/150);
        let rand = (Math.random()-0.5)*0.5; // random variation
        let y = pointer.y + Math.sin((x/l.wavelength)*2*Math.PI + l.phase)*l.amplitude + factor*rand*50;
        if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        prevY = y;
      }
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      l.phase += l.speed;
    });
    requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', ()=>{
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
})();
