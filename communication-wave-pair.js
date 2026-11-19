(() => {
  const field = document.createElement('canvas');
  const pen = field.getContext('2d');
  if (!pen) return;
  field.className = 'communication-field';
  field.setAttribute('aria-hidden', 'true');
  // Keep one perspective space behind the foreground; stars and relays tilt together.
  const space = document.createElement('div');
  const drift = new URLSearchParams(location.search).get('drift') ?? document.currentScript?.dataset.defaultDrift;
  const boldDrift = drift === 'bold';
  const followsPage = drift === 'follow';
  const nodeBrightness = followsPage && new URLSearchParams(location.search).get('nodes') !== 'original' ? 1.10 : 1;
  const spherical = followsPage || drift === 'orbital';
  space.className = 'communication-space' + (spherical ? ' is-orbital' : boldDrift ? ' is-bold' : '');
  space.setAttribute('aria-hidden', 'true');
  const style = document.createElement('style');
  style.textContent = `
    .communication-space {
      position:fixed; inset:0; z-index:0; overflow:hidden;
      pointer-events:none; perspective:1200px; perspective-origin:50% 50%;
      --orbital-progress:0;
    }
    .communication-space > .communication-field {
      position:absolute; inset:-8%; width:116%; height:116%;
      transform-origin:50% 50%; backface-visibility:hidden;
      transform:rotateX(calc((var(--orbital-progress) - .5) * -6deg))
        rotateY(calc((var(--orbital-progress) - .5) * 4deg))
        scale(calc(1.025 + var(--orbital-progress) * .025));
      will-change:transform;
    }
    .communication-space.is-bold > .communication-field {
      inset:-28%; width:156%; height:156%;
      transform:rotateX(calc((var(--orbital-progress) - .5) * -36deg))
        rotateY(calc((var(--orbital-progress) - .5) * 28deg))
        scale(calc(1.06 + var(--orbital-progress) * .14));
    }
    .communication-space.is-orbital > .communication-field {
      inset:0; width:100%; height:100%; transform:none; will-change:auto;
    }
    html.orbital-study { height:auto; }
    html.orbital-study body { height:640vh; }
    @media(prefers-reduced-motion:reduce) {
      .communication-space > .communication-field, .communication-space.is-bold > .communication-field { transform:none; will-change:auto; }
    }
  `;
  if (spherical && location.pathname.includes('constellation-preview')) {
    document.documentElement.classList.add('orbital-study');
  }
  document.head.append(style);
  space.append(field);
  document.body.prepend(space);

  const variant = new URLSearchParams(location.search).get('field');
  const crossing = !variant || variant === 'relay';
  const curved = variant === 'arcs';
  const textured = curved || crossing || variant === 'traces';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = {x: 0, y: 0, targetX: 0, targetY: 0};
  const orbit = {current:0, target:0, dirty:true};
  function updateOrbit(immediate = false) {
    if (orbit.dirty) {
      const page = document.scrollingElement || document.documentElement;
      const travel = Math.max(0, page.scrollHeight - page.clientHeight);
      if (spherical) {
        // Negative rotation lifts the visible shell as the page content rises.
        const radiansPerViewport = followsPage ? -.32 : .96;
        orbit.target = page.scrollTop / Math.max(1, page.clientHeight) * radiansPerViewport;
      } else orbit.target = boldDrift
        ? .5 + .5 * Math.sin(page.scrollTop / Math.max(1, page.clientHeight * 1.15))
        : travel ? Math.min(1, Math.max(0, page.scrollTop / travel)) : 0;
      orbit.dirty = false;
    }
    // A sub-unit gain eases the orbital response instead of sliding with the page.
    if (spherical) {
      // Wrap long section jumps onto the shortest arc. Scroll never queues extra turns.
      const difference = orbit.target - orbit.current;
      orbit.current = immediate ? orbit.target :
        orbit.current + Math.atan2(Math.sin(difference), Math.cos(difference)) * .27;
      return;
    }
    orbit.current = immediate ? orbit.target : orbit.current + (orbit.target - orbit.current) * .075;
    space.style.setProperty('--orbital-progress', orbit.current.toFixed(5));
  }
  window.addEventListener('scroll', () => { orbit.dirty = true; }, {passive:true});
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { orbit.dirty = true; }).observe(document.body);
  }
  let seed = 493;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const makeNode = () => ({
    x: random(), y: random(), phase: random() * 2 * Math.PI,
    radius: .55 + random() * .7, light: .15 + random() * .23
  });
  const stars = Array.from({length: 36}, makeNode);
  const nodes = Array.from({length: 34}, makeNode);
  const tracks = textured ? [
    [-.19,.21,1.14,.79], [-.15,.87,1.11,.22], [.21,-.14,.73,1.16],
    [-.1,.55,.83,-.12], [.47,1.13,1.12,.36], [.1,1.08,1.22,.5],
    [.02,-.16,.48,1.18]
  ].map(([x1,y1,x2,y2],i) => ({
    x1,y1,x2,y2,phase:random()*Math.PI*2,
    bend:curved ? (i % 2 ? -.16 : .18) : (i % 2 ? -.018 : .022),
    beads:Array.from({length:32},(_,j) => ({
      t:(j+random()*.8)/32,
      radius:.58+random()*.66,
      light:.075+random()*.245,
      offset:(random()-.5)*3.2
    }))
  })) : [];
  // Orbital elements describe points on tilted circles around the reader.
  // Lanes share an orbital plane. Relays keep their IDs as the view turns.
  function shellPoint(phase, tilt, bearing, speed, radius, light) {
    return {phase, speed, radius, light, tiltSin:Math.sin(tilt), tiltCos:Math.cos(tilt),
      bearingSin:Math.sin(bearing), bearingCos:Math.cos(bearing)};
  }
  const shellNodes = [];
  const shellDust = [];
  if (spherical) {
    for (let i = 0; i < 480; i++) {
      shellNodes.push(shellPoint(random()*2*Math.PI, Math.acos(2*random()-1),
        random()*2*Math.PI, .009 + random()*.008, .65+random()*.68, .18+random()*.21));
    }
    for (let lane = 0; lane < 14; lane++) {
      const tilt = Math.acos(2*random()-1);
      const bearing = random()*2*Math.PI;
      const speed = .005 + random()*.009;
      for (let cluster = 0; cluster < 6; cluster++) {
        const start = random()*2*Math.PI;
        const spacing = .007 + random()*.018;
        for (let bead = 0; bead < 12; bead++) {
          shellDust.push(shellPoint(start+(bead+random()*.6)*spacing,
            tilt+(random()-.5)*.008, bearing, speed, .48+random()*.53, .09+random()*.16));
        }
      }
    }
  }

  function shellView(seconds) {
    const angle = (reduced.matches ? 0 : orbit.current) + seconds*.002;
    const focal = Math.sqrt(width*height)*.69;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Incline the scroll axis so paths sweep diagonally past the foreground.
    const axisX = .91, axisY = Math.sqrt(1-axisX*axisX);
    return body => {
      const phase = body.phase + seconds*body.speed;
      const along = Math.cos(phase), across = Math.sin(phase)*body.tiltCos;
      const x = along*body.bearingCos - across*body.bearingSin;
      const y = along*body.bearingSin + across*body.bearingCos;
      const z = Math.sin(phase)*body.tiltSin;
      const parallel = axisX*x + axisY*y;
      const normal = -axisY*x + axisX*y;
      const rotated = normal*cos + z*sin;
      const depth = z*cos - normal*sin;
      if (depth < .15) return null;
      const scale = focal/depth;
      return {x:width*.5+(parallel*axisX-rotated*axisY)*scale+pointer.x,
        y:height*.5+(parallel*axisY+rotated*axisX)*scale+pointer.y};
    };
  }

  function drawShell(seconds) {
    const project = shellView(seconds);
    const visible = (p) => p && p.x >= -2 && p.y >= -2 && p.x <= width+2 && p.y <= height+2;
    for (const body of shellDust) {
      const p = project(body);
      if (visible(p)) point(p.x,p.y,body.radius,'rgba(151,166,202,'+body.light+')');
    }
    const points = shellNodes.map(project);
    points.forEach((p,i) => {
      const node = shellNodes[i];
      if (visible(p)) point(p.x,p.y,node.radius,'rgba(158,177,225,'+(node.light*nodeBrightness)+')');
    });
    if (reduced.matches) return;
    if (!relay && time >= nextSignal) startCrossing(points);
    if (relay) drawRelay(points);
  }

  const fadingLinks = new Map();
  let width, height, count, columns, frame;
  let time = 0, previous = 0, nextSignal = 500;
  let relay;
  let direction = 1;
  const usedEndpoints = new Set();
  const lastEndpoints = new Set();

  function point(x, y, radius, color) {
    pen.fillStyle = color;
    pen.beginPath();
    pen.arc(x, y, radius, 0, Math.PI * 2);
    pen.fill();
  }

  function line(from, to, color, weight) {
    pen.strokeStyle = color;
    pen.lineWidth = weight;
    pen.beginPath();
    pen.moveTo(from.x, from.y);
    pen.lineTo(to.x, to.y);
    pen.stroke();
  }

  function drawTracks(seconds) {
    const trackCount = width < 600 ? 4 : tracks.length;
    for (const track of tracks.slice(0,trackCount)) {
      const pace = seconds * .012;
      const lengthX = (track.x2-track.x1) * width;
      const lengthY = (track.y2-track.y1) * height;
      const length = Math.hypot(lengthX,lengthY);
      const normalX = -lengthY / length;
      const normalY = lengthX / length;
      const bend = track.bend * Math.min(width,height);
      const sway = Math.sin(track.phase+seconds*.10) * 12;
      for (const bead of track.beads) {
        const t = (bead.t+pace) % 1;
        const grouping = .55 + .45 * Math.sin(t*27+track.phase) ** 2;
        const wave = Math.sin(Math.PI*t) * (bend+sway) + bead.offset;
        const light = bead.light * grouping;
        point(track.x1*width+lengthX*t+normalX*wave+pointer.x*.34,
          track.y1*height+lengthY*t+normalY*wave+pointer.y*.34,
          bead.radius,'rgba(152,169,210,'+light+')');
      }
    }
  }

  function nodePosition(node, index, seconds) {
    const rows = Math.ceil(count / columns);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const slots = Math.min(columns, count - row * columns);
    const eddyX = textured ? Math.sin(node.phase*1.7 + seconds*.29) * 19 : 0;
    const eddyY = textured ? Math.cos(node.phase*1.6 + seconds*.24) * 17 : 0;
    return {
      x: (column + .13 + node.x * .74) * width / slots
        + Math.sin(seconds * .15 + node.phase) * 28 + pointer.x + eddyX,
      y: (row + .14 + node.y * .72) * height / rows
        + Math.cos(seconds * .13 + node.phase) * 22 + pointer.y + eddyY,
      radius: node.radius,
      light: node.light
    };
  }

  function findLinks(points) {
    const reach = textured
      ? Math.min(325,Math.max(136,Math.hypot(width,height)*.212))
      : Math.min(244,Math.max(122,Math.hypot(width,height)*.17));
    const pairs = [];
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        const distance = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
        if (distance < reach) pairs.push({a, b, distance});
      }
    }
    const degree = new Uint8Array(points.length);
    const links = [];
    for (const pair of pairs.sort((a,b) => a.distance - b.distance)) {
      if (degree[pair.a] >= 3 || degree[pair.b] >= 3) continue;
      degree[pair.a]++;
      degree[pair.b]++;
      links.push(pair);
      const key = pair.a * nodes.length + pair.b;
      const entry = fadingLinks.get(key) ?? {a:pair.a, b:pair.b, alpha:0};
      entry.target = .19 * Math.pow(1 - pair.distance / reach, .8);
      fadingLinks.set(key, entry);
    }
    return links;
  }

  function drawLinks(points) {
    for (const [key, link] of fadingLinks) {
      link.alpha = reduced.matches ? link.target : link.alpha + (link.target - link.alpha) * .11;
      if (link.alpha > .002) {
        const tint = textured ? '97,115,214' : '128,145,196';
        line(points[link.a],points[link.b],'rgba('+tint+','+link.alpha+')',textured ? .72 : .8);
      } else if (link.target === 0) {
        fadingLinks.delete(key);
      }
      link.target = 0;
    }
  }

  function startRelay(points, links) {
    if (!links.length) return;
    const first = time < 1200;
    const candidates = first ? links.filter(({a,b}) => Math.max(points[a].y,points[b].y) < height * .31) : links;
    const pool = candidates.length ? candidates : links;
    const pair = pool[Math.floor(random() * pool.length)];
    let {a,b} = pair;
    const center = width * .5;
    if (Math.abs(points[a].x - center) < Math.abs(points[b].x - center)) [a,b] = [b,a];

    const neighbors = node => links.flatMap(link =>
      link.a === node ? [link.b] : link.b === node ? [link.a] : []);
    const next = neighbors(b).filter(node => node !== a);
    const via = next[Math.floor(random() * next.length)];
    const legs = [{from:a,to:b,delay:0,length:1080,weight:1}];
    if (via !== undefined) {
      legs.push({from:b,to:via,delay:1040,length:910,weight:.8});
      const branches = neighbors(via).filter(node => node !== a && node !== b).slice(0,2);
      branches.forEach((to, i) => legs.push({from:via,to,delay:1910+i*100,length:970,weight:.68-i*.14}));
    }
    relay = {start:time, legs, duration:Math.max(...legs.map(leg => leg.delay + leg.length)) + 560};
  }

  function chooseEndpoint(candidates, score) {
    const fresh = candidates.filter(index => !usedEndpoints.has(index));
    if (!fresh.length) {
      for (const index of candidates) usedEndpoints.delete(index);
    }
    const pool = fresh.length ? fresh : candidates;
    return pool.reduce((best, index) => score(index) > score(best) ? index : best);
  }

  function buildCrossing(points, excluded, first) {
    const progress = p => direction > 0 ? p.x / width : 1 - p.x / width;
    const visible = points.map((_,i) => i).filter(i => {
      if (!points[i]) return false;
      const {x,y} = points[i];
      return x > 3 && x < width - 3 && y > 3 && y < height - 3;
    });
    // Sort the visible stars from the sending edge to the receiving edge.
    visible.sort((a,b) => progress(points[a]) - progress(points[b]));
    const bandSize = Math.min(Math.floor(visible.length / 2), Math.max(6, Math.ceil(visible.length * .21)));
    if (bandSize < 2) return;
    const origins = visible.slice(0,bandSize).filter(i => !excluded.has(i));
    const destinations = visible.slice(-bandSize).filter(i => !excluded.has(i));
    if (!origins.length || !destinations.length) return;
    const variety = points.map(() => random());
    const from = chooseEndpoint(origins, i => variety[i] +
      (first ? Math.abs(points[i].y-points[first.from].y) / height * 2 : 0));
    const distance = (a,b) => Math.hypot(points[a].x-points[b].x, points[a].y-points[b].y);
    const to = chooseEndpoint(destinations, i => distance(from,i) + variety[i] * width * .16);
    const start = progress(points[from]);
    const finish = progress(points[to]);
    const bend = (random() - .5) * Math.min(height * .58, width * .37);
    const legs = [];
    let current = from;
    let delay = 0;
    while (current !== to) {
      const step = progress(points[current]);
      const candidates = visible.filter(i => {
        const x = progress(points[i]);
        return x > step + .065 && x < finish - .07;
      });
      const targetX = Math.min(step + .18, finish);
      const score = i => {
        const x = progress(points[i]);
        const t = (x - start) / Math.max(.01, finish - start);
        const centerY = points[from].y + (points[to].y-points[from].y) * t + Math.sin(Math.PI*t) * bend;
        return Math.abs(x-targetX) * width * 1.8 + Math.abs(points[i].y-centerY) * .55
          + (first?.routeNodes.has(i) ? Math.min(width,height) * .25 : 0)
          + distance(current,i) * .34 + variety[i] * Math.min(width,height) * .12;
      };
      // Keep a long crossing moving through the swarm even on a narrow screen.
      const choices = finish - step > .25 && candidates.length ? candidates : [...candidates,to];
      const next = lowestScore(choices, score);
      const length = Math.min(1250, Math.max(450, distance(current,next) * 3.1));
      legs.push({from:current,to:next,delay,length,weight:1});
      delay += length;
      current = next;
    }
    const routeNodes = new Set([from, ...legs.map(leg => leg.to)]);
    const branches = [];
    const reach = Math.min(215, Math.max(95, Math.hypot(width,height) * .17));
    for (const [index, leg] of legs.entries()) {
      if (index % 2 && variety[leg.to] < .55) continue;
      const neighbors = visible.filter(i => !routeNodes.has(i) && distance(leg.to,i) < reach);
      if (!neighbors.length) continue;
      const next = lowestScore(neighbors, i => distance(leg.to,i) * (.7 + variety[i] * .5));
      routeNodes.add(next);
      const length = 390 + 310 * distance(leg.to,next) / reach;
      branches.push({from:leg.to,to:next,delay:leg.delay+leg.length+85,length,weight:.44});
    }
    const waves = [...branches,...legs];
    return {from,to,routeNodes,legs:waves,duration:Math.max(...waves.map(leg => leg.delay+leg.length)) + 1050};
  }

  function startCrossing(points) {
    const excluded = new Set(lastEndpoints);
    const first = buildCrossing(points,excluded);
    if (!first) return;
    excluded.add(first.from);
    excluded.add(first.to);
    const second = buildCrossing(points,excluded,first);
    if (!second) return;
    lastEndpoints.clear();
    for (const route of [first,second]) {
      for (const node of [route.from,route.to]) {
        usedEndpoints.add(node);
        lastEndpoints.add(node);
      }
    }
    direction *= -1;
    relay = {start:time,legs:[...first.legs,...second.legs],duration:Math.max(first.duration,second.duration)};
  }

  function lowestScore(candidates, score) {
    return candidates.reduce((best,index) => score(index) < score(best) ? index : best);
  }

  function drawWave(from, to, age, leg) {
    const afterglow = 500 + 550 * leg.weight;
    const fade = Math.max(0, 1 - Math.max(0, age-leg.length) / afterglow);
    if (!fade) return;
    const head = Math.min(1, age / leg.length);
    const at = t => ({x:from.x + (to.x-from.x)*t, y:from.y + (to.y-from.y)*t});
    const tip = at(head);
    if (head > 0) {
      line(from,tip,'rgba(64,76,202,' + .19 * leg.weight * fade ** 2 + ')',.62);
      const tail = at(Math.max(0,head-.47));
      const glow = pen.createLinearGradient(tail.x,tail.y,tip.x,tip.y);
      glow.addColorStop(0,'rgba(64,76,202,0)');
      glow.addColorStop(1,'rgba(83,99,231,' + .47 * leg.weight * fade ** 3 + ')');
      line(tail,tip,glow,.82);
    }
    if (leg.delay === 0 && age < 390) {
      point(from.x,from.y,1.35,'rgba(104,125,230,' + (1-age/390) * .44 + ')');
    }
    point(tip.x,tip.y,1.15,'rgba(117,140,237,' + .57 * leg.weight * fade ** 2 + ')');
  }

  function drawRelay(points) {
    const elapsed = time - relay.start;
    if (elapsed >= relay.duration) {
      relay = undefined;
      nextSignal = time + (crossing ? 2000 + random() * 2000 : 4500 + random() * 3800);
      return;
    }
    for (const leg of relay.legs) {
      const age = elapsed - leg.delay;
      if (age < 0) continue;
      const from = points[leg.from];
      const to = points[leg.to];
      if (!from || !to) continue;
      if (spherical || crossing) {
        drawWave(from,to,age,leg);
        continue;
      }
      if (age >= leg.length) {
        const flash = Math.max(0, 1 - (age - leg.length) / 560);
        if (flash) point(to.x,to.y,1.5,'rgba(143,166,255,' + flash * leg.weight * .36 + ')');
        continue;
      }
      const progress = age / leg.length;
      const at = t => ({x:from.x + (to.x-from.x)*t, y:from.y + (to.y-from.y)*t});
      const tip = at(progress);
      if (progress > 0) {
        const tail = at(Math.max(0, progress - .3));
        const trace = pen.createLinearGradient(tail.x,tail.y,tip.x,tip.y);
        trace.addColorStop(0,'rgba(102,126,240,0)');
        trace.addColorStop(1,'rgba(102,126,240,' + .32 * leg.weight + ')');
        line(tail,tip,trace,1);
      }
      point(tip.x,tip.y,1.15,'rgba(167,188,255,' + .52 * leg.weight + ')');
    }
  }

  function draw() {
    pen.clearRect(0, 0, width, height);
    const seconds = reduced.matches ? 0 : time / 1000;
    if (spherical) return drawShell(seconds);
    const starCount = width < 600 ? 20 : stars.length;
    stars.slice(0,starCount).forEach(star => {
      const drift = Math.sin(seconds * .07 + star.phase) * 3;
      const orbit = seconds * .10 + star.phase;
      const orbitX = crossing ? Math.cos(orbit) * 10 + Math.sin(orbit) * 4 : 0;
      const orbitY = crossing ? Math.cos(orbit) * 4 - Math.sin(orbit) * 6 : 0;
      point(star.x*width + pointer.x*.23 + orbitX,star.y*height + pointer.y*.23 + drift + orbitY,
        star.radius*.66,'rgba(151,172,214,' + star.light*.53 + ')');
    });
    if (textured) drawTracks(seconds);
    const points = nodes.slice(0,count).map((node,index) => nodePosition(node,index,seconds));
    const links = crossing ? [] : findLinks(points);
    if (!crossing) drawLinks(points);
    points.forEach(p => point(p.x,p.y,p.radius,'rgba(159,177,226,' + p.light + ')'));

    if (reduced.matches) return;
    if (!relay && time >= nextSignal) {
      if (crossing) startCrossing(points);
      else startRelay(points,links);
    }
    if (relay) drawRelay(points);
  }

  function resize() {
    orbit.dirty = true;
    updateOrbit(true);
    width = field.clientWidth;
    height = field.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    field.width = Math.max(1, Math.round(width * pixelRatio));
    field.height = Math.max(1, Math.round(height * pixelRatio));
    pen.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    count = width < 600 ? 21 : nodes.length;
    columns = Math.max(3, Math.min(9, Math.round(Math.sqrt(count * width / Math.max(1,height)))));
    fadingLinks.clear();
    relay = undefined;
    draw();
  }

  function animate(now) {
    frame = requestAnimationFrame(animate);
    if (previous && now - previous < 32) return;
    time += previous ? Math.min(70, now - previous) : 0;
    previous = now;
    updateOrbit();
    pointer.x += (pointer.targetX - pointer.x) * .085;
    pointer.y += (pointer.targetY - pointer.y) * .085;
    draw();
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    previous = 0;
    if (document.hidden) return;
    orbit.dirty = true;
    updateOrbit(true);
    if (reduced.matches) {
      pointer.x = pointer.y = 0;
      draw();
    } else {
      frame = requestAnimationFrame(animate);
    }
  }

  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    pointer.targetX = (event.clientX / width - .5) * 12;
    pointer.targetY = (event.clientY / height - .5) * 12;
  }, {passive:true});
  document.addEventListener('pointerleave', () => {
    pointer.targetX = pointer.targetY = 0;
  });
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',updateMotion);
  reduced.addEventListener('change',updateMotion);
  resize();
  updateMotion();
})();
