(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const MIN_RADIUS = 6;
  const MAX_RADIUS = 44;
  const ATTACHED_RADIUS = 25;
  const CLUSTER_SIZE = 5;
  const mode = window.balloonMode;
  const DANGER_GRACE_TIME = 0.18;
  const POP_TIME = 0.09;
  const balloons = [];
  const particles = [];
  const liftObject = document.getElementById('lift-object');
  let attachmentCount = 0;
  let held = null;
  let pointerId = null;
  let lastTime = null;
  let width = 0;
  let height = 0;
  const meter = document.getElementById('timing-meter');
  const needle = document.getElementById('meter-needle');
  const zone = document.getElementById('meter-zone');
  const timingHint = document.getElementById('timing-hint');
  const pressureRing = document.getElementById('meter-pressure');
  const CIRCUMFERENCE = 2 * Math.PI * 26;
  let hideMeterTimer;
  const birds = [];
  const birdButton = document.getElementById('bird-deflect');

  function birdAt(x, y) {
    return birds.find(bird => !bird.fleeing && bird.x >= 0 && bird.x <= width &&
      Math.hypot(x - bird.x, y - bird.y - Math.sin(bird.age * 6) * 3) <= 50);
  }

  function chaseBird(bird) {
    if (!bird || bird.fleeing || document.body.dataset.gameEnded === 'true') return;
    release(false);
    bird.fleeing = true;
    bird.direction *= -1;
    bird.speed *= 1.7;
    bird.button.hidden = true;
    window.dispatchEvent(new CustomEvent('bird-scared'));
  }

  function removeBird(index) {
    const [bird] = birds.splice(index, 1);
    if (bird.button === birdButton) birdButton.hidden = true;
    else bird.button.remove();
  }

  window.addEventListener('round-ended', () => {
    while (birds.length) removeBird(birds.length - 1);
  });

  function compactSlots() {
    const attached = balloons.filter(balloon => balloon.state === 'attached');
    // Keep gaps left by popped balloons instead of shuffling the whole bouquet.
    attachmentCount = attached.reduce((next, balloon) => Math.max(next, balloon.slot + 1), 0);
  }

  window.addEventListener('bird-launch', () => {
    if (document.body.dataset.gameEnded === 'true') return;
    const targets = balloons.filter(balloon => balloon.state === 'attached');
    const target = targets[Math.floor(Math.random() * targets.length)];
    const direction = Math.random() < 0.5 ? 1 : -1;
    for (let index = 0; index < mode.birdCount; index++) {
      const button = birds.length === 0 ? birdButton : document.createElement('button');
      button.className = 'bird-deflect';
      button.type = 'button';
      button.hidden = true;
      button.setAttribute('aria-label', `Chase away bird ${index + 1}`);
      if (button !== birdButton) document.body.appendChild(button);
      const bird = {
        x: direction === 1 ? -65 - index * 110 : width + 65 + index * 110,
        y: (target ? target.y : height * 0.35) + (index - (mode.birdCount - 1) / 2) * 34,
        direction, age: index * .2, hits: 0, formation: index,
        limit: mode.birdCount > 1 ? 2 : 2 + Math.floor(Math.random() * 2),
        speed: (width + 130) / 3.2, button,
      };
      // The reusable first hitbox gets a fresh handler for each encounter.
      button.onclick = () => chaseBird(bird);
      birds.push(bird);
    }
  });

  function updateBirds(dt) {
    for (let index = birds.length - 1; index >= 0; index--) {
      const bird = birds[index];
      if (document.body.dataset.gameEnded === 'true') { removeBird(index); continue; }
      bird.age += dt;
      bird.x += bird.direction * bird.speed * dt;
      const targets = balloons.filter(balloon => balloon.state === 'attached');
      const target = targets[(bird.formation * 3) % Math.max(1, targets.length)];
      if (bird.fleeing) bird.y -= 95 * dt;
      else if (target) bird.y += (target.y - bird.y) * (1 - Math.exp(-dt * 4));
      bird.button.hidden = bird.fleeing || bird.x < 0 || bird.x > width;
      bird.button.style.left = `${bird.x}px`;
      bird.button.style.top = `${bird.y + Math.sin(bird.age * 6) * 3}px`;
      let hitCount = 0;
      for (const balloon of targets) {
        if (bird.fleeing || bird.hits >= bird.limit) break;
        if (Math.hypot(balloon.x - bird.x, balloon.y - bird.y) < balloon.radius + 19) {
          balloon.state = 'popping';
          balloon.popAge = 0;
          bird.hits++;
          hitCount++;
        }
      }
      if (hitCount) {
        compactSlots();
        window.dispatchEvent(new CustomEvent('bird-hit', { detail: { count: hitCount } }));
      }
    // A small winged silhouette, with flapping wings and a distant ground shadow.
    ctx.save();
    ctx.fillStyle = 'rgba(32, 44, 52, 0.09)';
    ctx.beginPath();
    ctx.ellipse(bird.x, height - 130, 26, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(bird.x, bird.y + Math.sin(bird.age * 6) * 3);
    ctx.scale(bird.direction, 1);
    const wing = Math.sin(bird.age * 15) * 21;
    ctx.fillStyle = '#ecede6';
    ctx.strokeStyle = '#26394b';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(240, 247, 255, 0.55)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(-25, 7);
    ctx.quadraticCurveTo(-12, -5, -24, -17 - wing);
    ctx.quadraticCurveTo(-4, -13, 2, -3);
    ctx.quadraticCurveTo(13, -17, 26, -12 - wing);
    ctx.quadraticCurveTo(18, -1, 10, 3);
    ctx.lineTo(21, 5);
    ctx.lineTo(9, 8);
    ctx.quadraticCurveTo(0, 13, -10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
      // Followers may start well outside the screen; remove only after exiting.
      const exited = bird.direction === 1 ? bird.x > width + 80 : bird.x < -80;
      if (exited || bird.y < -70) removeBird(index);
    }
  }

  function hideMeter(delay = 0) {
    clearTimeout(hideMeterTimer);
    if (delay) hideMeterTimer = setTimeout(() => { if (meter) meter.hidden = true; }, delay);
    else if (meter) meter.hidden = true;
  }

  function timing(balloon) {
    const pressure = balloon.pressure;
    return { pressure, success: pressure >= balloon.zoneStart && pressure <= balloon.zoneStart + balloon.zoneWidth, late: pressure > balloon.zoneStart + balloon.zoneWidth };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function release(count = true) {
    if (held) {
      const result = timing(held);
      for (const balloon of held.members) {
        if (count && result.success) balloon.radius = ATTACHED_RADIUS;
        balloon.state = result.success && count ? 'floating' : 'deflating';
        if (count && result.success && liftObject && document.body.dataset.gameEnded !== 'true') {
          balloon.state = 'attached';
          balloon.slot = attachmentCount++;
          balloon.attachAge = 0;
          balloon.releaseX = balloon.x;
          balloon.releaseY = balloon.y;
        }
        if (count && !result.success) balloon.state = 'popping';
        balloon.group = null;
      }
      if (count) {
        if (meter) meter.dataset.state = result.success ? 'success' : 'miss';
        if (timingHint) timingHint.textContent = result.success ? 'NICE' : 'POP';
        window.dispatchEvent(new CustomEvent('balloon-released', { detail: { ...result, balloonCount: CLUSTER_SIZE } }));
        hideMeter(350);
      } else {
        if (meter) meter.dataset.state = 'idle';
        if (timingHint) timingHint.textContent = 'HOLD';
        hideMeter();
      }
    }
    held = null;
    pointerId = null;
  }

  document.addEventListener('pointerdown', (event) => {
    if (document.body.dataset.gameEnded === 'true') return;
    const birdTarget = event.target.closest('.bird-deflect');
    const hitBird = birds.find(bird => bird.button === birdTarget) || birdAt(event.clientX, event.clientY);
    if (event.button === 0 && event.isPrimary && hitBird) {
      chaseBird(hitBird);
      return;
    }
    if (event.button !== 0 || !event.isPrimary || pointerId !== null) return;
    if (event.target.closest('button, a, input, select, textarea, .item-chip')) return;
    pointerId = event.pointerId;
    held = {
      x: event.clientX, y: event.clientY - 90, radius: MIN_RADIUS,
      age: 0, state: 'inflating', hue: Math.floor(Math.random() * 360),
      speed: 42 + Math.random() * 18,
      drift: (Math.random() - 0.5) * 12,
      phase: Math.random() * Math.PI * 2, popAge: 0,
      zoneStart: 0.22 + Math.random() * 0.58,
      zoneWidth: mode.zoneMin + Math.random() * mode.zoneRange,
      pressure: 0, dangerAge: 0,
      baseRate: (mode.rateMin + Math.random() * mode.rateRange) * (1 + Math.min(Number(document.body.dataset.streak || 0), 8) * mode.streakSpeed),
      airRate: mode.rateMin, targetRate: mode.rateMin, airChangeIn: 0,

    };
    // Keep even the widest Casual arc fully inside the ring, before burst pressure.
    held.zoneStart = Math.min(held.zoneStart, 0.92 - held.zoneWidth);
    held.originX = event.clientX;
    held.originY = event.clientY - 100;
    const offsets = [[0, -33], [-28, -7], [28, -7], [-18, 26], [18, 26]];
    const members = offsets.map(([dx, dy], index) => {
      const balloon = index === 0 ? held : { ...held, hue: Math.floor(Math.random() * 360), phase: Math.random() * Math.PI * 2 };
      balloon.dx = dx;
      balloon.dy = dy;
      balloon.x = held.originX + dx;
      balloon.y = held.originY + dy;
      balloon.group = held;
      return balloon;
    });
    held.members = members;
    balloons.push(...members);
    clearTimeout(hideMeterTimer);
    if (zone) {
      zone.setAttribute('stroke-dasharray', `${held.zoneWidth * CIRCUMFERENCE} ${CIRCUMFERENCE}`);
      zone.setAttribute('stroke-dashoffset', String(-held.zoneStart * CIRCUMFERENCE));
    }
    if (meter) {
      meter.hidden = false;
      meter.dataset.state = 'inflating';
      // Stay at the press location; clamp only to keep the ring on screen.
      meter.style.left = `${Math.max(36, Math.min(width - 36, event.clientX))}px`;
      meter.style.top = `${Math.max(36, Math.min(height - 85, event.clientY))}px`;
    }
    if (needle) needle.setAttribute('transform', 'rotate(0 32 32)');
    if (pressureRing) pressureRing.setAttribute('stroke-dasharray', `0 ${CIRCUMFERENCE}`);
    if (timingHint) timingHint.textContent = 'HOLD';
  });

  document.addEventListener('pointermove', (event) => {
    if (!held || event.pointerId !== pointerId) return;
    held.originX = event.clientX;
    held.originY = event.clientY - 100;
  });
  window.addEventListener('pointerup', (event) => {
    const hitBird = birdAt(event.clientX, event.clientY);
    if (event.pointerId === pointerId && hitBird) {
      chaseBird(hitBird);
      return;
    }
    if (event.pointerId === pointerId) release();
  });
  window.addEventListener('pointercancel', (event) => {
    if (event.pointerId === pointerId) release(false);
  });
  window.addEventListener('blur', () => release(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      release(false);
      lastTime = null;
    }
  });
  window.addEventListener('resize', resize);
  window.addEventListener('balloon-detach', () => {
    const attached = balloons.filter(balloon => balloon.state === 'attached');
    const last = attached[attached.length - 1];
    if (last) {
      last.state = 'popping';
      last.popAge = 0;
      compactSlots();
    }
  });

  function burst(balloon) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 65;
      particles.push({
        x: balloon.x + Math.cos(angle) * balloon.radius * 0.7,
        y: balloon.y + Math.sin(angle) * balloon.radius * 0.8,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.35, hue: balloon.hue,
      });
    }
  }

  function drawBalloon(balloon) {
    const scale = balloon.state === 'popping' ? 1 + balloon.popAge / POP_TIME * 0.22 : 1;
    const radius = balloon.radius * scale;
    ctx.save();
    ctx.translate(balloon.x, balloon.y);
    if (balloon.state === 'danger' || (balloon.state === 'inflating' && timing(balloon).pressure > balloon.zoneStart + balloon.zoneWidth)) {
      // Ramp the warning in gently without changing the capped balloon size.
      const dangerAge = Math.max(0, (balloon.pressure - balloon.zoneStart - balloon.zoneWidth) * 3);
      const intensity = Math.min(dangerAge / 0.25, 1);
      ctx.translate(Math.sin(dangerAge * 32) * 2 * intensity, 0);
      ctx.rotate(Math.sin(dangerAge * 24) * 0.035 * intensity);
    }
    ctx.strokeStyle = 'rgba(90, 90, 105, 0.5)';
    ctx.lineWidth = 1;
    if (balloon.state !== 'attached') {
      ctx.beginPath();
      ctx.moveTo(0, radius * 1.18);
      ctx.bezierCurveTo(-5, radius * 1.4, 7, radius * 1.6, 0, radius * 1.85);
      ctx.stroke();
    }
    const fill = ctx.createRadialGradient(-radius * 0.3, -radius * 0.4, 1, 0, 0, radius * 1.3);
    fill.addColorStop(0, `hsl(${balloon.hue}, 64%, 70%)`);
    fill.addColorStop(0.65, `hsl(${balloon.hue}, 65%, 49%)`);
    fill.addColorStop(1, `hsl(${balloon.hue}, 58%, 32%)`);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.86, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.95);
    ctx.lineTo(-radius * 0.09, radius * 1.13);
    ctx.lineTo(radius * 0.09, radius * 1.13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.3, -radius * 0.35, radius * 0.12, radius * 0.24, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frame(time) {
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    ctx.clearRect(0, 0, width, height);
    const objectBounds = liftObject ? liftObject.getBoundingClientRect() : null;
    // One pressure controller and one timing result drive all five balloons.
    if (held) {
      held.airChangeIn -= dt;
      if (held.airChangeIn <= 0) {
          held.targetRate = held.baseRate * (mode.surgeMin + Math.random() * mode.surgeRange);
        held.airChangeIn = 0.18 + Math.random() * 0.25;
      }
      // Air surges change smoothly; the balloon and needle share this pressure.
      held.airRate += (held.targetRate - held.airRate) * (1 - Math.exp(-dt * 9));
      // Keep a real reaction window even when a gust and a long streak coincide.
      held.airRate = Math.min(held.airRate, held.zoneWidth / mode.reactionWindow);
      held.pressure = Math.min(1, held.pressure + held.airRate * dt);
      const result = timing(held);
      if (needle) needle.setAttribute('transform', `rotate(${result.pressure * 360} 32 32)`);
      if (pressureRing) pressureRing.setAttribute('stroke-dasharray', `${result.pressure * CIRCUMFERENCE} ${CIRCUMFERENCE}`);
      if (timingHint) timingHint.textContent = result.success ? 'RELEASE' : result.pressure > held.zoneStart + held.zoneWidth ? 'MISSED' : 'HOLD';
      if (meter) meter.dataset.state = result.success ? 'ready' : result.pressure > held.zoneStart + held.zoneWidth ? 'danger' : 'inflating';
    }
    for (let i = balloons.length - 1; i >= 0; i--) {
      const balloon = balloons[i];
      balloon.age += dt;
      if (held && balloon.group === held) {
        balloon.pressure = held.pressure;
        balloon.x = held.originX + balloon.dx;
        balloon.y = held.originY + balloon.dy;
      }
      if (balloon.state === 'inflating') {
        const progress = balloon.pressure;
        // Every sweet spot produces the same full balloon; only its timing varies.
        const fill = Math.min(progress / balloon.zoneStart, 1);
        const overfill = Math.max(0, (progress - balloon.zoneStart - balloon.zoneWidth) / (1 - balloon.zoneStart - balloon.zoneWidth));
        balloon.radius = MIN_RADIUS + (ATTACHED_RADIUS - MIN_RADIUS) * fill + (MAX_RADIUS - ATTACHED_RADIUS) * overfill;
        if (progress === 1) {
          balloon.state = 'danger';
        }
      } else if (balloon.state === 'danger') {
        // Maximum pressure bursts even if the button remains held.
        balloon.dangerAge += dt;
        if (balloon === held && balloon.dangerAge >= DANGER_GRACE_TIME) {
          for (const member of held.members) {
            member.state = 'popping';
            member.group = null;
          }
          held = null;
          window.dispatchEvent(new CustomEvent('balloon-popped'));
          if (timingHint) timingHint.textContent = 'POP';
          hideMeter(350);
          if (meter) meter.dataset.state = 'miss';
        }
      } else if (balloon.state === 'popping') {
        balloon.popAge += dt;
        if (balloon.popAge >= POP_TIME) {
          burst(balloon);
          balloons.splice(i, 1);
          continue;
        }
      } else if (balloon.state === 'deflating') {
        balloon.radius *= Math.exp(-dt * 4);
        balloon.x += Math.sin(balloon.age * 28) * 45 * dt;
        balloon.y += 45 * dt;
        if (balloon.radius < 2) {
          balloons.splice(i, 1);
          continue;
        }
      } else if (balloon.state === 'attached') {
        // Tethers use the object's live position, including its lift animation.
        const anchorX = objectBounds.left + objectBounds.width * 0.5;
        const anchorY = objectBounds.top + objectBounds.height * Number(liftObject.dataset.attachY || 0.24);
        // A dense, layered bouquet rather than a tall grid of individual balloons.
        const angle = balloon.slot * 2.3999632297;
        const spread = Math.sqrt(balloon.slot);
        const targetX = anchorX + Math.cos(angle) * spread * Math.min(22, width * 0.048) + Math.sin(balloon.age * 1.6 + balloon.phase) * 2;
        const targetY = anchorY - 65 - spread * 15 + Math.sin(angle) * spread * 10;
        balloon.attachAge += dt;
        const travel = Math.min(balloon.attachAge / 0.55, 1);
        const ease = 1 - Math.pow(1 - travel, 3);
        balloon.x = balloon.releaseX + (targetX - balloon.releaseX) * ease;
        balloon.y = balloon.releaseY + (targetY - balloon.releaseY) * ease;
        ctx.strokeStyle = 'rgba(65, 70, 75, 0.65)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(balloon.x, balloon.y + balloon.radius * 1.1);
        ctx.lineTo(anchorX, anchorY);
        ctx.stroke();
      } else {
        balloon.y -= balloon.speed * dt;
        balloon.x += (balloon.drift + Math.sin(balloon.age * 1.6 + balloon.phase) * 5) * dt;
        if (balloon.y + balloon.radius * 1.85 < 0) {
          balloons.splice(i, 1);
          continue;
        }
      }
      drawBalloon(balloon);
    }
    updateBirds(dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      ctx.fillStyle = `hsla(${particle.hue}, 85%, 60%, ${particle.life / 0.35})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
