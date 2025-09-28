const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
let openOnRender = null;

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
  '12 oz. Mouse','The Brak Show','Drawn Together','Superjail!',
  'Gravity Falls','Invincible','Daria','Community','Arrested Development',
  'Rick & Morty: The Vindicators','BoJack Horseman: Horsin’ Around Specials',
  'The Venture Bros.','Futurama','The Legend of Korra','Love, Death & Robots',
  'The Owl House','Castlevania','Animaniacs (2020)','Young Justice'
];

/* ----------------------------
   Favorites utils
---------------------------- */
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem("ref-favs") || "[]");
  } catch (e) {
    return [];
  }
}

function saveFavorites(list) {
  localStorage.setItem("ref-favs", JSON.stringify(list));
}

function ensureFav(show) {
  let favs = loadFavorites();
  let fav = favs.find(f => f.id === show.id);
  if (!fav) {
    fav = {
      id: show.id,
      name: show.name,
      episodes: { watchlist: [], watched: [] }
    };
    favs.push(fav);
    saveFavorites(favs);
  }
  return fav;
}

/* ----------------------------
   Favorites rendering
---------------------------- */
function renderFavorites() {
  let favs = loadFavorites();
  const sortMode = $("favSort")?.value || "recent";

  if (sortMode === "alpha") {
    favs.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    favs = favs.reverse();
  }

  const container = $("favoritesList");
  container.innerHTML = "";

  if (favs.length === 0) {
    container.innerHTML = '<p class="hint">No favorites yet</p>';
    return;
  }

  favs.forEach(fav => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="showLink" data-name="${fav.name}">${fav.name}</span>`;
    details.appendChild(summary);

    if (openOnRender === fav.id) details.open = true;

    // Watch Later section
    const wl = document.createElement("div");
    wl.innerHTML = '<span class="category-badge badge-watchlist">📺 Watch Later</span>';

    if (fav.episodes.watchlist.length === 0) {
      wl.innerHTML += '<p class="hint">None</p>';
    } else {
      const ul = document.createElement("ul");
      fav.episodes.watchlist.forEach(ep => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="epLink" data-show="${fav.id}" data-ep="${ep.id}">
            S${ep.season}E${ep.number} — ${ep.name}
          </span>
          <button class="removeEp" data-show="${fav.id}" data-type="watchlist" data-ep="${ep.id}">✖</button>
        `;
        ul.appendChild(li);
      });
      wl.appendChild(ul);
    }
    details.appendChild(wl);

    // Watched section
    const wd = document.createElement("div");
    wd.innerHTML = '<span class="category-badge badge-watched">✔ Watched</span>';

    if (fav.episodes.watched.length === 0) {
      wd.innerHTML += '<p class="hint">None</p>';
    } else {
      const ul = document.createElement("ul");
      fav.episodes.watched.forEach(ep => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="epLink" data-show="${fav.id}" data-ep="${ep.id}">
            S${ep.season}E${ep.number} — ${ep.name}
          </span>
          <button class="removeEp" data-show="${fav.id}" data-type="watched" data-ep="${ep.id}">✖</button>
        `;
        ul.appendChild(li);
      });
      wd.appendChild(ul);
    }
    details.appendChild(wd);

    container.appendChild(details);
  });

  // Event listeners
  container.querySelectorAll(".removeEp").forEach(btn => {
    btn.addEventListener("click", () => {
      removeEpisode(+btn.dataset.show, btn.dataset.type, +btn.dataset.ep);
    });
  });

  container.querySelectorAll(".epLink").forEach(el => {
    el.addEventListener("click", () => {
      openEpisode(+el.dataset.show, +el.dataset.ep);
    });
  });

  container.querySelectorAll(".showLink").forEach(el => {
    el.addEventListener("click", async () => {
      $("searchInput").value = el.dataset.name;
      await doSearch(el.dataset.name);
    });
  });

  openOnRender = null;
}

/* ----------------------------
   API
---------------------------- */
async function searchShow(query) {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
  return res.json();
}

async function getEpisodesForShow(showId) {
  const res = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`);
  return res.json();
}

/* ----------------------------
   Episodes
---------------------------- */
function populateSeasonSelectors(episodes) {
  const seasons = [...new Set(episodes.map(e => e.season))].sort((a, b) => a - b);

  $("fromSeason").innerHTML = "";
  $("toSeason").innerHTML = "";

  seasons.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `Season ${s}`;
    $("fromSeason").appendChild(opt);
    $("toSeason").appendChild(opt.cloneNode(true));
  });

  $("fromSeason").value = seasons[0];
  $("toSeason").value = seasons[seasons.length - 1];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function renderResult(ep, show) {
  const container = $("resultArea");
  container.style.display = "block";

  const img =
    (ep?.image?.medium) ||
    (show?.image?.medium) ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const summary = (ep?.summary || "No summary").replace(/<[^>]*>?/gm, "");
  const rating = ep?.rating?.average || show?.rating?.average || "N/A";

  container.innerHTML = `
    <div class="thumb"><img src="${img}" alt="thumb"/></div>
    <div class="meta">
      <div class="hint">
        <span class="showLink" data-name="${show.name}">${show.name}</span>
        — S${ep.season}E${ep.number}
      </div>
      <h2>${ep.name || "Untitled"} <span class="rating">⭐ ${rating}</span></h2>
      <p class="hint">Aired: ${ep.airdate || "Unknown"}</p>
      <p>${summary}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button id="saveFav" class="btn btn-clear">♡ Add Show</button>
        <button id="watchLater" class="btn btn-primary">📺 Watch Later</button>
        <button id="markWatched" class="btn btn-surprise">✔ Watched</button>
      </div>
    </div>
  `;

  $("saveFav")?.addEventListener("click", () => {
    ensureFav(show);
    renderFavorites();
  });

  $("watchLater")?.addEventListener("click", () => {
    addEpisode(show, ep, "watchlist");
  });

  $("markWatched")?.addEventListener("click", () => {
    addEpisode(show, ep, "watched");
  });
}

function addEpisode(show, ep, type) {
  let favs = loadFavorites();
  let fav = favs.find(f => f.id === show.id);

  if (!fav) {
    fav = {
      id: show.id,
      name: show.name,
      episodes: { watchlist: [], watched: [] }
    };
    favs.push(fav);
  }

  if (!fav.episodes[type].find(e => e.id === ep.id)) {
    fav.episodes[type].push({
      id: ep.id,
      name: ep.name,
      season: ep.season,
      number: ep.number
    });
    saveFavorites(favs);
    openOnRender = show.id;
    renderFavorites();
    alert(`Saved ${ep.name} to ${type}`);
  } else {
    alert("Episode already in list");
  }
}

function removeEpisode(showId, type, epId) {
  let favs = loadFavorites();
  let fav = favs.find(f => f.id === showId);
  if (!fav) return;

  fav.episodes[type] = fav.episodes[type].filter(e => e.id !== epId);
  saveFavorites(favs);
  openOnRender = showId;
  renderFavorites();
}

async function openEpisode(showId, epId) {
  const favs = loadFavorites();
  const fav = favs.find(f => f.id === showId);
  if (!fav) return;

  const data = await searchShow(fav.name);
  if (data.length === 0) return;

  const show = data[0].show;
  const episodes = await getEpisodesForShow(show.id);
  const ep = episodes.find(e => e.id === epId);

  if (ep) {
    currentShow = show;
    allEpisodes = episodes;
    populateSeasonSelectors(episodes);
    renderResult(ep, show);
  }
}

/* ----------------------------
   Search + controls
---------------------------- */
async function doSearch(query) {
  const data = await searchShow(query);
  if (data.length === 0) return;

  currentShow = data[0].show;
  allEpisodes = await getEpisodesForShow(currentShow.id);

  populateSeasonSelectors(allEpisodes);
  renderResult(pickRandom(allEpisodes), currentShow);
}

$("searchBtn").onclick = () => doSearch($("searchInput").value.trim());

$("findBtn").onclick = () => {
  if (!currentShow) return;
  const fromS = +$("fromSeason").value;
  const toS = +$("toSeason").value;
  const eps = allEpisodes.filter(e => e.season >= fromS && e.season <= toS);
  renderResult(pickRandom(eps), currentShow);
};

$("surpriseBtn").onclick = () => {
  $("searchInput").value = pickRandom(SURPRISE_LIST);
  $("searchBtn").click();
};

$("clearBtn").onclick = () => {
  localStorage.removeItem("ref-favs");
  renderFavorites();
};

$("favSort")?.addEventListener("change", renderFavorites);

renderFavorites();

/* ----------------------------
   Daily Pick
---------------------------- */
async function loadDailyPick() {
  const today = new Date().toISOString().split("T")[0];
  let dailyData = JSON.parse(localStorage.getItem("ref-daily") || "null");

  if (!dailyData || dailyData.date !== today) {
    const showName = pickRandom(SURPRISE_LIST);
    try {
      const data = await searchShow(showName);
      if (!data || data.length === 0) return;

      const show = data[0].show;
      const episodes = await getEpisodesForShow(show.id);
      const ep = pickRandom(episodes);

      dailyData = { date: today, show, episode: ep };
      localStorage.setItem("ref-daily", JSON.stringify(dailyData));
    } catch (e) {
      console.error("Daily pick failed", e);
      return;
    }
  }

  const container = $("dailyPick");
  const content = $("dailyContent");
  if (!container || !content) return;

  container.classList.remove("hidden");

  const ep = dailyData.episode;
  const show = dailyData.show;
  const rating = ep?.rating?.average || show?.rating?.average || "N/A";

  const img =
    (ep?.image?.medium) ||
    (show?.image?.medium) ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const summary = (ep?.summary || "No summary").replace(/<[^>]*>?/gm, "");

  content.innerHTML = `
    <div class="thumb"><img src="${img}" alt="thumb"/></div>
    <div class="meta">
      <div class="hint">
        <span class="showLink" data-name="${show.name}">${show.name}</span>
        — S${ep.season}E${ep.number}
      </div>
      <h3 class="epLink" data-show="${show.id}" data-ep="${ep.id}">
        ${ep.name || "Untitled"} <span class="rating">⭐ ${rating}</span>
      </h3>
      <p class="hint">Aired: ${ep.airdate || "Unknown"}</p>
      <p>${summary}</p>
      <button id="dailyFav" class="btn btn-clear">♡ Save Show</button>
      <button id="dailyLater" class="btn btn-primary">📺 Watch Later</button>
      <button id="dailyWatched" class="btn btn-surprise">✔ Watched</button>
    </div>
  `;

  // Actions
  $("dailyFav")?.addEventListener("click", () => {
    ensureFav(show);
    renderFavorites();
  });

  $("dailyLater")?.addEventListener("click", () => {
    addEpisode(show, ep, "watchlist");
  });

  $("dailyWatched")?.addEventListener("click", () => {
    addEpisode(show, ep, "watched");
  });

  // Make links clickable
  content.querySelectorAll(".showLink").forEach(el => {
    el.addEventListener("click", async () => {
      $("searchInput").value = el.dataset.name;
      await doSearch(el.dataset.name);
    });
  });

  content.querySelectorAll(".epLink").forEach(el => {
    el.addEventListener("click", async () => {
      await openEpisode(show.id, ep.id);
    });
  });
}

loadDailyPick();

/* ----------------------------
   SiriWave background
---------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  if (typeof SiriWave !== "undefined") {
    const siriWave = new SiriWave({
      container: document.getElementById("siriWave"),
      width: window.innerWidth,
      height: window.innerHeight,
      style: "ios9",
      amplitude: 0.6,
      speed: 0.08,
      autostart: true,
      cover: true
    });

    window.addEventListener("resize", () => {
      siriWave.setSize(window.innerWidth, window.innerHeight);
    });
  }
});

