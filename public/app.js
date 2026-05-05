/* ══════════════════════════════════════════
   ZaamMusic — app.js
   Terhubung ke FastAPI backend (index.py)
══════════════════════════════════════════ */

// ── CONFIG ──
const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : '';

// ── STATE ──
let queue        = [];
let currentIndex = -1;
let ytPlayer     = null;
let ytReady      = false;
let isPlaying    = false;
let isShuffle    = false;
let repeatMode   = 0;        // 0=off, 1=all, 2=one
let isMuted      = false;
let lastVolume   = 80;
let progressInt  = null;
let currentPage  = 'home';
let navHistory   = ['home'];
let navPosition  = 0;

// ── LIBRARY DATA (localStorage) ──
const LIKED_KEY   = 'zaam_liked';
const CHILL_KEY   = 'zaam_chill';
const GALAU_KEY   = 'zaam_galau';
const HISTORY_KEY = 'zaam_history';

function loadLib(key)     { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function saveLib(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }

let likedSongs = loadLib(LIKED_KEY);
let chillList  = loadLib(CHILL_KEY);
let galauList  = loadLib(GALAU_KEY);
let playHistory= loadLib(HISTORY_KEY);

// ══════════════════════════════════
// YOUTUBE PLAYER
// ══════════════════════════════════
function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('ytFrame', {
    height: '0', width: '0',
    playerVars: { autoplay: 1, playsinline: 1 },
    events: {
      onReady: () => { ytReady = true; setVolume(document.getElementById('volumeBar').value); },
      onStateChange: onPlayerStateChange,
    }
  });
}

function onPlayerStateChange(e) {
  switch (e.data) {
    case YT.PlayerState.PLAYING:
      isPlaying = true;
      setPlayIcon(true);
      startProgress();
      break;
    case YT.PlayerState.PAUSED:
      isPlaying = false;
      setPlayIcon(false);
      stopProgress();
      break;
    case YT.PlayerState.ENDED:
      if (repeatMode === 2) {
        ytPlayer.seekTo(0); ytPlayer.playVideo();
      } else {
        nextTrack();
      }
      break;
  }
}

// ══════════════════════════════════
// PLAYBACK
// ══════════════════════════════════
function playTrack(index) {
  if (!ytReady) { showToast('⏳ Player belum siap, tunggu sebentar…'); return; }
  if (index < 0 || index >= queue.length) return;

  currentIndex = index;
  const track = queue[index];

  updatePlayerUI(track);
  ytPlayer.loadVideoById(track.videoId);
  isPlaying = true;
  setPlayIcon(true);
  highlightActive();
  addToHistory(track);
  updateLikeBtn(track);
}

function updatePlayerUI(track) {
  const titleEl  = document.getElementById('playerTitle');
  const artistEl = document.getElementById('playerArtist');
  const thumbEl  = document.getElementById('playerThumb');

  titleEl.textContent  = track.title;
  artistEl.textContent = track.artist;
  thumbEl.src = track.thumbnail;
  thumbEl.style.visibility = 'visible';
  document.title = `${track.title} — ZaamMusic`;
}

function togglePlay() {
  if (!ytPlayer || currentIndex < 0) { showToast('Pilih lagu dulu!'); return; }
  isPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
}

function nextTrack() {
  if (!queue.length) return;
  let next;
  if (isShuffle) {
    do { next = Math.floor(Math.random() * queue.length); }
    while (next === currentIndex && queue.length > 1);
  } else {
    next = (currentIndex + 1) % queue.length;
  }
  playTrack(next);
}

function prevTrack() {
  if (!queue.length) return;
  const prev = (currentIndex - 1 + queue.length) % queue.length;
  playTrack(prev);
}

function setPlayIcon(playing) {
  document.getElementById('playIcon').innerHTML = playing
    ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    : '<path d="M8 5v14l11-7z"/>';
}

function setVolume(v) {
  if (ytPlayer && ytReady) ytPlayer.setVolume(parseInt(v));
  updateVolumeBar(v);
  lastVolume = parseInt(v);
  updateVolIcon(v);
}

function toggleMute() {
  if (!ytPlayer || !ytReady) return;
  if (isMuted) {
    ytPlayer.unMute();
    document.getElementById('volumeBar').value = lastVolume;
    updateVolumeBar(lastVolume);
    updateVolIcon(lastVolume);
  } else {
    lastVolume = parseInt(document.getElementById('volumeBar').value);
    ytPlayer.mute();
    document.getElementById('volumeBar').value = 0;
    updateVolumeBar(0);
    updateVolIcon(0);
  }
  isMuted = !isMuted;
}

function updateVolIcon(v) {
  const icon = document.getElementById('volIcon');
  v = parseInt(v);
  if (v === 0) {
    icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  } else if (v < 50) {
    icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  } else {
    icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  }
}

function updateVolumeBar(v) {
  const bar = document.getElementById('volumeBar');
  bar.style.background = `linear-gradient(to right, #fff ${v}%, #5e5e5e ${v}%)`;
}

// ── SHUFFLE & REPEAT ──
function toggleShuffle() {
  isShuffle = !isShuffle;
  document.getElementById('shuffleBtn').classList.toggle('active', isShuffle);
  showToast(isShuffle ? '🔀 Acak aktif' : 'Acak nonaktif');
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const btn = document.getElementById('repeatBtn');
  const labels = ['Ulangi nonaktif', '🔁 Ulangi semua', '🔂 Ulangi lagu ini'];
  btn.classList.toggle('active', repeatMode > 0);
  btn.innerHTML = repeatMode === 2
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><text x="11" y="14" font-size="7" font-weight="bold" fill="${repeatMode===2?'#1DB954':'currentColor'}" text-anchor="middle">1</text></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>`;
  showToast(labels[repeatMode]);
}

// ── PROGRESS ──
function startProgress() {
  stopProgress();
  progressInt = setInterval(() => {
    if (!ytPlayer || !ytReady) return;
    const cur = ytPlayer.getCurrentTime?.() || 0;
    const dur = ytPlayer.getDuration?.() || 0;
    if (dur > 0) {
      const pct = (cur / dur) * 100;
      const bar = document.getElementById('progressBar');
      bar.value = pct;
      bar.style.setProperty('--pct', pct + '%');
      document.getElementById('curTime').textContent = fmtTime(cur);
      document.getElementById('durTime').textContent = fmtTime(dur);
    }
  }, 500);
}

function stopProgress() { clearInterval(progressInt); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('progressBar').addEventListener('input', function () {
    if (!ytPlayer || !ytReady) return;
    const dur = ytPlayer.getDuration?.() || 0;
    ytPlayer.seekTo((this.value / 100) * dur, true);
    this.style.setProperty('--pct', this.value + '%');
  });
});

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function highlightActive() {
  document.querySelectorAll('[data-queue-idx]').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.queueIdx) === currentIndex);
  });
}

// ══════════════════════════════════
// LIKED / HISTORY
// ══════════════════════════════════
function toggleLike() {
  if (currentIndex < 0) return;
  const track = queue[currentIndex];
  const idx = likedSongs.findIndex(t => t.videoId === track.videoId);
  if (idx >= 0) {
    likedSongs.splice(idx, 1);
    showToast('💔 Dihapus dari Lagu yang Disukai');
  } else {
    likedSongs.unshift(track);
    showToast('💚 Ditambahkan ke Lagu yang Disukai');
  }
  saveLib(LIKED_KEY, likedSongs);
  updateLikeBtn(track);
  updateLibraryCounts();
}

function updateLikeBtn(track) {
  const isLiked = likedSongs.some(t => t.videoId === track.videoId);
  document.getElementById('likeBtn').classList.toggle('liked', isLiked);
}

function addToHistory(track) {
  playHistory = playHistory.filter(t => t.videoId !== track.videoId);
  playHistory.unshift(track);
  if (playHistory.length > 20) playHistory = playHistory.slice(0, 20);
  saveLib(HISTORY_KEY, playHistory);
  renderHistoryItems();
}

function renderHistoryItems() {
  const container = document.getElementById('historyItems');
  if (!container) return;
  if (!playHistory.length) {
    container.innerHTML = `
      <div class="lib-empty-history">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Belum ada riwayat</span>
      </div>`;
    return;
  }
  const visible = playHistory.slice(0, 8);
  container.innerHTML = visible.map((t, i) => `
    <div class="lib-history-item" onclick="playFromHistory(${i})">
      <img class="lib-history-thumb" src="${escHtml(t.thumbnail)}" alt="" onerror="this.style.opacity='.3'"/>
      <div class="lib-history-info">
        <div class="lib-history-title">${escHtml(t.title)}</div>
        <div class="lib-history-artist">${escHtml(t.artist)}</div>
      </div>
    </div>`).join('');
}

function playFromHistory(i) {
  const track = playHistory[i];
  queue = playHistory.slice();
  playTrack(i);
}

function updateLibraryCounts() {
  const likedEl = document.getElementById('likedCount');
  const chillEl = document.getElementById('chillCount');
  const galauEl = document.getElementById('galauCount');
  if (likedEl) likedEl.textContent = likedSongs.length;
  if (chillEl) chillEl.textContent = chillList.length;
  if (galauEl) galauEl.textContent = galauList.length;
}

function filterLib(type) {
  document.querySelectorAll('.lib-chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  const all = document.querySelectorAll('.lib-item');
  all.forEach(el => {
    if (type === 'all') el.style.display = '';
    else if (type === 'playlist') el.style.display = el.classList.contains('lib-playlist') ? '' : 'none';
    else if (type === 'history') el.style.display = 'none';
  });
  const histItems = document.getElementById('historyItems');
  const histLabel = document.querySelector('.lib-section-label.lib-history');
  if (type === 'playlist') {
    if (histItems) histItems.style.display = 'none';
    if (histLabel) histLabel.style.display = 'none';
  } else {
    if (histItems) histItems.style.display = '';
    if (histLabel) histLabel.style.display = '';
  }
}

function openPlaylist(name) {
  let tracks = [];
  let title  = '';
  if (name === 'liked')  { tracks = likedSongs; title = '💚 Lagu yang Disukai'; }
  if (name === 'chill')  { tracks = chillList;  title = '🎵 Chill Vibes'; }
  if (name === 'galau')  { tracks = galauList;  title = '💔 Galau Mode'; }

  document.getElementById('modalTitle').textContent = title;
  const body = document.getElementById('modalBody');
  if (!tracks.length) {
    body.innerHTML = `<div style="padding:32px;text-align:center;color:#888;font-size:14px">Playlist masih kosong.<br>Putar lagu dulu untuk menambahkan.</div>`;
  } else {
    queue = tracks.slice();
    body.innerHTML = tracks.map((t, i) => `
      <div class="playlist-item" data-queue-idx="${i}" onclick="playTrack(${i}); document.getElementById('playlistModal').style.display='none'">
        <img class="playlist-thumb" src="${escHtml(t.thumbnail)}" alt="" onerror="this.style.opacity='.3'"/>
        <div class="playlist-info">
          <div class="playlist-name">${escHtml(t.title)}</div>
          <div class="playlist-meta">${escHtml(t.artist)}</div>
        </div>
      </div>`).join('');
  }
  document.getElementById('playlistModal').style.display = 'flex';
}

function closeModal(e) {
  if (e.target === document.getElementById('playlistModal')) {
    document.getElementById('playlistModal').style.display = 'none';
  }
}

// ══════════════════════════════════
// NAVIGATION
// ══════════════════════════════════
function navigate(page, push = true) {
  currentPage = page;

  // Update nav active
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  // Show/hide search bar
  document.getElementById('topbarSearch').style.display = (page === 'search') ? '' : 'none';

  // Push nav history
  if (push) {
    navHistory = navHistory.slice(0, navPosition + 1);
    navHistory.push(page);
    navPosition = navHistory.length - 1;
  }
  updateNavArrows();

  // Render page
  switch (page) {
    case 'home':    renderHome();    break;
    case 'search':  renderSearch();  break;
    case 'library': renderLibrary(); break;
    case 'info':    renderInfo();    break;
  }
}

function historyBack() {
  if (navPosition > 0) {
    navPosition--;
    navigate(navHistory[navPosition], false);
  }
}
function historyForward() {
  if (navPosition < navHistory.length - 1) {
    navPosition++;
    navigate(navHistory[navPosition], false);
  }
}
function updateNavArrows() {
  document.getElementById('btnBack').disabled    = navPosition <= 0;
  document.getElementById('btnForward').disabled = navPosition >= navHistory.length - 1;
}

// ══════════════════════════════════
// HOME PAGE
// ══════════════════════════════════
async function renderHome() {
  const content = document.getElementById('content');
  content.innerHTML = buildSkeletonHome();

  try {
    const { status, data, message } = await fetchHome();
    if (status !== 'success') throw new Error(message);

    queue = [];
    content.innerHTML = '';

    const greeting = document.createElement('div');
    greeting.className = 'home-greeting fade-in';
    greeting.innerHTML = `<h1>${getGreeting()}</h1>`;

    // Quick access (recent)
    if (data.recent?.length) {
      const qGrid = document.createElement('div');
      qGrid.className = 'quick-grid';
      const queueOffset = queue.length;
      queue = queue.concat(data.recent.slice(0, 6));
      data.recent.slice(0, 6).forEach((t, i) => {
        const idx = queueOffset + i;
        const card = document.createElement('div');
        card.className = 'quick-card';
        card.innerHTML = `<img class="qc-thumb" src="${escHtml(t.thumbnail)}" alt="" onerror="this.style.opacity='.3'"/><span class="qc-name">${escHtml(t.title)}</span>`;
        card.onclick = () => playTrack(idx);
        qGrid.appendChild(card);
      });
      greeting.appendChild(qGrid);
    }

    content.appendChild(greeting);

    // Sections
    content.appendChild(buildCardSection('Hits Terbaru 2025', data.recent));
    content.appendChild(buildCardSection('🔥 Trending Sekarang', data.trending, 4));
    content.appendChild(buildCardSection('☕ Santai & Cafe', data.chill, 4));
    content.appendChild(buildCardSection('💔 Lagu Galau', data.galau, 4));

    // Store playlists
    if (data.chill?.length)  { chillList = data.chill; saveLib(CHILL_KEY, chillList); }
    if (data.galau?.length)  { galauList = data.galau; saveLib(GALAU_KEY, galauList); }
    updateLibraryCounts();

  } catch (e) {
    content.innerHTML = `
      <div style="padding:60px 32px;text-align:center;color:#888">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:16px;opacity:.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3 style="font-size:18px;color:#fff;margin-bottom:8px">Gagal memuat data</h3>
        <p style="font-size:14px">Pastikan server backend berjalan di <code style="background:#282828;padding:2px 8px;border-radius:4px">${API}/api/home</code></p>
        <button onclick="renderHome()" style="margin-top:20px;background:#1DB954;color:#000;border:none;border-radius:500px;padding:12px 28px;font-size:14px;font-weight:700;cursor:pointer">Coba Lagi</button>
      </div>`;
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '☀️ Selamat Pagi';
  if (h < 18) return '🌤️ Selamat Siang';
  return '🌙 Selamat Malam';
}

function buildCardSection(label, tracks, cols = 5) {
  if (!tracks?.length) return document.createDocumentFragment();
  const wrap = document.createElement('div');
  wrap.className = 'section-wrap fade-in';

  const offset = queue.length;
  queue = queue.concat(tracks);

  wrap.innerHTML = `
    <div class="section-head">
      <h2>${label}</h2>
    </div>
    <div class="cards-grid cols-${cols}" id="cg-${Date.now()}"></div>`;

  setTimeout(() => {
    const grid = wrap.querySelector('.cards-grid');
    tracks.forEach((t, i) => {
      const idx = offset + i;
      const card = document.createElement('div');
      card.className = 'music-card fade-in';
      card.style.animationDelay = `${i * 0.04}s`;
      card.innerHTML = `
        <div class="card-img-wrap">
          <img class="card-img" src="${escHtml(t.thumbnail)}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23282828%22 width=%22100%22 height=%22100%22/></svg>'"/>
          <button class="card-play" onclick="event.stopPropagation(); playTrack(${idx})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="card-title">${escHtml(t.title)}</div>
        <div class="card-sub">${escHtml(t.artist)}</div>`;
      card.onclick = () => playTrack(idx);
      grid.appendChild(card);
    });
  }, 0);
  return wrap;
}

// ══════════════════════════════════
// SEARCH PAGE
// ══════════════════════════════════
function renderSearch() {
  const content = document.getElementById('content');
  content.className = '';
  content.innerHTML = `
    <div class="search-page fade-in">
      <h2 style="padding:24px 0 20px;font-size:22px;font-weight:900">Telusuri semua</h2>
      <div class="browse-grid">
        ${browseGenres.map(g => `
          <div class="browse-card" style="background:${g.color}" onclick="searchGenre('${g.q}')">
            <h3>${g.name}</h3>
          </div>`).join('')}
      </div>
      <div id="searchResults"></div>
    </div>`;

  // Focus input
  setTimeout(() => {
    const inp = document.getElementById('searchInput');
    if (inp) inp.focus();
  }, 100);

  // Listen input
  const inp = document.getElementById('searchInput');
  if (inp) {
    inp.oninput = () => {
      document.getElementById('clearSearch').style.display = inp.value ? '' : 'none';
      if (inp._timer) clearTimeout(inp._timer);
      if (inp.value.trim().length >= 2) {
        inp._timer = setTimeout(() => doSearch(inp.value.trim()), 600);
      }
    };
    inp.onkeydown = e => { if (e.key === 'Enter') doSearch(inp.value.trim()); };
  }
}

function clearSearchInput() {
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearch').style.display = 'none';
  document.getElementById('searchResults').innerHTML = '';
}

async function searchGenre(q) {
  document.getElementById('searchInput').value = q;
  document.getElementById('clearSearch').style.display = '';
  await doSearch(q);
}

async function doSearch(q) {
  if (!q) return;
  const resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;
  resultsEl.innerHTML = buildSkeletonList(8);

  try {
    const { status, data, message } = await fetchSearch(q);
    if (status !== 'success') throw new Error(message);
    resultsEl.innerHTML = '';

    if (!data.length) {
      resultsEl.innerHTML = `<div style="padding:32px;text-align:center;color:#888;font-size:14px">Tidak ada hasil untuk "<strong style="color:#fff">${escHtml(q)}</strong>"</div>`;
      return;
    }

    queue = data;
    const section = document.createElement('div');
    section.className = 'fade-in';
    section.innerHTML = `
      <div class="section-head" style="padding:8px 0 16px">
        <h2>Hasil untuk "${escHtml(q)}"</h2>
        <span style="font-size:13px;color:#888">${data.length} lagu</span>
      </div>
      <div class="track-table" id="searchTrackList"></div>`;
    resultsEl.appendChild(section);

    const list = document.getElementById('searchTrackList');
    data.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'track-row';
      row.dataset.queueIdx = i;
      row.innerHTML = `
        <div class="tr-num">${i + 1}</div>
        <img class="tr-thumb" src="${escHtml(t.thumbnail)}" alt="" loading="lazy" onerror="this.style.opacity='.3'"/>
        <div class="tr-info">
          <div class="tr-title">${escHtml(t.title)}</div>
          <div class="tr-artist">${escHtml(t.artist)}</div>
        </div>
        <div class="tr-duration">—</div>`;
      row.ondblclick = () => playTrack(i);
      row.onclick    = () => playTrack(i);
      list.appendChild(row);
    });

  } catch (e) {
    if (resultsEl) resultsEl.innerHTML = `<div style="padding:32px;text-align:center;color:#888">${escHtml(e.message)}</div>`;
  }
}

// ══════════════════════════════════
// LIBRARY PAGE
// ══════════════════════════════════
function renderLibrary() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="library-page fade-in">
      <div class="library-banner">
        <h1>Perpustakaan Kamu</h1>
        <p>Semua playlist dan riwayat dengarmu ada di sini</p>
      </div>

      <div class="section-wrap" style="padding-top:0">
        <div class="section-head"><h2>Playlist</h2></div>

        <div class="playlist-item" onclick="openPlaylist('liked')">
          <div class="lib-icon liked-songs-icon" style="width:56px;height:56px;border-radius:4px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
          <div class="playlist-info">
            <div class="playlist-name">💚 Lagu yang Disukai</div>
            <div class="playlist-meta">Playlist • ${likedSongs.length} lagu</div>
          </div>
        </div>

        <div class="playlist-item" onclick="openPlaylist('chill')">
          <div class="lib-icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe);width:56px;height:56px;border-radius:4px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <div class="playlist-info">
            <div class="playlist-name">☕ Chill Vibes</div>
            <div class="playlist-meta">Playlist • ${chillList.length} lagu</div>
          </div>
        </div>

        <div class="playlist-item" onclick="openPlaylist('galau')">
          <div class="lib-icon" style="background:linear-gradient(135deg,#a18cd1,#fbc2eb);width:56px;height:56px;border-radius:4px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <div class="playlist-info">
            <div class="playlist-name">💔 Galau Mode</div>
            <div class="playlist-meta">Playlist • ${galauList.length} lagu</div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="section-wrap">
        <div class="section-head"><h2>🕐 Riwayat Pemutaran</h2></div>
        <div id="fullHistory"></div>
      </div>
    </div>`;

  const histEl = document.getElementById('fullHistory');
  if (!playHistory.length) {
    histEl.innerHTML = `<div style="padding:24px;text-align:center;color:#888;font-size:14px">Belum ada riwayat. Putar lagu dulu!</div>`;
  } else {
    playHistory.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'playlist-item';
      row.innerHTML = `
        <img class="playlist-thumb" src="${escHtml(t.thumbnail)}" alt="" onerror="this.style.opacity='.3'"/>
        <div class="playlist-info">
          <div class="playlist-name">${escHtml(t.title)}</div>
          <div class="playlist-meta">${escHtml(t.artist)}</div>
        </div>`;
      row.onclick = () => { queue = playHistory.slice(); playTrack(i); };
      histEl.appendChild(row);
    });
  }
}

// ══════════════════════════════════
// INFO PAGE
// ══════════════════════════════════
function renderInfo() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="info-page fade-in">
      <div class="info-hero">
        <div class="info-logo-big">
          <div class="info-logo-icon">
            <svg width="44" height="44" viewBox="0 0 50 50" fill="none">
              <path d="M8 14c9-4 22-3 32 4" stroke="white" stroke-width="4" stroke-linecap="round"/>
              <path d="M10 23c7.5-2.5 18-2 26 3.5" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
              <path d="M12 32c6-2 13.5-1.5 20 3" stroke="white" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="info-logo-text">
            <h1>ZaamMusic</h1>
            <p>Platform streaming musik Indonesia</p>
          </div>
        </div>
        <div class="info-verified">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
          Terverifikasi · Platform Musik Resmi
        </div>
      </div>

      <div class="info-content">
        <h2>Tentang ZaamMusic</h2>

        <p class="info-paragraph">
          <strong>ZaamMusic</strong> adalah platform streaming musik digital yang lahir dari semangat untuk menghadirkan pengalaman mendengarkan musik yang mulus, modern, dan menyenangkan bagi seluruh pengguna di Indonesia. Dibangun dengan teknologi web terkini dan ditenagai oleh kecerdasan <strong>YouTube Music API</strong>, ZaamMusic menawarkan akses ke jutaan lagu dari berbagai genre — mulai dari pop Indonesia terkini, lagu-lagu galau yang menyentuh hati, hingga koleksi chill music untuk menemani hari-hari santaimu. Tampilan antarmuka yang bersih dan intuitif terinspirasi dari platform musik terbaik dunia, namun dengan sentuhan lokal yang khas Indonesia.
        </p>

        <p class="info-paragraph">
          Platform ini diciptakan oleh <strong>ZAAM</strong>, seorang pengembang muda berbakat yang memiliki passion mendalam di bidang teknologi, desain antarmuka, dan musik. ZAAM membangun ZaamMusic dengan visi sederhana namun mulia: setiap orang berhak menikmati musik favorit mereka kapan saja dan di mana saja, tanpa hambatan. Dengan menggabungkan keahlian dalam <strong>Python (FastAPI)</strong> untuk backend yang cepat dan responsif, serta <strong>HTML, CSS, dan JavaScript</strong> untuk tampilan yang elegan, ZAAM berhasil menciptakan sebuah aplikasi musik yang tidak hanya fungsional — tetapi juga indah dipandang dan nyaman digunakan. ZaamMusic adalah bukti nyata bahwa kreativitas dan teknologi bisa berpadu menghasilkan sesuatu yang luar biasa.
        </p>

        <div class="info-stats">
          <div class="info-stat">
            <h3>∞</h3>
            <p>Lagu Tersedia</p>
          </div>
          <div class="info-stat">
            <h3>4</h3>
            <p>Kategori Musik</p>
          </div>
          <div class="info-stat">
            <h3>1</h3>
            <p>Kreator</p>
          </div>
          <div class="info-stat">
            <h3>100%</h3>
            <p>Gratis</p>
          </div>
        </div>

        <h2>Fitur Unggulan</h2>
        <div class="info-features">
          <div class="info-feature">
            <div class="info-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            </div>
            <h4>Streaming Real-time</h4>
            <p>Putar lagu langsung dari YouTube Music dengan kualitas audio terbaik</p>
          </div>
          <div class="info-feature">
            <div class="info-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <h4>Lagu yang Disukai</h4>
            <p>Simpan lagu favorit dan buat koleksi pribadi yang tersimpan secara lokal</p>
          </div>
          <div class="info-feature">
            <div class="info-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h4>Riwayat Pemutaran</h4>
            <p>Akses kembali lagu-lagu yang baru saja kamu dengarkan dengan mudah</p>
          </div>
          <div class="info-feature">
            <div class="info-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5z"/></svg>
            </div>
            <h4>Pencarian Cerdas</h4>
            <p>Temukan jutaan lagu dengan pencarian instan berbasis YouTube Music</p>
          </div>
          <div class="info-feature">
            <div class="info-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
            </div>
            <h4>Mode Acak & Ulangi</h4>
            <p>Kontrol penuh atas antrian putar dengan shuffle dan repeat</p>
          </div>
          <div class="info-feature">
            <div class="info-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </div>
            <h4>Playlist Terkurasi</h4>
            <p>Chill Vibes dan Galau Mode — playlist siap pakai untuk setiap suasana hati</p>
          </div>
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════
// BROWSE GENRES
// ══════════════════════════════════
const browseGenres = [
  { name: 'Pop Indonesia', color: 'linear-gradient(135deg,#1DB954,#0a6a2e)', q: 'lagu pop indonesia 2025' },
  { name: 'Galau',         color: 'linear-gradient(135deg,#8b5cf6,#4c1d95)', q: 'lagu galau indonesia' },
  { name: 'Chill & Cafe',  color: 'linear-gradient(135deg,#0ea5e9,#0369a1)', q: 'lagu santai cafe indonesia' },
  { name: 'Trending',      color: 'linear-gradient(135deg,#f59e0b,#92400e)', q: 'trending musik indonesia 2025' },
  { name: 'Hip-Hop',       color: 'linear-gradient(135deg,#ef4444,#7f1d1d)', q: 'hiphop indonesia' },
  { name: 'OPM',           color: 'linear-gradient(135deg,#ec4899,#701a75)', q: 'opm hits 2025' },
  { name: 'Acoustic',      color: 'linear-gradient(135deg,#84cc16,#365314)', q: 'acoustic indonesia terbaik' },
  { name: 'K-Pop',         color: 'linear-gradient(135deg,#06b6d4,#164e63)', q: 'kpop hits 2025' },
];

// ══════════════════════════════════
// API CALLS
// ══════════════════════════════════
async function fetchHome() {
  const res = await fetch(`${API}/api/home`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchSearch(q) {
  const res = await fetch(`${API}/api/search?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ══════════════════════════════════
// SKELETON LOADERS
// ══════════════════════════════════
function buildSkeletonHome() {
  const cards = Array(5).fill(`
    <div style="background:#181818;border-radius:8px;padding:16px">
      <div class="skeleton" style="aspect-ratio:1;border-radius:4px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:14px;width:80%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:12px;width:55%"></div>
    </div>`).join('');
  return `
    <div style="padding:24px 32px 16px">
      <div class="skeleton" style="width:200px;height:32px;margin-bottom:24px;border-radius:4px"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:32px">
        ${Array(6).fill(`<div class="skeleton" style="height:56px;border-radius:4px"></div>`).join('')}
      </div>
    </div>
    <div style="padding:0 32px">
      <div class="skeleton" style="width:160px;height:22px;margin-bottom:20px;border-radius:4px"></div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:24px">${cards}</div>
    </div>`;
}

function buildSkeletonList(n) {
  return Array(n).fill(`
    <div style="display:flex;gap:16px;align-items:center;padding:8px 16px;margin-bottom:4px">
      <div class="skeleton" style="width:40px;height:40px;border-radius:4px;flex-shrink:0"></div>
      <div style="flex:1">
        <div class="skeleton" style="height:14px;width:55%;margin-bottom:8px;border-radius:4px"></div>
        <div class="skeleton" style="height:12px;width:35%;border-radius:4px"></div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════
// TOAST
// ══════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2500);
}

// ══════════════════════════════════
// UTIL
// ══════════════════════════════════
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ══════════════════════════════════
// SIDEBAR INFO LINK
// ══════════════════════════════════
// Add Info nav to sidebar dynamically
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar-nav');
  if (sidebar) {
    const infoItem = document.createElement('a');
    infoItem.className = 'nav-item';
    infoItem.id = 'nav-info';
    infoItem.onclick = () => navigate('info');
    infoItem.innerHTML = `
      <span class="nav-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      </span>
      <span class="nav-label">Tentang</span>`;
    sidebar.appendChild(infoItem);

    // Library nav item
    const libItem = document.createElement('a');
    libItem.className = 'nav-item';
    libItem.id = 'nav-library';
    libItem.onclick = () => navigate('library');
    libItem.innerHTML = `
      <span class="nav-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
      </span>
      <span class="nav-label">Perpustakaan</span>`;
    sidebar.insertBefore(libItem, infoItem);
  }

  // Init
  renderHistoryItems();
  updateLibraryCounts();
  updateVolumeBar(80);
  navigate('home', false);
});

// ══════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT') return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); togglePlay();  break;
    case 'ArrowRight': nextTrack();                       break;
    case 'ArrowLeft':  prevTrack();                       break;
    case 'KeyM':       toggleMute();                      break;
    case 'KeyS':       toggleShuffle();                   break;
  }
});
