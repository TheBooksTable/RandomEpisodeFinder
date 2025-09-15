// ----------------------------
// script.js full rewrite with autocomplete + fixed waves
// ----------------------------
const $ = id => document.getElementById(id);
let currentShow=null, allEpisodes=[];
const SURPRISE_LIST=[
  'Breaking Bad','The Office','Friends','SpongeBob SquarePants','Rick and Morty','Stranger Things','The Simpsons','Archer','Seinfeld',
  'Avatar: The Last Airbender','Smiling Friends','BoJack Horseman','Black Mirror','Brooklyn Nine-Nine','Supernatural','South Park',
  'Twin Peaks','Fargo','Better Call Saul','Infinity Train','Kipo and the Age of Wonderbeasts','Tuca & Bertie','Final Space',
  'The Midnight Gospel','Undone','Close Enough','Hilda','F Is for Family','Solar Opposites','Golan the Insatiable','Adventure Time: Distant Lands',
  'Over the Garden Wall','Primal','Magical Girl Raising Project','Welcome to the Ballroom','Aggretsuko','Bee and PuppyCat','King Star King',
  'The Shivering Truth','12 oz. Mouse','The Brak Show','Drawn Together','Superjail!'
];

function loadFavorites(){try{return JSON.parse(localStorage.getItem('ref-favs')||'[]');}catch(e){return[];}}
function saveFavorites(list){localStorage.setItem('ref-favs',JSON.stringify(list));}

function showInlineMessage(msg){const el=$('inlineMessage');if(!el) return;el.textContent=msg;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),4000);}
function escapeHtml(str){return(''+str).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

// ----------------- favorites rendering -----------------
function renderFavorites(){
  const list=loadFavorites();const ul=$('favoritesList');ul.innerHTML='';
  list.forEach(f=>{
    const li=document.createElement('li');
    li.innerHTML=`<span class="favItem">${escapeHtml(f)}</span> <button class="removeFav" aria-label="Remove favorite">×</button>`;
    li.querySelector('button').onclick=()=>{
      const updated=list.filter(x=>x!==f);saveFavorites(updated);renderFavorites();
    };
    ul.appendChild(li);
  });
}

// ----------------- Siri-style waves -----------------
const canvas=$('siriWave');const ctx=canvas.getContext('2d');let W=canvas.width=window.innerWidth,H=canvas.height=window.innerHeight;
window.addEventListener('resize',()=>{W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;});

let waveData=[...Array(5)].map(_=>({phase:Math.random()*Math.PI*2,amplitude:Math.random()*20+20,speed:Math.random()*0.03+0.01,y:Math.random()*H/2+H/4}));

function drawWave(){
  ctx.clearRect(0,0,W,H);
  waveData.forEach((wave,i)=>{
    ctx.beginPath();
    ctx.moveTo(0,H/2);
    for(let x=0;x<W;x+=2){
      const y=H/2+wave.amplitude*Math.sin(wave.phase+x*0.02);
      ctx.lineTo(x,y);
    }
    ctx.strokeStyle=`hsla(${220+i*30},60%,70%,0.3)`;
    ctx.lineWidth=2+i;
    ctx.stroke();
    wave.phase+=wave.speed;
  });
  requestAnimationFrame(drawWave);
}
drawWave();

// ----------------- autocomplete -----------------
let autocompleteTimeout=null;
const searchInput=$('searchInput'), autocompleteList=$('autocompleteList');
searchInput.addEventListener('input',()=>{
  const query=searchInput.value.trim();
  if(query.length<2){autocompleteList.classList.add('hidden');return;}
  if(autocompleteTimeout) clearTimeout(autocompleteTimeout);
  autocompleteTimeout=setTimeout(async()=>{
    try{
      const res=await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const data=await res.json();
      autocompleteList.innerHTML='';
      data.slice(0,8).forEach(item=>{
        const div=document.createElement('div');
        div.className='autocomplete-item';
        div.textContent=item.show.name;
        div.tabIndex=0;
        div.onclick=()=>{searchInput.value=item.show.name;autocompleteList.classList.add('hidden');};
        div.onkeydown=e=>{if(e.key==='Enter'){searchInput.value=item.show.name;autocompleteList.classList.add('hidden');searchShow();}};
        autocompleteList.appendChild(div);
      });
      autocompleteList.classList.toggle('hidden',data.length===0);
    }catch(e){console.error(e);}
  },300);
});

document.addEventListener('click',e=>{
  if(!searchInput.contains(e.target) && !autocompleteList.contains(e.target)){
    autocompleteList.classList.add('hidden');
  }
});

// ----------------- search + find random -----------------
const spinner=$('spinner'), resultArea=$('resultArea'), findBtn=$('findBtn'), surpriseBtn=$('surpriseBtn'), clearBtn=$('clearBtn');

async function searchShow(name=searchInput.value.trim()){
  if(!name){showInlineMessage('Please type a show name.');return;}
  spinner.classList.remove('hidden');findBtn.disabled=true;surpriseBtn.disabled=true;
  try{
    const res=await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(name)}&embed=episodes`);
    const data=await res.json();allEpisodes=data._embedded.episodes||[];renderSeasons(data);
  }catch(e){showInlineMessage('Show not found');console.error(e);}finally{spinner.classList.add('hidden');findBtn.disabled=false;surpriseBtn.disabled=false;}
}

function renderSeasons(show){
  const from=$('fromSeason'),to=$('toSeason');
  from.innerHTML='';to.innerHTML='';
  allEpisodes.forEach(ep=>{
    if(!from.querySelector(`option[value="${ep.season}"]`)) from.appendChild(new Option(ep.season,ep.season));
    if(!to.querySelector(`option[value="${ep.season}"]`)) to.appendChild(new Option(ep.season,ep.season));
  });
  resultArea.innerHTML=`
    <div class="result">
      <div class="thumb"><img src="${show.image?show.image.medium:''}" alt="${escapeHtml(show.name)}"/></div>
      <div class="meta">
        <h2>${escapeHtml(show.name)}</h2>
        <p>${escapeHtml(show.summary||'No summary')}</p>
      </div>
    </div>`;
  resultArea.classList.remove('hidden');
}

function findRandomEpisode(){
  if(allEpisodes.length===0){showInlineMessage('No show loaded yet.');return;}
  const fromS=+$('fromSeason').value,toS=+$('toSeason').value;
  const filtered=allEpisodes.filter(ep=>ep.season>=fromS && ep.season<=toS);
  if(!filtered.length){showInlineMessage('No episodes in selected range');return;}
  const ep=filtered[Math.floor(Math.random()*filtered.length)];
  alert(`Random episode: ${ep.name} (Season ${ep.season}, Episode ${ep.number})`);
}

// ----------------- surprise -----------------
function surpriseMe(){
  const name=SURPRISE_LIST[Math.floor(Math.random()*SURPRISE_LIST.length)];
  searchInput.value=name;searchShow(name);
}

// ----------------- favorites -----------------
clearBtn.onclick=()=>{localStorage.removeItem('ref-favs');renderFavorites();};
renderFavorites();

// ----------------- button events -----------------
findBtn.onclick=findRandomEpisode;
surpriseBtn.onclick=surpriseMe;
$('searchBtn').onclick=()=>searchShow();

// ----------------- keyboard -----------------
searchInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){searchShow();}
});

// initializations
renderFavorites();
