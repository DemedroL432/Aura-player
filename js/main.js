/* ============================================================
   AURA PLAYER — landing scripts
   ============================================================ */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     1. WebGL fluid aura background (simplex noise, like the app)
     ------------------------------------------------------------ */
  const VS = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const FS = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_bass;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform vec3 u_color3;
    uniform vec3 u_color4;
    varying vec2 vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec2 res = max(u_resolution.xy, vec2(100.0, 100.0));
      vec2 st = gl_FragCoord.xy / res;
      float t = u_time * 0.16;

      vec2 q = vec2(0.0);
      q.x = snoise(st + vec2(t * 0.4, t * 0.2));
      q.y = snoise(st + vec2(t * 0.3, -t * 0.5));

      vec2 r = vec2(0.0);
      r.x = snoise(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * t);
      r.y = snoise(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * t);

      float f = snoise(st + r);

      vec3 col = mix(u_color1, u_color2, clamp((f*f)*4.0, 0.0, 1.0));
      col = mix(col, u_color3, clamp(length(q), 0.0, 1.0));
      col = mix(col, u_color4, clamp(length(r.x), 0.0, 1.0));
      col += u_bass * 0.22 * u_color2;

      float dist = distance(st, vec2(0.5));
      col *= smoothstep(0.95, 0.12, dist * 0.62);
      col = mix(col, vec3(0.028, 0.032, 0.055), 0.5);

      gl_FragColor = vec4(col, 0.92);
    }
  `;

  function initAuraCanvas() {
    const canvas = document.getElementById('aura-canvas');
    if (!canvas) return;

    let gl = null;
    let raf = 0;
    let startTime = performance.now();
    let target = [
      [0.486, 0.361, 1.0],
      [0.878, 0.239, 0.604],
      [0.133, 0.827, 0.933],
      [0.09, 0.11, 0.24]
    ];
    let current = target.map((c) => c.slice());
    let pointerBass = 0;

    function setup() {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'high-performance' });
      if (!gl) return false;

      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          gl.deleteShader(sh);
          return null;
        }
        return sh;
      };

      const vs = compile(gl.VERTEX_SHADER, VS);
      const fs = compile(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return false;

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);

      const posLoc = gl.getAttribLocation(program, 'position');
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      const U = {
        res: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        bass: gl.getUniformLocation(program, 'u_bass'),
        c1: gl.getUniformLocation(program, 'u_color1'),
        c2: gl.getUniformLocation(program, 'u_color2'),
        c3: gl.getUniformLocation(program, 'u_color3'),
        c4: gl.getUniformLocation(program, 'u_color4')
      };

      function resize() {
        const w = Math.floor(Math.max(320, window.innerWidth));
        const h = Math.floor(Math.max(320, window.innerHeight));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }
      }
      resize();
      window.addEventListener('resize', resize);

      function render(now) {
        if (!gl) return;
        const t = (now - startTime) / 1000;

        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 3; j++) {
            current[i][j] += (target[i][j] - current[i][j]) * 0.04;
          }
        }
        pointerBass *= 0.94;

        gl.uniform2f(U.res, canvas.width, canvas.height);
        gl.uniform1f(U.time, t);
        gl.uniform1f(U.bass, pointerBass);
        gl.uniform3fv(U.c1, current[0]);
        gl.uniform3fv(U.c2, current[1]);
        gl.uniform3fv(U.c3, current[2]);
        gl.uniform3fv(U.c4, current[3]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        raf = requestAnimationFrame(render);
      }
      raf = requestAnimationFrame(render);

      // Aura reacts to pointer movement — like it reacts to bass in the app
      window.addEventListener('pointermove', (e) => {
        pointerBass = Math.min(1, pointerBass + 0.06 + Math.abs(e.movementX || 0) * 0.002);
      }, { passive: true });

      return true;
    }

    if (!reduceMotion) setup();

    // Expose palette control for the demo section
    window.__auraSetPalette = function (palette) {
      if (!palette) return;
      target = palette.map((c) => c.slice());
    };
  }

  /* ------------------------------------------------------------
     2. Navigation
     ------------------------------------------------------------ */
  function initNav() {
    const nav = document.getElementById('nav');
    const burger = document.getElementById('navBurger');
    const links = document.getElementById('navLinks');
    const navAnchors = Array.from(links ? links.querySelectorAll('a') : []);
    const sections = ['hero', 'features', 'demo', 'interface', 'gallery', 'stack', 'download', 'faq']
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const onScroll = () => {
      if (!nav) return;
      nav.classList.toggle('is-stuck', window.scrollY > 24);

      const y = window.scrollY + window.innerHeight * 0.35;
      let currentId = 'hero';
      sections.forEach((sec) => {
        if (sec.offsetTop <= y) currentId = sec.id;
      });
      navAnchors.forEach((a) => {
        a.classList.toggle('is-current', a.getAttribute('href') === '#' + currentId);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (burger && links) {
      burger.addEventListener('click', () => {
        const open = links.classList.toggle('is-open');
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('is-locked', open && window.innerWidth <= 860);
      });

      links.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          links.classList.remove('is-open');
          burger.classList.remove('is-open');
          burger.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('is-locked');
        }
      });
    }
  }

  /* ------------------------------------------------------------
     3. Reveal on scroll
     ------------------------------------------------------------ */
  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = Number(el.dataset.delay || 0);
        el.style.setProperty('--d', String(delay));
        el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------
     4. Counters
     ------------------------------------------------------------ */
  function initCounters() {
    const nums = document.querySelectorAll('[data-count]');
    if (!nums.length) return;

    const animate = (el) => {
      const end = Number(el.dataset.count || 0);
      const suffix = el.dataset.suffix || '';
      const dur = 1300;
      const t0 = performance.now();

      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased) + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (!('IntersectionObserver' in window)) {
      nums.forEach(animate);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    nums.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------
     5. Tilt effect for cards
     ------------------------------------------------------------ */
  function initTilt() {
    if (reduceMotion || window.matchMedia('(hover: none)').matches) return;
    document.querySelectorAll('.tilt').forEach((card) => {
      let rect = null;

      card.addEventListener('pointerenter', () => { rect = card.getBoundingClientRect(); });
      card.addEventListener('pointermove', (e) => {
        if (!rect) rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateY(' + (px * 5).toFixed(2) + 'deg) rotateX(' + (-py * 5).toFixed(2) + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', () => {
        rect = null;
        card.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------
     6. Marquee — duplicate content for a seamless loop
     ------------------------------------------------------------ */
  function initMarquee() {
    const track = document.getElementById('marqueeTrack');
    if (!track) return;
    track.innerHTML = track.innerHTML + track.innerHTML;
  }

  /* ------------------------------------------------------------
     7. Hero app micro-interactions (spectrum + play toggle)
     ------------------------------------------------------------ */
  function initHeroApp() {
    const bars = document.getElementById('heroBars');
    if (bars) {
      for (let i = 0; i < 14; i++) {
        const b = document.createElement('i');
        b.style.animationDelay = (i * 0.09).toFixed(2) + 's';
        b.style.animationDuration = (0.75 + (i % 5) * 0.13).toFixed(2) + 's';
        bars.appendChild(b);
      }
    }

    const playBtn = document.getElementById('heroPlayBtn');
    const orbPlay = document.getElementById('heroOrbPlay');
    const fill = document.getElementById('heroFill');
    const timeCur = document.getElementById('heroTimeCur');
    if (!playBtn || !fill) return;

    let playing = true;
    let pos = 42;
    const total = 243; // 4:03

    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    };

    const apply = () => {
      fill.style.width = ((pos / total) * 100).toFixed(1) + '%';
      if (timeCur) timeCur.textContent = fmt(pos);
    };

    const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    const iconPause = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

    const toggle = () => {
      playing = !playing;
      playBtn.innerHTML = playing ? iconPause : icon;
      if (orbPlay) orbPlay.innerHTML = playing ? iconPause : icon;
      if (bars) bars.style.animationPlayState = playing ? 'running' : 'paused';
      Array.from(bars ? bars.children : []).forEach((b) => {
        b.style.animationPlayState = playing ? 'running' : 'paused';
      });
    };

    playBtn.addEventListener('click', toggle);
    if (orbPlay) orbPlay.addEventListener('click', toggle);

    setInterval(() => {
      if (!playing) return;
      pos = (pos + 0.4) % total;
      apply();
    }, 1000);

    apply();
  }

  /* ------------------------------------------------------------
     8. Demo player
     ------------------------------------------------------------ */
  const TRACKS = [
    { title: 'Midnight City', artist: 'M83', album: "Hurry Up, We're Dreaming", source: 'youtube', c1: '#ff2e88', c2: '#7a5cff', dur: 243, palette: [[0.5,0.36,1],[0.88,0.24,0.6],[0.13,0.83,0.93],[0.09,0.11,0.24]] },
    { title: 'Metamorphosis', artist: 'Interworld', album: 'Metamorphosis', source: 'soundcloud', c1: '#a855f7', c2: '#22d3ee', dur: 232, palette: [[0.66,0.33,0.97],[0.13,0.83,0.93],[0.42,0.2,0.85],[0.08,0.1,0.22]] },
    { title: 'In the End', artist: 'Linkin Park', album: 'Hybrid Theory', source: 'deezer', c1: '#ff4d6d', c2: '#ff9e00', dur: 216, palette: [[1,0.3,0.43],[1,0.62,0],[0.7,0.2,0.35],[0.12,0.09,0.16]] },
    { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', source: 'vk', c1: '#5b6bff', c2: '#c04bff', dur: 200, palette: [[0.36,0.42,1],[0.75,0.29,1],[0.24,0.5,1],[0.08,0.1,0.22]] },
    { title: 'Nightcall', artist: 'Kavinsky', album: 'OutRun', source: 'itunes', c1: '#00c2ff', c2: '#6a5cff', dur: 258, palette: [[0,0.76,1],[0.42,0.36,1],[0.1,0.5,0.8],[0.06,0.09,0.2]] },
    { title: 'Лесник', artist: 'Король и Шут', album: 'Король и Шут', source: 'yandex', c1: '#a3e635', c2: '#0ea5e9', dur: 187, palette: [[0.64,0.9,0.21],[0.05,0.65,0.91],[0.35,0.7,0.3],[0.07,0.11,0.14]] }
  ];

  function initDemo() {
    const root = document.getElementById('demoPlayer');
    if (!root) return;

    const cover = document.getElementById('demoCover');
    const aura = document.getElementById('demoAura');
    const elTitle = document.getElementById('demoTitle');
    const elArtist = document.getElementById('demoArtist');
    const elSource = document.getElementById('demoSource');
    const elCur = document.getElementById('demoCur');
    const elDur = document.getElementById('demoDur');
    const fill = document.getElementById('demoProgressFill');
    const knob = document.getElementById('demoProgressKnob');
    const progress = document.getElementById('demoProgress');
    const playBtn = document.getElementById('demoPlay');
    const nextBtn = document.getElementById('demoNext');
    const prevBtn = document.getElementById('demoPrev');
    const shuffleBtn = document.getElementById('demoShuffle');
    const likeBtn = document.getElementById('demoLike');
    const list = document.getElementById('demoList');
    const vis = document.getElementById('demoVisualizer');

    let index = 0;
    let playing = true;
    let position = 72;
    let shuffle = false;
    let liked = new Set([0]);

    // Build the visualizer bars
    const barCount = 42;
    const barEls = [];
    if (vis) {
      for (let i = 0; i < barCount; i++) {
        const b = document.createElement('i');
        vis.appendChild(b);
        barEls.push(b);
      }
    }

    // Build the playlist
    TRACKS.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'demo__item';
      btn.setAttribute('role', 'listitem');
      btn.innerHTML =
        '<span class="demo__item-art" style="--c1:' + t.c1 + ';--c2:' + t.c2 + '"></span>' +
        '<span class="demo__item-meta"><strong>' + t.title + '</strong><span>' + t.artist + '</span></span>' +
        '<span class="demo__item-src">' + t.source + '</span>';
      btn.addEventListener('click', () => {
        index = i;
        position = 0;
        render();
        setPlaying(true);
      });
      list.appendChild(btn);
    });

    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    };

    function render() {
      const t = TRACKS[index];
      elTitle.textContent = t.title;
      elArtist.textContent = t.artist + ' · ' + t.album;
      elSource.textContent = t.source;
      elDur.textContent = fmt(t.dur);

      cover.style.background = 'linear-gradient(140deg,' + t.c1 + ',' + t.c2 + ')';
      if (aura) {
        aura.style.background =
          'radial-gradient(circle at 45% 42%,' + hexA(t.c1, 0.6) + ', transparent 58%),' +
          'radial-gradient(circle at 72% 70%,' + hexA(t.c2, 0.5) + ', transparent 55%)';
      }
      if (window.__auraSetPalette) window.__auraSetPalette(t.palette);

      if (likeBtn) likeBtn.classList.toggle('is-liked', liked.has(index));

      Array.from(list.children).forEach((el, i) => el.classList.toggle('is-current', i === index));
      updateProgress();
    }

    function updateProgress() {
      const t = TRACKS[index];
      const pct = Math.min(100, (position / t.dur) * 100);
      fill.style.width = pct + '%';
      if (knob) knob.style.left = pct + '%';
      elCur.textContent = fmt(position);
      if (progress) progress.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    function setPlaying(v) {
      playing = v;
      playBtn.classList.toggle('is-playing', v);
      cover.classList.toggle('is-playing', v);
      playBtn.setAttribute('aria-label', v ? 'Пауза' : 'Воспроизведение');
      if (vis) {
        barEls.forEach((b) => { b.style.height = v ? '' : '10%'; });
        vis.style.opacity = v ? '0.85' : '0.4';
      }
    }

    function go(delta) {
      if (shuffle) {
        let n = index;
        while (TRACKS.length > 1 && n === index) n = Math.floor(Math.random() * TRACKS.length);
        index = n;
      } else {
        index = (index + delta + TRACKS.length) % TRACKS.length;
      }
      position = 0;
      render();
    }

    playBtn.addEventListener('click', () => setPlaying(!playing));
    nextBtn.addEventListener('click', () => go(1));
    prevBtn.addEventListener('click', () => {
      if (position > 3) { position = 0; updateProgress(); }
      else go(-1);
    });

    shuffleBtn.addEventListener('click', () => {
      shuffle = !shuffle;
      shuffleBtn.classList.toggle('is-on', shuffle);
      shuffleBtn.setAttribute('aria-pressed', String(shuffle));
    });

    likeBtn.addEventListener('click', () => {
      if (liked.has(index)) liked.delete(index); else liked.add(index);
      likeBtn.classList.toggle('is-liked', liked.has(index));
    });

    const seekFromEvent = (e) => {
      const rect = progress.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      position = Math.max(0, Math.min(1, x / rect.width)) * TRACKS[index].dur;
      updateProgress();
    };
    progress.addEventListener('pointerdown', (e) => {
      seekFromEvent(e);
      const move = (ev) => seekFromEvent(ev);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    progress.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { position = Math.min(TRACKS[index].dur, position + 5); updateProgress(); }
      if (e.key === 'ArrowLeft') { position = Math.max(0, position - 5); updateProgress(); }
    });

    // Animate position + visualizer
    let last = performance.now();
    function tick(now) {
      const dt = (now - last) / 1000;
      last = now;

      if (playing) {
        position += dt;
        if (position >= TRACKS[index].dur) {
          position = 0;
          go(1);
        } else {
          updateProgress();
        }
      }

      if (barEls.length) {
        const energy = playing ? 1 : 0.18;
        barEls.forEach((b, i) => {
          const wave = Math.sin(now / 190 + i * 0.55) * 0.5 + 0.5;
          const wave2 = Math.sin(now / 430 + i * 0.21) * 0.5 + 0.5;
          const h = 8 + (wave * 0.62 + wave2 * 0.38) * 84 * energy;
          b.style.height = h.toFixed(1) + '%';
          b.style.opacity = (0.35 + energy * 0.6).toFixed(2);
        });
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    render();
    setPlaying(!reduceMotion);
  }

  function hexA(hex, alpha) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  /* ------------------------------------------------------------
     9. Interface tabs
     ------------------------------------------------------------ */
  function initTabs() {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const screens = Array.from(document.querySelectorAll('.screen'));
    if (!tabs.length || !screens.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        screens.forEach((s) => s.classList.toggle('is-active', s.dataset.screen === tab.dataset.screen));
      });
    });
  }

  /* ------------------------------------------------------------
     10. Chain status text cycling (USL demo)
     ------------------------------------------------------------ */
  function initChainStatus() {
    const el = document.getElementById('chainStatus');
    if (!el) return;
    const variants = [
      'YouTube — поток найден за 0.4 с',
      'SoundCloud не ответил — переключение на YouTube',
      'Ссылка протухла — поток переразрешён из RAM-кэша',
      'Deezer отдал полную версию вместо превью'
    ];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % variants.length;
      el.textContent = variants[i];
    }, 3800);
  }

  /* ------------------------------------------------------------
     11. Misc
     ------------------------------------------------------------ */
  function initMisc() {
    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    // Download button feedback
    const dl = document.getElementById('downloadBtn');
    if (dl) {
      dl.addEventListener('click', () => {
        const size = document.getElementById('downloadSize');
        if (!size) return;
        const original = size.textContent;
        size.textContent = 'Загрузка началась ✓';
        setTimeout(() => { size.textContent = original; }, 3200);
      });
    }
  }

  /* ------------------------------------------------------------
     12. Screenshot lightbox
     ------------------------------------------------------------ */
  function initLightbox() {
    const box = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    const cap = document.getElementById('lightboxCaption');
    const closeBtn = document.getElementById('lightboxClose');
    if (!box || !img) return;

    const shots = Array.from(document.querySelectorAll('.shot'));

    const open = (shot) => {
      img.src = shot.dataset.full || '';
      img.alt = shot.querySelector('img')?.alt || '';
      if (cap) cap.textContent = shot.dataset.caption || '';
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
      if (closeBtn) closeBtn.focus();
    };

    const close = () => {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-locked');
    };

    shots.forEach((shot) => shot.addEventListener('click', () => open(shot)));
    if (closeBtn) closeBtn.addEventListener('click', close);
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && box.classList.contains('is-open')) close();
    });
  }

  function boot() {
    initAuraCanvas();
    initNav();
    initReveal();
    initCounters();
    initTilt();
    initMarquee();
    initHeroApp();
    initDemo();
    initTabs();
    initChainStatus();
    initLightbox();
    initMisc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
