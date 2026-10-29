(() => {
  const requestedItem = new URLSearchParams(location.search).get('item');
  const item = requestedItem === 'piano' ? 'fridge' : requestedItem;
  const mission = window.balloonMissions[item] || window.balloonMissions.house;
  const object = document.getElementById('lift-object');
  const progress = document.getElementById('lift-progress');
  const dialog = document.getElementById('result-dialog');
  const CLUSTER_SIZE = 5;
  const targetBalloons = mission.goal * CLUSTER_SIZE;
  let count = 0;
  let streak = 0;
  const ROUND_SECONDS = 30;
  const mode = window.balloonMode;
  const birdWaves = mode.birdTimes.map(time => ({ arrival: time + Math.random(), warned: false, launched: false }));
  document.querySelector('.game-header .wordmark').textContent = 'LIFTOFF';
  document.querySelectorAll('a[href="choose.html"]').forEach(link => { link.href = 'choose.html'; });
  let started = null;
  let ended = false;
  let altitude = 0;
  let verticalSpeed = 0;
  let liftFraction = 0;
  let lastFlightFrame = null;
  let sound = true;
  let audio = null;
  const roundClock = document.getElementById('round-clock');
  let previousSecond = ROUND_SECONDS;
  const timerDigits = [document.getElementById('timer-tens'), document.getElementById('timer-ones')];
  function updateTimer(seconds) {
    const value = String(seconds).padStart(2, '0');
    timerDigits.forEach((digit, index) => {
      if (digit.dataset.value === value[index]) return;
      digit.querySelector('.flip-leaf').textContent = digit.dataset.value;
      digit.dataset.value = value[index];
      digit.classList.remove('is-flipping');
      void digit.offsetWidth;
      digit.classList.add('is-flipping');
    });
  }
  updateTimer(ROUND_SECONDS);
  roundClock.setAttribute('aria-label', `${ROUND_SECONDS} seconds remaining`);
  document.getElementById('mission-title').textContent = `Lift the ${mission.name}`;

  object.innerHTML = mission.image ? `<img src="${mission.image}" alt="${mission.name}">` : `<span role="img" aria-label="${mission.name}">${mission.emoji}</span>`;
  progress.max = targetBalloons;
  object.dataset.attachY = String(mission.attachY);
  object.style.setProperty('--foot-adjust', `${(mission.footInset || 0) * 100}%`);

  function placeOnGround() {
    // Same image-cover geometry as the wallpaper (1672 × 941), anchored at bottom.
    const imageHeight = Math.max(window.innerHeight, window.innerWidth * 941 / 1672);
    const groundBottom = imageHeight * 0.16;
    object.style.bottom = `${groundBottom}px`;
    document.getElementById('ground-shadow').style.bottom = `${groundBottom - 5}px`;
  }

  function animateFlight(time) {
    if (ended) return;
    const dt = lastFlightFrame === null ? 0 : Math.min((time - lastFlightFrame) / 1000, 0.05);
    lastFlightFrame = time;
    // Two complete clusters provide lift. More balloons increase sustained ascent.
    const targetSpeed = count >= CLUSTER_SIZE * 2 ? 4 + liftFraction * 15 : altitude > 0 ? -9 : 0;
    verticalSpeed += (targetSpeed - verticalSpeed) * (1 - Math.exp(-dt * 1.5));
    altitude = Math.max(0, altitude + verticalSpeed * dt);
    if (altitude === 0 && verticalSpeed < 0) verticalSpeed = 0;
    object.style.transform = `translateY(-${altitude.toFixed(3)}px)`;
    const shadow = document.getElementById('ground-shadow');
    shadow.style.opacity = String(Math.max(0.08, 1 - altitude / 230));
    shadow.style.transform = `scale(${Math.max(.3, 1 - altitude / 350)})`;
    requestAnimationFrame(animateFlight);
  }
  placeOnGround();
  requestAnimationFrame(animateFlight);

  function unlockAudio() {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(() => {});
    } catch { /* The visual countdown remains available without audio. */ }
  }

  function countdownBeep(seconds) {
    if (!sound || !audio) return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(seconds <= 3 ? 1046 : 784, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.11, start + .008);
      gain.gain.exponentialRampToValueAtTime(.001, start + (seconds <= 3 ? .22 : .11));
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + .24);
    } catch { /* Muted or unavailable audio must never stop the round. */ }
  }

  function tone(frequency) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.4, audio.currentTime + .12);
      gain.gain.setValueAtTime(.04, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + .2);
    } catch { /* Sound is optional; play remains available without audio. */ }
  }

  function finish(won) {
    ended = true;
    document.body.dataset.gameEnded = 'true';
    clearInterval(clock);
    window.dispatchEvent(new CustomEvent('round-ended'));
    roundClock.classList.remove('is-ticking');
    document.getElementById('bird-warning').hidden = true;
    document.getElementById('bird-deflect').hidden = true;
    dialog.dataset.outcome = won ? 'pass' : 'fail';
    document.getElementById('result-title').textContent = won ? 'YOU PASS' : 'YOU FAIL';
    const resultDescription = document.getElementById('result-description');
    resultDescription.hidden = won;
    resultDescription.textContent = won ? '' : `${mission.name} · ${document.getElementById('lift-percent').textContent}`;
    document.getElementById('play-again').hidden = won;
    const nextMode = { casual: 'challenger', challenger: 'hardcore' }[window.balloonModeId];
    if (!won) {
      const easierMode = { hardcore: 'challenger', challenger: 'casual' }[window.balloonModeId];
      const copy = document.getElementById('next-challenge-copy');
      const link = document.getElementById('next-challenge');
      copy.textContent = easierMode === 'challenger'
        ? 'Picked Hardcore. Got humbled. Try Challenger?'
        : easierMode === 'casual'
          ? 'The balloons won this round. Maybe start with Casual?'
          : 'Even the backpack said no. Take a breath and try again.';
      copy.hidden = false;
      if (easierMode) {
        link.textContent = `Try ${window.balloonModes[easierMode].name} →`;
        link.href = `choose.html?suggest=${easierMode}`;
        link.hidden = false;
      }
    } else if (won && item === 'van') {
      const copy = document.getElementById('next-challenge-copy');
      const link = document.getElementById('next-challenge');
      copy.textContent = 'Staria was the warm-up. Think you can lift 이즈 house?';
      copy.hidden = false;
      link.textContent = 'Take on 이즈 house →';
      link.href = 'play.html?item=house&mode=hardcore';
      link.hidden = false;
    } else if (won && nextMode) {
      const copy = document.getElementById('next-challenge-copy');
      const link = document.getElementById('next-challenge');
      copy.textContent = nextMode === 'challenger' ? 'Nice lift! Ready for something tougher?' : 'Challenger cleared. Think you can handle Hardcore?';
      copy.hidden = false;
      link.textContent = `Try ${window.balloonModes[nextMode].name} →`;
      link.href = `choose.html?suggest=${nextMode}`;
      link.hidden = false;
    }
    document.body.classList.add('is-finished');
    if (won) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Start from the visible position, even if the previous lift is still moving.
      const start = window.getComputedStyle(object).transform;
      object.style.setProperty('--launch-start', start === 'none' ? 'translateY(0)' : start);
      object.style.setProperty('--launch-end', `${-(object.offsetTop + object.offsetHeight + window.innerHeight)}px`);
      document.body.classList.add('is-victory');
      let shown = false;
      const revealResult = () => {
        if (shown) return;
        shown = true;
        dialog.showModal();
      };
      object.addEventListener('animationend', event => {
        if (event.target === object && event.animationName === 'cargo-launch') revealResult();
      }, { once: true });
      object.classList.add('is-launching');
      // Also covers reduced motion and a tab that was backgrounded during take-off.
      setTimeout(revealResult, reducedMotion ? 350 : 2800);
    } else {
      dialog.showModal();
    }
    tone(won ? 660 : 180);
  }

  // The countdown begins with the first inflation, leaving time to read the hint.
  document.addEventListener('pointerdown', event => {
    if (event.button === 0 && event.isPrimary && !event.target.closest('button, a, dialog') && !ended && started === null) {
      unlockAudio();
      started = performance.now();
      document.getElementById('hold-prompt').classList.add('is-dismissed');
    }
  });
  const clock = setInterval(() => {
    if (started === null || ended) return;
    const elapsed = (performance.now() - started) / 1000;
    const seconds = Math.max(0, ROUND_SECONDS - Math.floor(elapsed));
    updateTimer(seconds);
    roundClock.setAttribute('aria-label', `${seconds} seconds remaining`);
    roundClock.classList.toggle('is-urgent', seconds <= 10 && seconds > 0);
    roundClock.classList.toggle('is-critical', seconds <= 3 && seconds > 0);
    if (seconds !== previousSecond && seconds <= 10 && seconds > 0) {
      roundClock.classList.remove('is-ticking');
      // Restart a single beat on each second, rather than a looping animation.
      void roundClock.offsetWidth;
      roundClock.classList.add('is-ticking');
      countdownBeep(seconds);
    }
    previousSecond = seconds;
    if (seconds === 0) { finish(false); return; }
    for (const wave of birdWaves) {
      if (!wave.warned && elapsed >= wave.arrival) {
        wave.warned = true;
        document.getElementById('bird-warning').textContent = mode.birdCount > 1 ? 'Flock incoming — chase each bird away!' : 'Bird approaching — click it to protect your balloons!';
        document.getElementById('bird-warning').hidden = false;
        tone(780);
      }
      if (!wave.launched && elapsed >= wave.arrival + 1.5) {
        wave.launched = true;
        document.getElementById('bird-warning').hidden = true;
        window.dispatchEvent(new CustomEvent('bird-launch'));
      }
    }
  }, 200);

  function renderLift() {
    // First cluster pulls the ropes taut; the second starts lifting.
    const fraction = Math.max(0, Math.min((count - CLUSTER_SIZE) / (targetBalloons - CLUSTER_SIZE), 1));
    progress.value = fraction * targetBalloons;
    document.getElementById('lift-percent').textContent = `${Math.round(fraction * 100)}%`;
    liftFraction = fraction;
    document.body.dataset.streak = String(streak);
  }

  function miss(late) {
    streak = 0;
    const lost = late && count > 0;
    if (lost) {
      count--;
      window.dispatchEvent(new CustomEvent('balloon-detach'));
    }
    renderLift();
    tone(130);
  }

  window.addEventListener('balloon-released', event => {
    if (ended) return;
    if (!event.detail.success) {
      miss(event.detail.late);
      return;
    }
    count += CLUSTER_SIZE;
    streak++;
    renderLift();
    tone(400 + Math.min(streak, 10) * 40);
    if (count >= targetBalloons) finish(true);
  });
  window.addEventListener('balloon-popped', () => {
    if (!ended) miss(true);
  });
  window.addEventListener('bird-hit', event => {
    if (ended) return;
    count = Math.max(0, count - event.detail.count);
    streak = 0;
    renderLift();
    tone(160);
  });
  window.addEventListener('bird-scared', () => {
    if (ended) return;
    tone(880);
  });
  document.getElementById('sound-toggle').addEventListener('click', event => {
    sound = !sound;
    if (sound) unlockAudio();
    event.currentTarget.setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
    event.currentTarget.title = sound ? 'Turn sound off' : 'Turn sound on';
    event.currentTarget.setAttribute('aria-pressed', String(sound));
    tone(550);
  });
  document.getElementById('restart').addEventListener('click', () => location.reload());
  document.getElementById('play-again').addEventListener('click', () => location.reload());
  dialog.addEventListener('cancel', event => event.preventDefault());
  window.addEventListener('resize', placeOnGround);
  document.addEventListener('visibilitychange', () => { lastFlightFrame = null; });
})();
