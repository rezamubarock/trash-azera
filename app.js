// --- AUDIO SYNTH ENGINE ---
const SoundManager = {
  enabled: true,
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  play(type) {
    if (!this.enabled) return;
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    switch (type) {
      case 'click':
        this.beep(880, 0.03, 'sine', 0.1);
        break;
      case 'boot':
        this.beep(950, 0.15, 'square', 0.15);
        break;
      case 'error':
        this.beep(220, 0.12, 'sawtooth', 0.2);
        setTimeout(() => this.beep(180, 0.2, 'sawtooth', 0.2), 100);
        break;
      case 'chime':
        this.playStartupChime();
        break;
      case 'click-low':
        this.beep(550, 0.02, 'triangle', 0.1);
        break;
    }
  },

  beep(freq, duration, type = 'sine', volume = 0.1) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio context not ready yet:", e);
    }
  },

  playStartupChime() {
    // Beautiful vintage 90s startup melody
    const notes = [
      { f: 261.63, d: 0.8 }, // C4
      { f: 329.63, d: 0.8 }, // E4
      { f: 392.00, d: 0.8 }, // G4
      { f: 523.25, d: 1.2 }  // C5
    ];
    
    notes.forEach((n, i) => {
      setTimeout(() => {
        this.beep(n.f, n.d, 'sine', 0.12);
        // Add a soft harmonizing secondary triangle note
        this.beep(n.f * 1.5, n.d * 0.8, 'triangle', 0.04);
      }, i * 140);
    });
  }
};

// --- WINDOW MANAGER ---
const WindowManager = {
  zIndexCounter: 150,
  windows: {},
  activeWindow: null,

  init() {
    const windowEls = document.querySelectorAll('.window');
    windowEls.forEach(win => {
      const id = win.id;
      this.windows[id] = {
        element: win,
        minimized: true,
        maximized: false,
        x: win.style.left,
        y: win.style.top,
        w: win.style.width,
        h: win.style.height
      };
      
      this.initDraggable(win);
      this.initWindowControls(win);
    });

    this.updateTaskbarTabs();
  },

  initDraggable(winEl) {
    const header = winEl.querySelector('.window-header');
    if (!header) return;

    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      // Only drag on left click, not on control buttons
      if (e.button !== 0 || e.target.classList.contains('win-btn')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      startLeft = winEl.offsetLeft;
      startTop = winEl.offsetTop;
      
      this.focusWindow(winEl.id);
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
    });

    const self = this;
    function drag(e) {
      if (!isDragging) return;
      if (self.windows[winEl.id].maximized) return; // Can't drag maximized windows

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = startLeft + dx;
      const newTop = Math.max(0, startTop + dy); // Don't drag above the viewport

      winEl.style.left = `${newLeft}px`;
      winEl.style.top = `${newTop}px`;
    }

    function stopDrag() {
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', stopDrag);
    }
  },

  initWindowControls(winEl) {
    const id = winEl.id;
    const minBtn = winEl.querySelector('[data-action="minimize"]');
    const maxBtn = winEl.querySelector('[data-action="maximize"]');
    const closeBtn = winEl.querySelector('[data-action="close"]');

    if (minBtn) minBtn.addEventListener('click', () => { SoundManager.play('click-low'); this.minimizeWindow(id); });
    if (maxBtn) maxBtn.addEventListener('click', () => { SoundManager.play('click-low'); this.toggleMaximizeWindow(id); });
    if (closeBtn) closeBtn.addEventListener('click', () => { SoundManager.play('click-low'); this.closeWindow(id); });

    // Focus window on body click
    winEl.addEventListener('mousedown', () => {
      this.focusWindow(id);
    });
  },

  openWindow(id) {
    const win = this.windows[id];
    if (!win) return;

    win.element.classList.remove('hidden');
    win.minimized = false;
    this.focusWindow(id);
    this.updateTaskbarTabs();
  },

  closeWindow(id) {
    const win = this.windows[id];
    if (!win) return;

    win.element.classList.add('hidden');
    win.minimized = true;
    
    if (this.activeWindow === id) {
      this.activeWindow = null;
    }
    this.updateTaskbarTabs();
  },

  minimizeWindow(id) {
    const win = this.windows[id];
    if (!win) return;

    win.element.classList.add('hidden');
    win.minimized = true;
    
    if (this.activeWindow === id) {
      this.activeWindow = null;
      // Focus another window if available
      const openWins = Object.keys(this.windows).filter(k => !this.windows[k].minimized);
      if (openWins.length > 0) {
        this.focusWindow(openWins[openWins.length - 1]);
      }
    }
    this.updateTaskbarTabs();
  },

  toggleMaximizeWindow(id) {
    const win = this.windows[id];
    if (!win) return;

    if (win.maximized) {
      // Restore previous size
      win.element.style.top = win.y;
      win.element.style.left = win.x;
      win.element.style.width = win.w;
      win.element.style.height = win.h;
      win.maximized = false;
    } else {
      // Backup current coordinates
      win.y = win.element.style.top;
      win.x = win.element.style.left;
      win.w = win.element.style.width;
      win.h = win.element.style.height;

      // Fit to screen
      win.element.style.top = '0px';
      win.element.style.left = '0px';
      win.element.style.width = '100%';
      win.element.style.height = 'calc(100vh - 40px)';
      win.maximized = true;
    }
  },

  focusWindow(id) {
    const win = this.windows[id];
    if (!win) return;

    // Remove active class from all windows
    Object.keys(this.windows).forEach(k => {
      this.windows[k].element.classList.remove('active');
    });

    this.zIndexCounter++;
    win.element.style.zIndex = this.zIndexCounter;
    win.element.classList.add('active');
    this.activeWindow = id;
    
    // If it was minimized, restore it
    if (win.minimized) {
      win.element.classList.remove('hidden');
      win.minimized = false;
    }
    
    this.updateTaskbarTabs();
  },

  updateTaskbarTabs() {
    const tabsContainer = document.getElementById('taskbar-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    Object.keys(this.windows).forEach(id => {
      const win = this.windows[id];
      const title = win.element.querySelector('.window-title span:last-child').textContent;
      const isVisible = !win.element.classList.contains('hidden');
      
      // If it is not hidden OR was intentionally opened, show in taskbar
      // We list all windows that are either active or currently open
      if (!win.element.classList.contains('hidden') || win.minimized === false) {
        const tab = document.createElement('button');
        tab.className = `task-tab ${this.activeWindow === id ? 'active' : ''}`;
        
        // Pick class-specific icon if possible
        const titleIcon = win.element.querySelector('.win-title-icon');
        const iconCls = titleIcon ? titleIcon.className : '';
        
        tab.innerHTML = `<span class="${iconCls}"></span> <span>${title}</span>`;
        tab.addEventListener('click', () => {
          SoundManager.play('click-low');
          if (this.activeWindow === id) {
            this.minimizeWindow(id);
          } else {
            this.focusWindow(id);
          }
        });
        
        tabsContainer.appendChild(tab);
      }
    });
  }
};

// --- BIOS BOOT SIMULATOR ---
const BiosSimulator = {
  logs: [
    { text: "AZERA BIOS v4.01, Release Date: 07/13/2026", delay: 100 },
    { text: "CPU: Intel(R) Core(TM) i9-16900KF @ 5.80GHz", delay: 150 },
    { text: "Memory Test: 65,536,256 KB OK", delay: 200 },
    { text: "Detecting primary master ... IDE Hard Disk 2.0TB", delay: 100 },
    { text: "Detecting primary slave  ... None", delay: 50 },
    { text: "Initializing Plug & Play Devices ...", delay: 150 },
    { text: "  USB Mouse detected.", delay: 50 },
    { text: "  PCI Soundcard emulator active.", delay: 80 },
    { text: "  Network Adapter (DHCP IP: 192.168.1.104) ... SUCCESS", delay: 120, class: "info" },
    { text: "Booting from IDE-0: /dev/sda1...", delay: 200 },
    { text: "Loading Azera Kernel v1.0.0-PROD ...", delay: 100 },
    { text: "[ OK ] Mounted virtual filesystem /proc", delay: 50, class: "success" },
    { text: "[ OK ] Started system logging service", delay: 50, class: "success" },
    { text: "[ OK ] Loaded network stack (CORS/HTTPS)", delay: 80, class: "success" },
    { text: "[ WARNING ] Demo email endpoint used. Configure custom server for custom domain.", delay: 100, class: "warning" },
    { text: "[ OK ] Initialized Retro Tool Library", delay: 60, class: "success" },
    { text: "Starting Desktop Server Interface...", delay: 200 }
  ],
  timeoutIds: [],

  start(onComplete) {
    const logEl = document.getElementById('bios-log');
    if (!logEl) return;

    let index = 0;
    
    // Play a boot click sound
    SoundManager.play('boot');

    const printLine = () => {
      if (index >= this.logs.length) {
        setTimeout(onComplete, 400);
        return;
      }

      const log = this.logs[index];
      const p = document.createElement('p');
      if (log.class) p.className = log.class;
      p.textContent = log.text;
      logEl.appendChild(p);
      logEl.scrollTop = logEl.scrollHeight;

      // Play sound per log line (quick short ticker)
      if (index % 2 === 0) {
        SoundManager.beep(600, 0.01, 'sine', 0.05);
      }

      index++;
      const id = setTimeout(printLine, log.delay || 100);
      this.timeoutIds.push(id);
    };

    printLine();
  },

  skip(onComplete) {
    this.timeoutIds.forEach(id => clearTimeout(id));
    onComplete();
  }
};

// --- MAIN APPLICATION INIT ---
document.addEventListener('DOMContentLoaded', () => {
  const biosScreen = document.getElementById('bios-screen');
  const desktopScreen = document.getElementById('desktop-screen');
  
  // Set up clocks, triggers, sounds
  initClock();
  initTheme();
  initAudioToggle();
  initStartMenu();

  // Initialize Window Manager
  WindowManager.init();

  // Initialize Sub-Modules
  if (typeof RetroTools !== 'undefined') RetroTools.init();
  if (typeof TrashMail !== 'undefined') TrashMail.init();

  // Boot Trigger
  let bootCompleted = false;
  
  const completeBoot = () => {
    if (bootCompleted) return;
    bootCompleted = true;
    
    biosScreen.classList.add('hidden');
    desktopScreen.classList.remove('hidden');
    
    // Play vintage startup sound
    SoundManager.play('chime');

    // Automatically open Trash Mail client and Setup Guide on startup
    setTimeout(() => {
      WindowManager.openWindow('win-help');
      WindowManager.openWindow('win-mail');
    }, 400);
  };

  // Run BIOS
  BiosSimulator.start(completeBoot);

  // Skip boot trigger (ESC or mouse click)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !bootCompleted) {
      completeBoot();
    }
  });

  biosScreen.addEventListener('click', () => {
    completeBoot();
  });

  // Desktop shortcuts event listener
  const shortcuts = document.querySelectorAll('.shortcut');
  shortcuts.forEach(shortcut => {
    shortcut.addEventListener('click', (e) => {
      SoundManager.play('click');
      const winId = shortcut.getAttribute('data-window');
      WindowManager.openWindow(winId);
    });
  });
});

// --- CLOCK WORKER ---
function initClock() {
  const clockEl = document.getElementById('tray-clock');
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toTimeString().split(' ')[0];
  };
  setInterval(update, 1000);
  update();
}

// --- THEME SELECTOR ---
function initTheme() {
  const themeBtn = document.getElementById('btn-tray-theme');
  const themeMenu = document.getElementById('theme-menu');
  const themeItems = document.querySelectorAll('.theme-item');

  themeBtn.addEventListener('click', (e) => {
    SoundManager.play('click');
    themeMenu.classList.toggle('hidden');
    e.stopPropagation();
  });

  themeItems.forEach(item => {
    item.addEventListener('click', () => {
      const theme = item.getAttribute('data-theme');
      setTheme(theme);
      themeMenu.classList.add('hidden');
    });
  });

  // Load saved theme
  const savedTheme = localStorage.getItem('azera-os-theme') || 'classic';
  setTheme(savedTheme);

  document.addEventListener('click', () => {
    themeMenu.classList.add('hidden');
  });
}

function setTheme(theme) {
  document.body.className = '';
  document.body.classList.add(`theme-${theme}`);
  
  const themeBtn = document.getElementById('btn-tray-theme');
  const labelMap = {
    classic: '🎨 Classic',
    amber: '🎨 Amber',
    green: '🎨 Green',
    synthwave: '🎨 Synth'
  };
  themeBtn.textContent = labelMap[theme] || '🎨 Theme';
  localStorage.setItem('azera-os-theme', theme);
  SoundManager.play('click');
}

// --- AUDIO TOGGLE ---
function initAudioToggle() {
  const audioBtn = document.getElementById('btn-audio-toggle');
  
  // Load preference
  const soundPref = localStorage.getItem('azera-os-sound') !== 'false';
  SoundManager.enabled = soundPref;
  audioBtn.textContent = SoundManager.enabled ? '🔊 Sound' : '🔇 Sound';

  audioBtn.addEventListener('click', () => {
    SoundManager.enabled = !SoundManager.enabled;
    localStorage.setItem('azera-os-sound', SoundManager.enabled);
    audioBtn.textContent = SoundManager.enabled ? '🔊 Sound' : '🔇 Sound';
    if (SoundManager.enabled) {
      SoundManager.play('click');
    }
  });
}

// --- START MENU LOGIC ---
function initStartMenu() {
  const startBtn = document.getElementById('btn-start');
  const startMenu = document.getElementById('start-menu');
  const startItems = document.querySelectorAll('.start-item');

  startBtn.addEventListener('click', (e) => {
    SoundManager.play('click');
    startBtn.classList.toggle('active');
    startMenu.classList.toggle('hidden');
    e.stopPropagation();
  });

  startItems.forEach(item => {
    item.addEventListener('click', () => {
      const winId = item.getAttribute('data-window');
      if (winId) {
        WindowManager.openWindow(winId);
      }
      
      startBtn.classList.remove('active');
      startMenu.classList.add('hidden');
    });
  });

  // Handle Shutdown/Restart in Start Menu
  const restartBtn = document.getElementById('start-restart');
  const shutdownBtn = document.getElementById('start-shutdown');

  restartBtn.addEventListener('click', () => {
    SoundManager.play('click');
    location.reload();
  });

  shutdownBtn.addEventListener('click', () => {
    SoundManager.play('error');
    // CRT shutdown simulation
    document.body.innerHTML = `
      <div style="background:#000; width:100vw; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; font-family:monospace; font-size:14px; position:absolute; z-index:99999;">
        <p>It is now safe to turn off your computer.</p>
        <button onclick="location.reload()" style="margin-top:20px; background:#222; color:#fff; border:1px solid #555; padding:5px 15px; cursor:pointer;">Restart OS</button>
      </div>
    `;
  });

  document.addEventListener('click', () => {
    startBtn.classList.remove('active');
    startMenu.classList.add('hidden');
  });
}
