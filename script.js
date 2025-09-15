// --- Helper ---
const $ = id => document.getElementById(id);
let currentShow = null;
let allEpisodes = [];
let isLoading = false;

// --- Elements ---
const searchInput = $("search-input");
const searchButton = $("search-button");
const randomButton = $("random-button");
const resultsDiv = $("results");
const spinner = $("spinner");
const errorDiv = $("error-message");

// --- Surprise list (de-duplicated + weighted) ---
const SURPRISE_LIST = [
  "Breaking Bad","The Office","Friends","SpongeBob SquarePants",
  "Rick and Morty","Stranger Things","The Simpsons","Archer",
  "Seinfeld","Avatar: The Last Airbender","Smiling Friends",
  "BoJack Horseman","Black Mirror","Brooklyn Nine-Nine",
  "Gravity Falls","Adventure Time","The Mandalorian","Futurama",
  "Community","Parks and Recreation"
];

// --- Loading state ---
function setLoading(state) {
  isLoading = state;
  spinner.style.display = state ? "block" : "none";
  searchButton.disabled = state;
  randomButton.disabled = state;
  searchInput.disabled = state;
}

// --- Error handling ---
function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.style.display = "block";
}
function clearError() {
  errorDiv.textContent = "";
  errorDiv.style.display = "none";
}

// --- Fetch show ---
async function fetchShow(query) {
  try {
    setLoading(true);
    clearError();
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    if (data.length === 0) {
      showError("No results found.");
      return;
    }
    displayResults(data);
  } catch (err) {
    showError("Something went wrong. Please try again.");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// --- Display results ---
function displayResults(shows) {
  resultsDiv.innerHTML = "";
  shows.forEach(entry => {
    const show = entry.show;
    const div = document.createElement("div");
    div.className = "show-card";
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.setAttribute("aria-label", `Show: ${show.name}`);
    div.innerHTML = `
      <h3>${show.name}</h3>
      ${show.image ? `<img src="${show.image.medium}" alt="Poster for ${show.name}">` : ""}
      <p>${show.summary ? show.summary : "No description available."}</p>
    `;
    div.addEventListener("click", () => {
      currentShow = show;
      focusOnResults();
    });
    resultsDiv.appendChild(div);
  });
  focusOnResults();
}

// --- Focus management ---
function focusOnResults() {
  if (resultsDiv.firstChild) {
    resultsDiv.firstChild.focus();
  }
}

// --- Surprise / Smart Surprise ---
async function smartSurprise() {
  // 80% pick from curated list, 20% fetch a popular trending show
  if (Math.random() < 0.8) {
    const pick = SURPRISE_LIST[Math.floor(Math.random() * SURPRISE_LIST.length)];
    await fetchShow(pick);
  } else {
    try {
      setLoading(true);
      const res = await fetch("https://api.tvmaze.com/shows");
      const data = await res.json();
      const randomPick = data[Math.floor(Math.random() * data.length)];
      displayResults([{ show: randomPick }]);
    } catch (err) {
      console.error(err);
      showError("Surprise failed, try again.");
    } finally {
      setLoading(false);
    }
  }
}

// --- Keyboard shortcuts ---
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "s") {
    searchInput.focus();
  }
  if (e.key.toLowerCase() === "r") {
    smartSurprise();
  }
});

// --- Event listeners ---
searchButton.addEventListener("click", () => {
  if (searchInput.value.trim() !== "") {
    fetchShow(searchInput.value.trim());
  }
});
randomButton.addEventListener("click", () => {
  smartSurprise();
});
searchInput.addEventListener("keypress", e => {
  if (e.key === "Enter" && searchInput.value.trim() !== "") {
    fetchShow(searchInput.value.trim());
  }
});

// --- Siri-style Waves Background ---
const canvas = document.createElement("canvas");
canvas.id = "wave-canvas";
document.body.prepend(canvas);
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const waves = [
  { color: "rgba(0,200,255,0.3)", amp: 40, freq: 0.015, speed: 0.02 },
  { color: "rgba(0,150,200,0.25)", amp: 60, freq: 0.01, speed: 0.015 },
  { color: "rgba(0,100,255,0.2)", amp: 80, freq: 0.008, speed: 0.01 }
];

let t = 0;
function drawWaves() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  waves.forEach(w => {
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = canvas.height / 2 +
        Math.sin(x * w.freq + t * w.speed) * (w.amp + Math.random() * 10 - 5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fillStyle = w.color;
    ctx.fill();
  });
  t += 1;
  requestAnimationFrame(drawWaves);
}
drawWaves();
