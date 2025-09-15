const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
let SURPRISE_LIST = [
  'Breaking Bad','The Office','Friends','SpongeBob SquarePants',
  'Rick and Morty','Stranger Things','The Simpsons','Archer',
  'Seinfeld','Avatar: The Last Airbender','Smiling Friends',
  'BoJack Horseman','Black Mirror','Brooklyn Nine-Nine',
  'Supernatural','South Park','Twin Peaks','Fargo'
];

// Favorites
let favorites = JSON.parse(localStorage.getItem("favorites")||"[]");

// ---------- DOM ----------
const searchInput = $("searchInput"), searchBtn=$("searchBtn");
const resultArea=$("resultArea");
const fromSeason=$("fromSeason"), toSeason=$("toSeason");
const surpriseBtn=$("surpriseBtn"), findBtn=$("findBtn"), clearBtn=$("clearBtn");
const favoritesList = $("favoritesList");
const errorMsg = $("errorMsg");
const spinner = $("loadingSpinner");

// ---------- Helpers ----------
function sanitize(str){ return str.replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function showError(msg){ errorMsg.textContent = msg; }
function clearError(){ errorMsg.textContent = ""; }
function showSpinner(show){ spinner.classList.toggle("hidden", !show); }
function saveFavorites(){ localStorage.setItem("favorites", JSON.stringify(favorites)); }
function renderFavorites(){
  favoritesList.innerHTML = "";
  favorites.forEach(f=>{
    const li = document.createElement("li");
    li.innerHTML = `<span class="favItem">${f}</span>
      <button class="removeFav" aria-label="Remove favorite">×</button>`;
    li.querySelector("button").onclick = ()=>{ favorites=favorites.filter(x=>x!==f); saveFavorites(); renderFavorites(); };
    favoritesList.appendChild(li);
  });
}

// ---------- Fetch show ----------
async function fetchShow(name){
  clearError(); showSpinner(true);
  try{
    const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(name)}&embed=episodes`);
    if(!res.ok) throw new Error("Show not found");
    const data = await res.json();
    allEpisodes = data._embedded.episodes;
    currentShow = data;
    populateSeasons();
  } catch(e){ showError(e.message); allEpisodes=[]; currentShow=null; }
  finally{ showSpinner(false); }
}

function populateSeasons(){
  if(!allEpisodes.length) return;
  const seasons = [...new Set(allEpisodes.map(e=>e.season))].sort((a,b)=>a-b);
  fromSeason.innerHTML=""; toSeason.innerHTML="";
  seasons.forEach(s=>{
    fromSeason.innerHTML+=`<option value="${s}">${s}</option>`;
    toSeason.innerHTML+=`<option value="${s}">${s}</option>`;
  });
}

// ---------- Find Random Episode ----------
function pickRandomEpisode(){
  if(!allEpisodes.length) return showError("No episodes loaded.");
  const from = parseInt(fromSeason.value), to=parseInt(toSeason.value);
  const filtered = allEpisodes.filter(e=>e.season>=from && e.season<=to);
  if(!filtered.length) return showError("No episodes in this range.");
  const ep = filtered[Math.floor(Math.random()*filtered.length)];
  renderEpisode(ep);
}

function renderEpisode(ep){
  resultArea.classList.remove("hidden");
  resultArea.innerHTML = `
    <div class="thumb"><img src="${currentShow.image?.medium||''}" alt="${sanitize(currentShow.name)}"></div>
    <div class="meta">
      <h2>${sanitize(currentShow.name)} S${ep.season}E${ep.number}</h2>
      <p>${sanitize(ep.name)}</p>
      <p>${ep.summary?ep.summary.replace(/<[^>]+>/g,''):"No summary"}</p>
      <button class="btn btn-surprise">❤ Add to favorites</button>
    </div>
  `;
  resultArea.querySelector("button").onclick=()=>{
    if(!favorites.includes(currentShow.name)){ favorites.push(currentShow.name); saveFavorites(); renderFavorites(); }
  };
}

// ---------- Surprise ----------
function surprise(){
  const show = SURPRISE_LIST[Math.floor(Math.random()*SURPRISE_LIST.length)];
  fetchShow(show);
}

// ---------- Events ----------
searchBtn.onclick = ()=>fetchShow(searchInput.value);
findBtn.onclick = pickRandomEpisode;
surpriseBtn.onclick = surprise;
clearBtn.onclick = ()=>{ favorites=[]; saveFavorites(); renderFavorites(); };
renderFavorites();

// Keyboard shortcuts
document.addEventListener("keydown", e=>{
  if(e.key==="Enter") searchBtn.click();
  if(e.key.toLowerCase()==="r") surpriseBtn.click();
});

// ---------- Siri Wave ----------
const canvas = $("siriWave"), ctx=canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const waves = Array.from({length:5}, ()=>({phase:Math.random()*Math.PI*2, amp:10+Math.random()*20, freq:0.005+Math.random()*0.02, speed:0.02+Math.random()*0.03}));
function drawWaves(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  waves.forEach(w=>{
    ctx.beginPath();
    for(let x=0;x<canvas.width;x+=2){
      const y = canvas.height/2 + Math.sin(x*w.freq + w.phase)*w.amp;
      ctx.lineTo(x,y);
    }
    ctx.strokeStyle = `rgba(255,255,255,0.06)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    w.phase += w.speed;
  });
  requestAnimationFrame(drawWaves);
}
drawWaves();
window.addEventListener("resize", ()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; });
