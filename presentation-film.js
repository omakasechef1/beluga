// Load a complete, browser-local copy so seeking does not depend on HTTP Range support.
(function () {
  const film = document.getElementById('presentation-film');
  const button = document.querySelector('.film-play');
  if (!film || !button) return;
  const label = button.lastElementChild;
  const source = film.querySelector('source').src;
  let preparation, objectUrl;
  const compact = matchMedia('(max-width: 700px)');
  function syncControls() {
    film.controls = !compact.matches || button.hidden;
  }
  compact.addEventListener('change', syncControls);
  syncControls();
  function prepare() {
    if (!preparation) preparation = (async () => {
      const response = await fetch(source);
      if (!response.ok) throw new Error('Film download failed');
      const blob = await response.blob();
      const time = film.currentTime;
      objectUrl = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        film.addEventListener('loadedmetadata', resolve, {once:true});
        film.addEventListener('error', reject, {once:true});
        film.src = objectUrl;
        film.load();
      });
      film.currentTime = Math.min(time, film.duration);
    })().catch(error => { preparation = undefined; throw error; });
    return preparation;
  }
  async function start() {
    button.disabled = true;
    label.textContent = 'Loading film…';
    try {
      await prepare();
      await film.play();
      button.hidden = true;
    } catch (error) {
      button.hidden = false;
      label.textContent = 'Could not load film · tap to retry';
    } finally { button.disabled = false; syncControls(); }
  }
  button.addEventListener('click', start);
  film.addEventListener('play', () => {
    if (objectUrl) { button.hidden = true; syncControls(); return; }
    film.pause();
    start();
  });
  film.addEventListener('ended', () => {
    button.hidden = false;
    label.textContent = 'Replay presentation film';
    syncControls();
  });
})();
