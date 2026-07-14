// --- LINK LIST MODULE FOR AZERA OS ---
const LinkList = {
  links: [],
  sheetsUrl: '',
  settingsUnlocked: false,
  editingLinkId: null,

  init() {
    this.loadSettings();
    this.bindEvents();
    this.fetchLinks();
  },

  loadSettings() {
    this.sheetsUrl = localStorage.getItem('azera-links-sheets-url') || 'https://script.google.com/macros/s/AKfycbzko-5LEMLCQV9YzbScYgN_w4CJ2KYpQFwY2AURPSgX8RJuHgHA_1KpVB4P-FNvG7L5ng/exec';
    
    const inputUrl = document.getElementById('links-sheets-url-input');
    if (inputUrl) {
      inputUrl.value = this.sheetsUrl;
    }
  },

  bindEvents() {
    // Open Settings Click
    const btnSettings = document.getElementById('btn-links-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        SoundManager.play('click');
        this.openSettingsFlow();
      });
    }

    // Close / Exit Settings Click
    const btnExitSettings = document.getElementById('btn-links-exit-settings');
    if (btnExitSettings) {
      btnExitSettings.addEventListener('click', () => {
        SoundManager.play('click-low');
        this.lockSettings();
      });
    }

    // Unlock Password Click
    const btnUnlock = document.getElementById('btn-links-unlock');
    if (btnUnlock) {
      btnUnlock.addEventListener('click', () => {
        this.handleUnlock();
      });
    }

    const inputPass = document.getElementById('links-password-input');
    if (inputPass) {
      inputPass.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleUnlock();
        }
      });
    }

    // Save Setup Sheet URL Click
    const btnSaveSetup = document.getElementById('btn-links-save-setup');
    if (btnSaveSetup) {
      btnSaveSetup.addEventListener('click', () => {
        SoundManager.play('click');
        const inputUrl = document.getElementById('links-sheets-url-input').value.trim();
        if (inputUrl) {
          localStorage.setItem('azera-links-sheets-url', inputUrl);
          this.sheetsUrl = inputUrl;
          alert('Sheets URL updated successfully!');
          this.fetchLinks();
        }
      });
    }

    // Save New/Edited Link Form Submission
    const btnSaveLink = document.getElementById('btn-links-save-link');
    if (btnSaveLink) {
      btnSaveLink.addEventListener('click', () => {
        this.handleSaveLink();
      });
    }

    // Cancel Edit Mode
    const btnCancelEdit = document.getElementById('btn-links-cancel-edit');
    if (btnCancelEdit) {
      btnCancelEdit.addEventListener('click', () => {
        SoundManager.play('click-low');
        this.resetLinkForm();
      });
    }

    // Sync button
    const btnSync = document.getElementById('btn-links-sync');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        SoundManager.play('click');
        this.fetchLinks();
      });
    }
  },

  async fetchLinks() {
    const statusText = document.getElementById('links-status-text');
    if (statusText) statusText.textContent = 'Fetching links...';

    const container = document.getElementById('links-container');
    if (!container) return;

    if (!this.sheetsUrl) {
      if (statusText) statusText.textContent = 'Google Sheet URL not configured!';
      container.innerHTML = `<div class="retro-error-box">Google Sheet URL not configured. Click Settings to set up.</div>`;
      return;
    }

    try {
      const response = await fetch(this.sheetsUrl);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const rawData = await response.json();
      
      if (rawData.error) throw new Error(rawData.error);

      // Save list
      this.links = rawData.map(item => ({
        id: item.id,
        name: item.name,
        url: item.url, // maps to url in the dedicated links sheet
        createdAt: item.created_at
      }));

      if (statusText) statusText.textContent = `Sync Success. Loaded ${this.links.length} links.`;
      
      this.renderMainList();
      if (this.settingsUnlocked) {
        this.renderSettingsList();
      }
    } catch (err) {
      console.error('Failed to fetch links:', err);
      SoundManager.play('error');
      if (statusText) statusText.textContent = `Sync Error: ${err.message}`;
      container.innerHTML = `<div class="retro-error-box">Sync Error: ${err.message}</div>`;
    }
  },

  renderMainList() {
    const container = document.getElementById('links-container');
    if (!container) return;

    if (this.links.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; font-style:italic; color:var(--win-border-dark);">
          No links found. Please open Settings and add some links!
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'links-grid';

    this.links.forEach(link => {
      // Ensure url starts with http:// or https://
      let formattedUrl = link.url;
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const card = document.createElement('a');
      card.href = formattedUrl;
      card.target = '_blank';
      card.className = 'link-card retro-btn';
      
      // Try to construct a nice favicon url or fallback to general link icon
      let domain = '';
      try {
        domain = new URL(formattedUrl).hostname;
      } catch(e) {}

      card.innerHTML = `
        <div class="link-card-content">
          <img class="link-icon" src="https://www.google.com/s2/favicons?sz=32&domain=${domain}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23000080%22><path d=%22M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z%22/></svg>';" />
          <div class="link-details">
            <span class="link-title">${link.name}</span>
            <span class="link-url-text">${domain || link.url}</span>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        SoundManager.play('click');
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);
  },

  renderSettingsList() {
    const listEl = document.getElementById('links-settings-list');
    if (!listEl) return;

    if (this.links.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; font-style:italic; padding:10px;">No links saved. Add a link above.</div>';
      return;
    }

    listEl.innerHTML = '';
    
    // Create retro-styled list layout
    this.links.forEach(link => {
      const row = document.createElement('div');
      row.className = 'links-settings-row';
      row.innerHTML = `
        <div class="links-row-details">
          <strong>${link.name}</strong>
          <span class="text-xs text-muted" style="display:block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${link.url}</span>
        </div>
        <div class="links-row-actions">
          <button class="retro-btn-sm" onclick="LinkList.startEdit('${link.id}')">Edit</button>
          <button class="retro-btn-sm btn-danger" onclick="LinkList.handleDelete('${link.id}')">Delete</button>
        </div>
      `;
      listEl.appendChild(row);
    });
  },

  openSettingsFlow() {
    // Show password gate or settings content
    const panelMain = document.getElementById('links-panel-main');
    const panelGate = document.getElementById('links-panel-gate');
    const panelSettings = document.getElementById('links-panel-settings');

    panelMain.classList.add('hidden');
    
    if (this.settingsUnlocked) {
      panelSettings.classList.remove('hidden');
      this.renderSettingsList();
    } else {
      panelGate.classList.remove('hidden');
      const inputPass = document.getElementById('links-password-input');
      if (inputPass) {
        inputPass.value = '';
        inputPass.focus();
      }
    }
  },

  handleUnlock() {
    const inputPass = document.getElementById('links-password-input');
    if (!inputPass) return;

    if (inputPass.value === 'rausyani') {
      SoundManager.play('boot');
      this.settingsUnlocked = true;
      
      const panelGate = document.getElementById('links-panel-gate');
      const panelSettings = document.getElementById('links-panel-settings');
      
      panelGate.classList.add('hidden');
      panelSettings.classList.remove('hidden');
      
      this.renderSettingsList();
    } else {
      SoundManager.play('error');
      inputPass.style.borderColor = '#ff3333';
      setTimeout(() => {
        inputPass.style.borderColor = '';
      }, 1000);
    }
  },

  lockSettings() {
    this.settingsUnlocked = false;
    
    const panelMain = document.getElementById('links-panel-main');
    const panelGate = document.getElementById('links-panel-gate');
    const panelSettings = document.getElementById('links-panel-settings');

    panelMain.classList.remove('hidden');
    panelGate.classList.add('hidden');
    panelSettings.classList.add('hidden');
    
    this.resetLinkForm();
  },

  async handleSaveLink() {
    const inputName = document.getElementById('link-form-name');
    const inputUrl = document.getElementById('link-form-url');
    
    const name = inputName.value.trim();
    const urlVal = inputUrl.value.trim();

    if (!name || !urlVal) {
      SoundManager.play('error');
      alert('Please fill out both Title and URL!');
      return;
    }

    SoundManager.play('click');
    const statusText = document.getElementById('links-status-text');
    if (statusText) statusText.textContent = 'Saving link to Google Sheet...';

    const isEdit = this.editingLinkId !== null;
    const payload = {
      action: isEdit ? 'update' : 'add',
      id: isEdit ? this.editingLinkId : crypto.randomUUID(),
      name: name,
      url: urlVal
    };

    try {
      const response = await fetch(this.sheetsUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || 'Server error');

      if (statusText) statusText.textContent = isEdit ? 'Link updated successfully.' : 'Link added successfully.';
      
      this.resetLinkForm();
      this.fetchLinks();
    } catch (e) {
      console.error(e);
      SoundManager.play('error');
      alert(`Failed to save link: ${e.message}`);
      if (statusText) statusText.textContent = `Save failed: ${e.message}`;
    }
  },

  startEdit(id) {
    SoundManager.play('click');
    const link = this.links.find(item => item.id === id);
    if (!link) return;

    this.editingLinkId = id;
    
    document.getElementById('link-form-name').value = link.name;
    document.getElementById('link-form-url').value = link.url;
    
    document.getElementById('btn-links-save-link').textContent = 'Update Link';
    document.getElementById('btn-links-cancel-edit').classList.remove('hidden');
  },

  async handleDelete(id) {
    if (!confirm('Are you sure you want to delete this link?')) return;

    SoundManager.play('click');
    const statusText = document.getElementById('links-status-text');
    if (statusText) statusText.textContent = 'Deleting link...';

    const payload = {
      action: 'delete',
      id: id
    };

    try {
      const response = await fetch(this.sheetsUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || 'Server error');

      if (statusText) statusText.textContent = 'Link deleted successfully.';
      this.fetchLinks();
    } catch (e) {
      console.error(e);
      SoundManager.play('error');
      alert(`Failed to delete link: ${e.message}`);
      if (statusText) statusText.textContent = `Delete failed: ${e.message}`;
    }
  },

  resetLinkForm() {
    this.editingLinkId = null;
    document.getElementById('link-form-name').value = '';
    document.getElementById('link-form-url').value = '';
    
    document.getElementById('btn-links-save-link').textContent = 'Add Link';
    document.getElementById('btn-links-cancel-edit').classList.add('hidden');
  }
};
