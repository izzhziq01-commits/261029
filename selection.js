(() => {
  const grid = document.getElementById('choice-grid');
  const cards = [];
  const groups = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function select(index, scroll = false) {
    cards.forEach((card, i) => {
      const active = i === index;
      card.element.dataset.selected = String(active);
      card.button.setAttribute('aria-pressed', String(active));
      card.play.tabIndex = active ? 0 : -1;
    });
    if (scroll) cards[index].element.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest', inline: 'center' });
  }

  Object.entries(window.balloonMissions).sort((a, b) => a[1].liftOrder - b[1].liftOrder).forEach(([id, mission], index) => {
    if (!groups.has(mission.difficulty)) {
      const section = document.createElement('section');
      section.className = 'difficulty-group';
      section.dataset.difficulty = mission.difficulty;
      const title = document.createElement('h2');
      title.className = 'difficulty-heading';
      title.id = `heading-${mission.difficulty}`;
      title.textContent = window.balloonModes[mission.difficulty].name;
      section.setAttribute('aria-labelledby', title.id);
      const row = document.createElement('div');
      row.className = 'difficulty-cards';
      section.append(title, row);
      grid.appendChild(section);
      groups.set(mission.difficulty, row);
    }
    const element = document.createElement('article');
    element.className = 'choice-card';
    element.dataset.difficulty = mission.difficulty;
    element.style.setProperty('--card-index', index);
    const button = document.createElement('button');
    button.className = 'card-select';
    button.type = 'button';
    button.setAttribute('aria-label', `Select ${mission.name}`);
    button.innerHTML = `<span class="card-art">${mission.image ? `<img src="${mission.image}" alt="">` : `<span class="choice-emoji" aria-hidden="true">${mission.emoji}</span>`}</span><span class="card-caption"><span class="choice-name">${mission.name}</span></span>`;
    const play = document.createElement('a');
    play.className = 'card-play';
    play.href = `play.html?item=${encodeURIComponent(id)}&mode=${mission.difficulty}`;
    play.textContent = 'LIFT OFF →';
    play.setAttribute('aria-label', `Lift off with ${mission.name}`);
    element.append(button, play);
    groups.get(mission.difficulty).appendChild(element);
    cards.push({ element, button, play, name: mission.name, difficulty: window.balloonModes[mission.difficulty].name });
    button.addEventListener('click', () => select(index, true));
    button.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % cards.length;
      else if (event.key === 'ArrowLeft') next = (index + cards.length - 1) % cards.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = cards.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
      cards[next].button.focus({ preventScroll: true });
    });
  });
  const suggested = new URLSearchParams(location.search).get('suggest');
  const orderedMissions = Object.values(window.balloonMissions).sort((a, b) => a.liftOrder - b.liftOrder);
  const suggestedIndex = orderedMissions.findIndex(mission => mission.difficulty === suggested);
  select(suggestedIndex >= 0 ? suggestedIndex : 0, suggestedIndex >= 0);
})();
