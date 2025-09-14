const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const result = document.getElementById("result");

const seasonStart = document.getElementById("seasonStart");
const seasonEnd = document.getElementById("seasonEnd");

let episodes = [];
let totalSeasons = 0;

/* --- Fetch show data --- */
async function searchShow(query) {
  const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${query}&embed=episodes`);
  const data = await res.json();

  episodes = data._embedded.episodes;
  totalSeasons = Math.max(...episodes.map(ep => ep.season));

  populateDropdown(seasonStart, 1, totalSeasons);
  populateDropdown(seasonEnd, 1, totalSeasons);

  result.innerHTML = `<p class="muted">Found <b>${data.name}</b>. Select a season range and click "Find Random Episode".</p>`;
}

/* --- Custom dropdown builder --- */
function populateDropdown(container, start, end) {
  container.innerHTML = "";

  const selected = document.createElement("div");
  selected.className = "selected";
  selected.textContent = `Season ${start}`;
  container.appendChild(selected);

  const options = document.createElement("div");
  options.className = "custom-options";

  for (let i = start; i <= end; i++) {
    let episodeCount = episodes.filter(ep => ep.season === i).length;
    let opt = document.createElement("div");
    opt.className = "custom-option";
    opt.dataset.value = i;
    opt.textContent = `Season ${i} (${episodeCount} eps)`;
    options.appendChild(opt);

    opt.addEventListener("click", () => {
      selected.textContent = opt.textContent;
      container.dataset.value = opt.dataset.value;
      container.classList.remove("open");
    });
  }

  container.appendChild(options);

  selected.addEventListener("click", () => {
    container.classList.toggle("open");
  });

  container.dataset.value = start;
}

/* --- Event handlers --- */
searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) searchShow(query);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".custom-select")) {
    document.querySelectorAll(".custom-select").forEach(sel => sel.classList.remove("open"));
  }
});
