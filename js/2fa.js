// --- 2FA AUTHENTICATOR MODULE ---
const TwoFA = {
  publicKeys: [],
  privateKeys: [],
  privateUnlocked: false,
  sheetsUrl: '',
  isAddingPrivate: false,
  timerInterval: null,
  latestCodes: {},

  init() {
    this.loadKeys();
    this.bindEvents();
    this.startTimer();
  },

  loadKeys() {
    // 1. Load public keys
    const savedPublic = localStorage.getItem('azera-2fa-public');
    if (savedPublic) {
      try {
        this.publicKeys = JSON.parse(savedPublic);
      } catch (e) {
        console.error("Failed to parse public keys:", e);
      }
    }

    // 2. Load Google Sheets URL
    this.sheetsUrl = localStorage.getItem('azera-2fa-sheets-url') || '';
    document.getElementById('sheets-url-input').value = this.sheetsUrl;
  },

  bindEvents() {
    // Tab switching
    const tabPublic = document.getElementById('btn-2fa-tab-public');
    const tabPrivate = document.getElementById('btn-2fa-tab-private');
    const panelPublic = document.getElementById('panel-2fa-public');
    const panelPrivateGate = document.getElementById('panel-2fa-private-gate');
    const panelPrivateContent = document.getElementById('panel-2fa-private-content');

    tabPublic.addEventListener('click', () => {
      SoundManager.play('click-low');
      tabPublic.classList.add('active');
      tabPrivate.classList.remove('active');
      panelPublic.classList.remove('hidden');
      panelPrivateGate.classList.add('hidden');
      panelPrivateContent.classList.add('hidden');
    });

    tabPrivate.addEventListener('click', () => {
      SoundManager.play('click-low');
      tabPublic.classList.remove('active');
      tabPrivate.classList.add('active');
      panelPublic.classList.add('hidden');
      
      if (this.privateUnlocked) {
        panelPrivateContent.classList.remove('hidden');
      } else {
        panelPrivateGate.classList.remove('hidden');
        document.getElementById('otp-private-password').focus();
      }
    });

    // Private unlock
    document.getElementById('btn-unlock-private').addEventListener('click', () => {
      this.handlePrivateUnlock();
    });

    document.getElementById('otp-private-password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handlePrivateUnlock();
      }
    });

    // Add OTP dialog actions
    document.getElementById('btn-add-otp-public').addEventListener('click', () => {
      SoundManager.play('click');
      this.isAddingPrivate = false;
      document.getElementById('add-otp-title').textContent = 'Add 2FA Account';
      document.getElementById('otp-add-label').value = '';
      document.getElementById('otp-add-secret').value = '';
      document.getElementById('win-add-otp').classList.remove('hidden');
      WindowManager.focusWindow('win-add-otp');
    });

    document.getElementById('btn-add-otp-private').addEventListener('click', () => {
      SoundManager.play('click');
      this.isAddingPrivate = true;
      document.getElementById('add-otp-title').textContent = 'Add Private 2FA (Syncs to Google Sheets)';
      document.getElementById('otp-add-label').value = '';
      document.getElementById('otp-add-secret').value = '';
      document.getElementById('win-add-otp').classList.remove('hidden');
      WindowManager.focusWindow('win-add-otp');
    });

    document.getElementById('btn-save-new-otp').addEventListener('click', () => {
      this.saveNewOTP();
    });

    document.getElementById('btn-cancel-new-otp').addEventListener('click', () => {
      SoundManager.play('click');
      document.getElementById('win-add-otp').classList.add('hidden');
    });

    // Google Sheets Settings dialog triggers
    document.getElementById('btn-config-sheets').addEventListener('click', () => {
      SoundManager.play('click');
      document.getElementById('sheets-url-input').value = localStorage.getItem('azera-2fa-sheets-url') || '';
      document.getElementById('win-sheets-config').classList.remove('hidden');
      WindowManager.focusWindow('win-sheets-config');
    });

    document.getElementById('btn-save-sheets-config').addEventListener('click', () => {
      SoundManager.play('click');
      const inputVal = document.getElementById('sheets-url-input').value.trim();
      localStorage.setItem('azera-2fa-sheets-url', inputVal);
      this.sheetsUrl = inputVal;
      document.getElementById('win-sheets-config').classList.add('hidden');
      if (this.privateUnlocked) {
        this.syncPrivateKeys();
      }
    });

    document.getElementById('btn-cancel-sheets-config').addEventListener('click', () => {
      SoundManager.play('click');
      document.getElementById('win-sheets-config').classList.add('hidden');
    });

    // Sync button
    document.getElementById('btn-sync-private').addEventListener('click', () => {
      SoundManager.play('click');
      this.syncPrivateKeys();
    });
  },

  handlePrivateUnlock() {
    const passwordInput = document.getElementById('otp-private-password');
    const password = passwordInput.value;

    if (password === 'rausyani') {
      SoundManager.play('boot');
      this.privateUnlocked = true;
      passwordInput.value = '';
      document.getElementById('panel-2fa-private-gate').classList.add('hidden');
      document.getElementById('panel-2fa-private-content').classList.remove('hidden');
      
      // Load keys
      this.syncPrivateKeys();
    } else {
      SoundManager.play('error');
      // Shake input or show red border
      passwordInput.style.borderColor = '#ff3333';
      setTimeout(() => {
        passwordInput.style.borderColor = '';
      }, 1000);
    }
  },

  async syncPrivateKeys() {
    const statusText = document.getElementById('otp-status-text');
    
    if (!this.sheetsUrl) {
      statusText.textContent = 'Google Sheets URL not configured!';
      alert('Please configure Google Sheets URL first by clicking "⚙️ Sheets Setup"');
      return;
    }

    statusText.textContent = 'Syncing keys from Google Sheet...';

    try {
      // Fetch data
      const response = await fetch(this.sheetsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawData = await response.json();
      
      // Decrypt secret keys using password "rausyani"
      this.privateKeys = rawData.map(item => {
        return {
          id: item.created_at || Math.random().toString(),
          name: item.name,
          secret: xorDecrypt(item.secret, 'rausyani')
        };
      }).filter(item => item.secret !== ''); // Filter out decryption failures

      statusText.textContent = `Sync Success. Found ${this.privateKeys.length} keys.`;
      this.renderList(true);
    } catch (e) {
      SoundManager.play('error');
      statusText.textContent = `Sync Error: ${e.message}`;
      console.error(e);
    }
  },

  async saveNewOTP() {
    const label = document.getElementById('otp-add-label').value.trim();
    const secret = document.getElementById('otp-add-secret').value.trim().replace(/\s/g, '');

    if (!label || !secret) {
      SoundManager.play('error');
      alert('Please fill out both Label and Secret Key!');
      return;
    }

    // Basic Base32 Validation
    if (!/^[A-Z2-7]+=*$/i.test(secret)) {
      SoundManager.play('error');
      alert('Secret key must be a valid Base32 string (letters A-Z and numbers 2-7).');
      return;
    }

    SoundManager.play('click');
    document.getElementById('win-add-otp').classList.add('hidden');

    if (this.isAddingPrivate) {
      // Save to private (Google Sheet)
      const statusText = document.getElementById('otp-status-text');
      if (!this.sheetsUrl) {
        alert('Sheets URL not set! Cannot upload private key.');
        return;
      }

      statusText.textContent = 'Uploading private key to Sheets...';
      
      // Encrypt secret with "rausyani"
      const encryptedSecret = xorEncrypt(secret, 'rausyani');
      
      try {
        // Post data as text/plain to bypass preflight OPTIONS CORS issue on Apps Script
        const response = await fetch(this.sheetsUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            name: label,
            secret: encryptedSecret
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        statusText.textContent = 'Key saved to Sheets.';
        // Reload
        this.syncPrivateKeys();
      } catch (e) {
        SoundManager.play('error');
        statusText.textContent = `Upload failed: ${e.message}`;
        alert(`Failed to save private key: ${e.message}`);
      }

    } else {
      // Save to public (LocalStorage)
      const newKey = {
        id: crypto.randomUUID(),
        name: label,
        secret: secret
      };
      
      this.publicKeys.push(newKey);
      localStorage.setItem('azera-2fa-public', JSON.stringify(this.publicKeys));
      this.renderList(false);
    }
  },

  deleteKey(id, isPrivate) {
    if (isPrivate) {
      alert("Private key deletion must be done directly in your Google Sheet spreadsheet!");
      return;
    }

    if (confirm("Delete this 2FA account?")) {
      SoundManager.play('click');
      this.publicKeys = this.publicKeys.filter(item => item.id !== id);
      localStorage.setItem('azera-2fa-public', JSON.stringify(this.publicKeys));
      this.renderList(false);
    }
  },

  async renderList(isPrivate) {
    const listId = isPrivate ? 'otp-list-private' : 'otp-list-public';
    const container = document.getElementById(listId);
    if (!container) return;

    container.innerHTML = '';
    const keys = isPrivate ? this.privateKeys : this.publicKeys;

    if (keys.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 20px; font-style:italic; color: var(--win-border-dark);">
          No accounts found. Click Add to insert a new 2FA key.
        </div>
      `;
      return;
    }

    for (let key of keys) {
      const card = document.createElement('div');
      card.className = 'otp-card';
      
      const otpCode = await generateTOTP(key.secret);
      this.latestCodes[key.id] = otpCode; // cache code

      card.innerHTML = `
        <div class="otp-info">
          <span class="otp-label">${key.name}</span>
          <span class="otp-code-display" id="code-${key.id}">${otpCode.substring(0,3)} ${otpCode.substring(3)}</span>
        </div>
        <div class="otp-controls">
          <div class="otp-progress-bar-container">
            <div class="otp-progress-bar-fill" id="progress-${key.id}"></div>
          </div>
          <button class="retro-btn-sm" onclick="TwoFA.copyCode('${key.id}', this)">Copy</button>
          ${!isPrivate ? `<button class="retro-btn-sm btn-danger" onclick="TwoFA.deleteKey('${key.id}', false)">Delete</button>` : ''}
        </div>
      `;

      container.appendChild(card);
    }
    
    this.updateProgressBars();
  },

  copyCode(id, button) {
    const code = this.latestCodes[id];
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
      SoundManager.play('click');
      const oldText = button.textContent;
      button.textContent = 'Copied!';
      button.disabled = true;
      setTimeout(() => {
        button.textContent = oldText;
        button.disabled = false;
      }, 1500);
    });
  },

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.updateProgressBars();
    }, 1000);
  },

  async updateProgressBars() {
    const epoch = Math.round(Date.now() / 1000);
    const remainingSeconds = 30 - (epoch % 30);
    const progressPercent = (remainingSeconds / 30) * 100;
    
    // Update timer text in status bar
    const timerText = document.getElementById('otp-timer-text');
    if (timerText) {
      timerText.textContent = `New Code in: ${remainingSeconds}s`;
    }

    // Update progress bar elements
    const keys = [...this.publicKeys, ...(this.privateUnlocked ? this.privateKeys : [])];
    
    for (let key of keys) {
      const fillEl = document.getElementById(`progress-${key.id}`);
      if (fillEl) {
        fillEl.style.width = `${progressPercent}%`;
        
        // Color transition
        if (remainingSeconds <= 5) {
          fillEl.style.backgroundColor = '#ff3333'; // Red warning
        } else if (remainingSeconds <= 10) {
          fillEl.style.backgroundColor = '#ffaa00'; // Yellow warning
        } else {
          fillEl.style.backgroundColor = document.body.className.includes('theme-classic') ? '#008000' : '#33ff33';
        }
      }

      // Recalculate codes if interval restarts
      if (remainingSeconds === 30) {
        const codeEl = document.getElementById(`code-${key.id}`);
        if (codeEl) {
          const newCode = await generateTOTP(key.secret);
          this.latestCodes[key.id] = newCode;
          codeEl.textContent = `${newCode.substring(0,3)} ${newCode.substring(3)}`;
        }
      }
    }
    
    // Initial renders
    const pubContainer = document.getElementById('otp-list-public');
    if (pubContainer && pubContainer.children.length === 0 && this.publicKeys.length > 0) {
      this.renderList(false);
    }
  }
};

// --- CRYPTO TOTP ALGORITHM ---
function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let bytes = [];

  base32 = base32.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");

  for (let char of base32) {
    let val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function generateTOTP(secretBase32) {
  try {
    const secretBytes = base32ToBytes(secretBase32);
    if (secretBytes.length === 0) return "000000";

    const epoch = Math.round(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    
    // Prepare 8-byte big-endian buffer
    const buffer = new ArrayBuffer(8);
    const dataView = new DataView(buffer);
    dataView.setUint32(4, counter);
    
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: { name: "SHA-1" } },
      false,
      ["sign"]
    );
    
    const signature = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      buffer
    );
    
    const hmac = new Uint8Array(signature);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
      
    return (code % 1000000).toString().padStart(6, "0");
  } catch (e) {
    console.error("TOTP generation error:", e);
    return "000000";
  }
}

// --- XOR SYNC OBFUSCATION ---
function xorEncrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function xorDecrypt(encodedText, key) {
  try {
    const text = atob(encodedText);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    return '';
  }
}
