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

// --------------- DOM Elements ---------------
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const findBtn = $('findBtn');
const surpriseBtn = $('surpriseBtn');
const clearBtn = $('clearBtn');
const fromSeason = $('fromSeason');
const toSeason = $('toSeason');
const resultArea = $('resultArea');
const message = $('message');
const spinner = $('spinner');
const favoritesList = $('favoritesList');

// ---------------- Keyboard Shortcuts ----------------
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') searchBtn.click();
  if (e.key.toLowerCase() === 'r') surpriseBtn.click();
});

// ---------------- UI Helpers ----------------
function showMessage(msg, type = 'info') {
  message.textContent = msg;
  message.style.color = type === 'error' ? '#ff6b6b' : '#a5d6ff';
}
function toggleSpinner(show) {
  spinner.classList.toggle('hidden', !show);
  [searchBtn, findBtn, surpriseBtn].forEach(b => b.disabled = show);
}
function clearResult() {
  resultArea.innerHTML = '';
  resultArea.classList.add('hidden');
}

// ---------------- Favorites ----------------
function renderFavorites() {
  favoritesList.innerHTML = '';
  favorites.forEach(fav => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="favItem">${fav}</span>
      <button class="removeFav" aria-label="Remove favorite">✕</button>`;
    li.querySelector('button').addEventListener('click', () => {
      favorites = favorites.filter(f => f !== fav);
      renderFavorites();
    });
    favoritesList.appendChild(li);
  });
}
clearBtn.addEventListener('click', () => { favorites = []; renderFavorites(); });

// ---------------- Fetch Shows ----------------
async function fetchShowEpisodes(showName) {
  try {
    clearResult();
    showMessage('');
    toggleSpinner(true);

    const resp = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showName)}&embed=episodes`);
    if (!resp.ok) throw new Error('Show not found');
    const data = await resp.json();

    allEpisodes = data._embedded.episodes;
    currentShow = data;
    populateSeasonRange();
    showRandomEpisode();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    toggleSpinner(false);
  }
}

// ---------------- Populate Season Range ----------------
function populateSeasonRange() {
  const seasons = [...new Set(allEpisodes.map(ep => ep.season))].sort((a,b)=>a-b);
  fromSeason.innerHTML = ''; toSeason.innerHTML = '';
  seasons.forEach(s => {
    const opt1 = document.createElement('option'); opt1.value = s; opt1.textContent = s;
    const opt2 = document.createElement('option'); opt2.value = s; opt2.textContent = s;
    fromSeason.appendChild(opt1); toSeason.appendChild(opt2);
  });
}

// ---------------- Random Episode ----------------
function showRandomEpisode() {
  if (!allEpisodes.length) return showMessage('No episodes loaded', 'error');
  const from = parseInt(fromSeason.value) || 1;
  const to = parseInt(toSeason.value) || Math.max(...allEpisodes.map(e=>e.season));
  const filtered = allEpisodes.filter(e => e.season >= from && e.season <= to);
  const ep = filtered[Math.floor(Math.random()*filtered.length)];

  renderEpisode(ep);
}

function renderEpisode(ep) {
  clearResult();
  const div = document.createElement('div');
  div.className = 'result';
  div.innerHTML = `
    <div class="thumb"><img src="${ep.image?.medium||''}" alt="${ep.name}" /></div>
    <div class="meta">
      <h2>${ep.name}</h2>
      <p>Season ${ep.season}, Episode ${ep.number}</p>
      <p>${ep.summary || ''}</p>
      <button class="btn btn-clear">★ Add to Favorites</button>
    </div>`;
  div.querySelector('button').addEventListener('click', () => {
    if (!favorites.includes(currentShow.name)) favorites.push(currentShow.name);
    renderFavorites();
  });
  resultArea.appendChild(div);
  resultArea.classList.remove('hidden');
}

// ---------------- Surprise ----------------
function surpriseMe() {
  const weightedList = [...new Set(SURPRISE_LIST)];
  const show = weightedList[Math.floor(Math.random() * weightedList.length)];
  searchInput.value = show;
  fetchShowEpisodes(show);
}

// ---------------- Event Listeners ----------------
searchBtn.addEventListener('click', () => fetchShowEpisodes(searchInput.value));
findBtn.addEventListener('click', showRandomEpisode);
surpriseBtn.addEventListener('click', surpriseMe);

// ---------------- Siri-style Waves ----------------
const canvas = $('siriWave');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let waveLayers = 4;
let wavePoints = 200;
let waves = [];

for (let l=0;l<waveLayers;l++){
  waves.push({phase:0, speed:0.002 + Math.random()*0.003, amplitude: 10 + l*6});
}

function drawWave() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  waves.forEach((w,i)=>{
    ctx.beginPath();
    let y0 = canvas.height/2 + i*8;
    ctx.moveTo(0, y0);
    for (let x=0;x<canvas.width;x++){
      let scale = Math.sin((x/(canvas.width))*Math.PI*2 + w.phase);
      let noise = Math.random()*0.8; // subtle randomness
      let y = y0 + Math.sin((x/20)+w.phase)*w.amplitude*scale*noise;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(138,99,255,${0.05 + i*0.03})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    w.phase += w.speed;
  });
  requestAnimationFrame(drawWave);
}
drawWave();

// ---------------- Responsive Canvas ----------------
window.addEventListener('resize', ()=>{
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
