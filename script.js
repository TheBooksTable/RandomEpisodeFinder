// --- Utility ---
    const $ = id => document.getElementById(id)

    // state
    let currentShow = null
    let allEpisodes = []

    // popular suggestions for "surprise me" (no external API needed for this list)
    const SURPRISE_LIST = [
      'Breaking Bad','The Office','Friends','SpongeBob SquarePants','Rick and Morty','Stranger Things','The Simpsons','Archer','Seinfeld','Avatar: The Last Airbender'
    ]

    // load favorites from localStorage
    function loadFavorites(){
      const raw = localStorage.getItem('ref-favs')
      if(!raw) return []
      try{ return JSON.parse(raw) }catch(e){ return [] }
    }
    function saveFavorites(list){ localStorage.setItem('ref-favs', JSON.stringify(list)) }

    function renderFavorites(){
      const list = loadFavorites()
      const ul = $('favoritesList')
      ul.innerHTML = ''
      if(list.length===0){ ul.innerHTML = '<li class="muted">Add one to get started!</li>'; return }
      list.forEach(s => {
        const li = document.createElement('li')
        li.style.marginBottom = '10px'
        li.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div>${escapeHtml(s.name)}</div><div style="display:flex;gap:8px"><button data-id="${s.id}" class="fav removeFav">Remove</button></div></div>`
        ul.appendChild(li)
      })
      document.querySelectorAll('.removeFav').forEach(b=>b.addEventListener('click', e=>{
        const id = Number(e.currentTarget.dataset.id)
        const list = loadFavorites().filter(x=>x.id!==id)
        saveFavorites(list)
        renderFavorites()
      }))
    }

    function escapeHtml(str){ return (''+str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }

    // --- TVMaze API helpers ---
    async function searchShow(query){
      const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
      const res = await fetch(url)
      if(!res.ok) throw new Error('Search failed')
      const data = await res.json()
      return data // array of {score, show}
    }
    async function getEpisodesForShow(showId){
      const url = `https://api.tvmaze.com/shows/${showId}/episodes`
      const res = await fetch(url)
      if(!res.ok) throw new Error('Could not get episodes')
      return await res.json() // array of episodes
    }

    // populate season selects
    function populateSeasonSelectors(episodes){
      const seasons = [...new Set(episodes.map(e=>e.season))].sort((a,b)=>a-b)
      const from = $('fromSeason'); const to = $('toSeason')
      from.innerHTML = '' ; to.innerHTML = ''
      seasons.forEach(s => {
        const opt = document.createElement('option'); opt.value = s; opt.textContent = `Season ${s}`
        from.appendChild(opt)
        const opt2 = opt.cloneNode(true); to.appendChild(opt2)
      })
      // make sure "to" not less than from
      from.addEventListener('change', ()=>{
        if(Number(to.value) < Number(from.value)) to.value = from.value
      })
    }

    function filterEpisodesBySeasonRange(eps, fromS, toS){
      return eps.filter(e => e.season >= fromS && e.season <= toS)
    }

    function renderResult(episode, show){
      const container = $('resultArea')
      container.classList.remove('hidden')
      container.innerHTML = `
        <div class="thumb"><img src="${episode.image ? episode.image.medium : (show.image ? show.image.medium : 'https://via.placeholder.com/300x200?text=No+Image')}" alt="thumb"/></div>
        <div class="meta">
          <div class="muted">${escapeHtml((show.name||'').toUpperCase())} • S${String(episode.season).padStart(2,'0')}E${String(episode.number).padStart(2,'0')}</div>
          <h2>${escapeHtml(episode.name||'Untitled')}</h2>
          <p class="muted">Aired: ${episode.airdate || 'Unknown'}</p>
          <p style="margin-top:10px">${episode.summary ? episode.summary.replace(/<[^>]+>/g,'') : 'No summary available.'}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end">
          <div class="rating">${episode.rating && episode.rating.average ? episode.rating.average : ''}</div>
          <button id="saveFav" class="fav">♡ Save</button>
        </div>
      `

      $('saveFav').addEventListener('click', ()=>{
        const favs = loadFavorites()
        if(!favs.find(f=>f.id===show.id)){
          favs.push({id:show.id,name:show.name})
          saveFavorites(favs)
          renderFavorites()
          alert('Saved to favorites')
        } else { alert('Already in favorites') }
      })
    }

    // pick random
    function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)] }

    // --- Event handlers ---
    $('searchBtn').addEventListener('click', async ()=>{
      const q = $('searchInput').value.trim()
      if(!q) { alert('Type a show name'); return }
      try{
        const data = await searchShow(q)
        if(data.length===0){ alert('No shows found'); return }
        // pick the top match
        currentShow = data[0].show
        allEpisodes = await getEpisodesForShow(currentShow.id)
        if(allEpisodes.length===0){ alert('No episodes available for this show'); return }
        populateSeasonSelectors(allEpisodes)
        // set default range
        $('fromSeason').value = Math.min(...allEpisodes.map(e=>e.season))
        $('toSeason').value = Math.max(...allEpisodes.map(e=>e.season))
        // show first random preview
        const ep = pickRandom(allEpisodes)
        renderResult(ep,currentShow)
      }catch(err){ console.error(err); alert('Error searching show: '+err.message) }
    })

    $('findBtn').addEventListener('click', ()=>{
      if(!currentShow || allEpisodes.length===0){ alert('Search and select a show first'); return }
      const fromS = Number($('fromSeason').value)
      const toS = Number($('toSeason').value)
      const filtered = filterEpisodesBySeasonRange(allEpisodes, fromS, toS)
      if(filtered.length===0){ alert('No episodes in the selected season range'); return }
      const ep = pickRandom(filtered)
      renderResult(ep,currentShow)
    })

    $('surpriseBtn').addEventListener('click', async ()=>{
      const showName = pickRandom(SURPRISE_LIST)
      $('searchInput').value = showName
      $('searchBtn').click()
    })

    $('clearBtn').addEventListener('click', ()=>{
      if(confirm('Clear all favorites?')){ localStorage.removeItem('ref-favs'); renderFavorites() }
    })

    // allow enter key search
    $('searchInput').addEventListener('keydown', e=>{ if(e.key==='Enter') $('searchBtn').click() })

    // init
    renderFavorites()

    // Helpful note: if you want to host on GitHub Pages, just create a repo and upload this file as index.html then enable Pages in repo settings.
