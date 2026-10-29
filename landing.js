(() => {
  const journey = document.getElementById('landing-journey');
  const balloon = document.getElementById('transition-balloon');
  const content = document.querySelector('.content');
  const hint = document.getElementById('scroll-hint');
  const instructions = document.getElementById('landing-instructions');
  const words = [];
  instructions.querySelectorAll('.instruction-line').forEach(line => {
    const parts = line.textContent.trim().split(/\s+/);
    line.replaceChildren();
    parts.forEach((text, index) => {
      const word = document.createElement('span');
      word.className = 'instruction-word';
      word.textContent = text;
      line.appendChild(word);
      if (index < parts.length - 1) line.appendChild(document.createTextNode(' '));
      words.push(word);
    });
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false;
  let leaving = false;

  // Returning from the selection page starts at the intro, rather than redirecting again.
  history.scrollRestoration = 'manual';

  function render() {
    pending = false;
    const coverSize = Math.max(window.innerWidth, window.innerHeight) * 2;
    const distance = Math.max(1, journey.offsetHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(window.scrollY / distance, 1));
    // Read the instructions first; only the final scroll segment shrinks the balloon.
    const shrink = Math.max(0, Math.min((progress - 0.8) / 0.2, 1));
    const eased = shrink * shrink * (3 - 2 * shrink);
    const finalScale = 64 / coverSize;
    // Fit the artwork to the viewport, not the oversized transition shape.
    const imageRatio = 1672 / 941;
    const viewportArtWidth = Math.max(window.innerWidth, window.innerHeight * imageRatio);
    const shapeArtWidth = Math.max(coverSize, coverSize * 1.2 * imageRatio);
    const artWidth = viewportArtWidth + (shapeArtWidth - viewportArtWidth) * eased;
    balloon.style.setProperty('--art-width', `${artWidth}px`);
    balloon.style.setProperty('--art-height', `${artWidth / imageRatio}px`);
    balloon.style.setProperty('--cover-size', `${coverSize}px`);
    balloon.style.setProperty('--balloon-scale', String(reducedMotion.matches ? 1 : 1 - eased * (1 - finalScale)));
    balloon.style.opacity = reducedMotion.matches ? String(1 - shrink) : '1';
    content.style.opacity = String(Math.max(0, 1 - progress / 0.13));
    content.style.transform = reducedMotion.matches ? 'none' : `translateY(${-Math.min(progress / 0.13, 1) * 45}px)`;
    instructions.style.opacity = String(progress < 0.14 ? 0 : Math.max(0, 1 - Math.max(0, (progress - 0.72) / 0.08)));
    const reveal = (progress - 0.16) / 0.46;
    words.forEach((word, index) => {
      const amount = Math.max(0, Math.min(reveal * words.length - index, 1));
      word.style.opacity = String(amount);
      word.style.transform = reducedMotion.matches ? 'none' : `translateY(${(1 - amount) * 14}px)`;
    });
    hint.style.opacity = String(Math.max(0, 1 - progress / 0.12));
    if (progress >= 0.995 && !leaving) {
      leaving = true;
      window.location.assign('choose.html?intro=balloon');
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(render);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reducedMotion.addEventListener('change', schedule);
  window.addEventListener('pageshow', () => {
    leaving = false;
    window.scrollTo(0, 0);
    schedule();
  });
  render();
})();
