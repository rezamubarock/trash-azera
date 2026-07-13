// --- TRASH MAIL MODULE ---
const TrashMail = {
  apiEndpoint: 'https://api.azera.biz.id',
  inbox: '',
  emailsList: [],
  selectedEmail: null,
  autoRefreshInterval: null,
  viewMode: 'html', // 'html' or 'text'
  isDemoMode: false,

  init() {
    this.loadConfig();
    this.bindEvents();
    
    // Load last inbox or generate a random one
    const savedInbox = localStorage.getItem('azera-trash-inbox');
    if (savedInbox) {
      this.setInbox(savedInbox);
    } else {
      this.generateRandomInbox();
    }

    this.startAutoRefresh();
  },

  loadConfig() {
    const savedEndpoint = localStorage.getItem('azera-mail-api-endpoint');
    if (savedEndpoint) {
      this.apiEndpoint = savedEndpoint.trim().replace(/\/$/, ''); // Remove trailing slash
    }
    
    // Update domain input list if they want more domains in future
    const domainSelect = document.getElementById('mail-domain');
    domainSelect.innerHTML = `<option value="azera.biz.id">@azera.biz.id</option>`;
  },

  bindEvents() {
    // Inputs & Core buttons
    document.getElementById('btn-mail-go').addEventListener('click', () => {
      SoundManager.play('click');
      const inputVal = document.getElementById('mail-username').value.trim();
      if (inputVal) {
        this.setInbox(inputVal);
      }
    });

    document.getElementById('mail-username').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        SoundManager.play('click');
        const inputVal = document.getElementById('mail-username').value.trim();
        if (inputVal) {
          this.setInbox(inputVal);
        }
      }
    });

    document.getElementById('btn-mail-random').addEventListener('click', () => {
      SoundManager.play('click');
      this.generateRandomInbox();
    });

    document.getElementById('btn-mail-refresh').addEventListener('click', () => {
      SoundManager.play('click');
      this.fetchEmails(true);
    });

    document.getElementById('btn-copy-address').addEventListener('click', () => {
      this.copyAddress();
    });

    // Auto refresh checkbox
    document.getElementById('mail-auto-refresh').addEventListener('change', (e) => {
      SoundManager.play('click');
      if (e.target.checked) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    // API configuration dialog trigger
    document.getElementById('btn-config-api').addEventListener('click', () => {
      SoundManager.play('click');
      const dialog = document.getElementById('win-api-config');
      document.getElementById('api-endpoint-input').value = localStorage.getItem('azera-mail-api-endpoint') || '';
      dialog.classList.remove('hidden');
      WindowManager.focusWindow('win-api-config');
    });

    document.getElementById('btn-save-api-config').addEventListener('click', () => {
      SoundManager.play('click');
      const inputVal = document.getElementById('api-endpoint-input').value.trim();
      if (inputVal) {
        localStorage.setItem('azera-mail-api-endpoint', inputVal);
      } else {
        localStorage.removeItem('azera-mail-api-endpoint');
      }
      this.loadConfig();
      document.getElementById('win-api-config').classList.add('hidden');
      this.isDemoMode = false;
      this.fetchEmails(true);
    });

    document.getElementById('btn-cancel-api-config').addEventListener('click', () => {
      SoundManager.play('click');
      document.getElementById('win-api-config').classList.add('hidden');
    });

    // Reading pane view mode switches
    document.getElementById('btn-view-html').addEventListener('click', () => {
      SoundManager.play('click-low');
      this.setViewMode('html');
    });

    document.getElementById('btn-view-raw').addEventListener('click', () => {
      SoundManager.play('click-low');
      this.setViewMode('text');
    });

    document.getElementById('btn-delete-email').addEventListener('click', () => {
      if (this.selectedEmail) {
        SoundManager.play('click');
        this.deleteEmail(this.selectedEmail.id);
      }
    });
  },

  setInbox(username) {
    // Sanitize inbox name (lowercase, remove spaces & special chars)
    this.inbox = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    
    // Save preference
    localStorage.setItem('azera-trash-inbox', this.inbox);

    // Update UI elements
    document.getElementById('mail-username').value = this.inbox;
    const domain = document.getElementById('mail-domain').value;
    const fullAddress = `${this.inbox}@${domain}`;
    document.getElementById('full-mail-address').textContent = fullAddress;
    
    // Reset listing & display
    this.emailsList = [];
    this.selectedEmail = null;
    this.updateMailUI();

    // Fetch emails immediately
    this.fetchEmails(true);
    
    // Trigger mock email injection in Demo Mode if configured
    if (this.isDemoMode) {
      this.triggerDemoEmails();
    }
  },

  generateRandomInbox() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.setInbox(result);
  },

  setViewMode(mode) {
    this.viewMode = mode;
    const htmlBtn = document.getElementById('btn-view-html');
    const rawBtn = document.getElementById('btn-view-raw');
    const iframeEl = document.getElementById('mail-iframe');
    const preEl = document.getElementById('mail-text-rendered');

    if (mode === 'html') {
      htmlBtn.classList.add('active');
      rawBtn.classList.remove('active');
      iframeEl.classList.remove('hidden');
      preEl.classList.add('hidden');
    } else {
      htmlBtn.classList.remove('active');
      rawBtn.classList.add('active');
      iframeEl.classList.add('hidden');
      preEl.classList.remove('hidden');
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      this.fetchEmails(false);
    }, 10000); // Poll every 10 seconds
  },

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  },

  async fetchEmails(showLoading = false) {
    const statusText = document.getElementById('mail-status-text');
    const apiBadge = document.getElementById('mail-api-status');
    
    if (showLoading) {
      statusText.textContent = 'Checking inbox...';
    }

    // If API Endpoint is not configured or in Demo Mode, fallback
    if (this.isDemoMode || !this.apiEndpoint || this.apiEndpoint.includes('REPLACE_WITH')) {
      this.runDemoFetch();
      return;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/api/inbox?inbox=${this.inbox}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.emailsList = data;
      this.isDemoMode = false;

      // Update badge
      apiBadge.textContent = 'API Connected';
      apiBadge.className = 'status-badge badge-green';
      
      statusText.textContent = `Last checked: ${new Date().toLocaleTimeString()} (Found ${data.length} message(s))`;
      this.renderEmailsTable();

    } catch (err) {
      console.warn('API connection failed. Switching to local Demo Mode:', err.message);
      this.isDemoMode = true;
      this.runDemoFetch();
    }
  },

  renderEmailsTable() {
    const tbody = document.getElementById('mail-list-body');
    tbody.innerHTML = '';

    if (this.emailsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center" style="padding: 20px; font-style: italic; color: var(--win-border-dark);">
            Inbox empty. Waiting for emails...
          </td>
        </tr>
      `;
      return;
    }

    this.emailsList.forEach(email => {
      const tr = document.createElement('tr');
      if (this.selectedEmail && this.selectedEmail.id === email.id) {
        tr.className = 'selected';
      }

      const dateStr = this.formatTime(email.received_at);
      const senderText = email.sender_name ? `${email.sender_name} <${email.sender}>` : email.sender;

      tr.innerHTML = `
        <td title="${senderText}"><strong>${email.sender_name || email.sender.split('@')[0]}</strong></td>
        <td title="${email.subject}">${email.subject}</td>
        <td class="col-time font-mono">${dateStr}</td>
      `;

      tr.addEventListener('click', () => {
        SoundManager.play('click');
        this.selectEmail(email.id);
      });

      tbody.appendChild(tr);
    });
  },

  async selectEmail(id) {
    const statusText = document.getElementById('mail-status-text');
    statusText.textContent = 'Retrieving message content...';

    // Highlight selected row in UI
    const rows = document.querySelectorAll('#mail-list-body tr');
    const index = this.emailsList.findIndex(e => e.id === id);
    rows.forEach((row, idx) => {
      if (idx === index) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    });

    if (this.isDemoMode) {
      const email = this.emailsList.find(e => e.id === id);
      if (email) {
        this.selectedEmail = email;
        this.updateMailUI();
        statusText.textContent = 'Message loaded (Demo Mode)';
      }
      return;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/api/email?id=${id}&inbox=${this.inbox}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const fullEmail = await response.json();
      this.selectedEmail = fullEmail;
      this.updateMailUI();
      statusText.textContent = 'Message loaded.';
    } catch (err) {
      SoundManager.play('error');
      statusText.textContent = `Error loading email: ${err.message}`;
    }
  },

  updateMailUI() {
    const placeholder = document.getElementById('mail-detail-placeholder');
    const content = document.getElementById('mail-detail-content');
    
    if (!this.selectedEmail) {
      placeholder.classList.remove('hidden');
      content.classList.add('hidden');
      return;
    }

    placeholder.classList.add('hidden');
    content.classList.remove('hidden');

    // Populate Headers
    document.getElementById('detail-from').textContent = this.selectedEmail.sender_name 
      ? `${this.selectedEmail.sender_name} <${this.selectedEmail.sender}>` 
      : this.selectedEmail.sender;
    document.getElementById('detail-subject').textContent = this.selectedEmail.subject;
    document.getElementById('detail-date').textContent = new Date(this.selectedEmail.received_at).toLocaleString();

    // Populate rendered bodies
    const iframe = document.getElementById('mail-iframe');
    const pre = document.getElementById('mail-text-rendered');

    // Render HTML inside sandboxed iframe safely (srcdoc)
    // We add a default styling to the iframe body to look modern/clean
    const htmlBody = this.selectedEmail.body_html || `
      <html>
        <body style="font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #333; padding: 15px;">
          ${this.selectedEmail.body_text.replace(/\n/g, '<br>')}
        </body>
      </html>
    `;
    
    iframe.srcdoc = htmlBody;
    pre.textContent = this.selectedEmail.body_text || '(Empty text content)';

    // Trigger viewport resize inside iframe if needed
    iframe.onload = () => {
      // Prevent links in email from breaking parent layout (force target="_blank")
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const links = doc.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
          links[i].setAttribute('target', '_blank');
        }
      } catch (e) {
        console.warn('Sandbox policy prevented rewriting mail target anchors.');
      }
    };
  },

  async deleteEmail(id) {
    const statusText = document.getElementById('mail-status-text');
    statusText.textContent = 'Deleting message...';

    if (this.isDemoMode) {
      this.emailsList = this.emailsList.filter(e => e.id !== id);
      this.selectedEmail = null;
      this.renderEmailsTable();
      this.updateMailUI();
      statusText.textContent = 'Message deleted (Demo Mode)';
      return;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/api/email?id=${id}&inbox=${this.inbox}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.selectedEmail = null;
      this.updateMailUI();
      this.fetchEmails(true);
    } catch (err) {
      SoundManager.play('error');
      statusText.textContent = `Delete failed: ${err.message}`;
    }
  },

  copyAddress() {
    const address = document.getElementById('full-mail-address').textContent;
    navigator.clipboard.writeText(address).then(() => {
      SoundManager.play('click');
      const btn = document.getElementById('btn-copy-address');
      const oldText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = oldText;
        btn.disabled = false;
      }, 1500);
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
    });
  },

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    } else {
      const d = new Date(timestamp);
      return d.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    }
  },

  // --- DEMO FALLBACK SIMULATION ---
  runDemoFetch() {
    const apiBadge = document.getElementById('mail-api-status');
    const statusText = document.getElementById('mail-status-text');
    
    apiBadge.textContent = 'API Demo Mode';
    apiBadge.className = 'status-badge badge-red';
    
    statusText.textContent = `Demo Mode active. Last checked: ${new Date().toLocaleTimeString()}`;
    
    // If empty list, check if we should populate with starter email
    if (this.emailsList.length === 0) {
      this.triggerDemoEmails();
    } else {
      this.renderEmailsTable();
    }
  },

  triggerDemoEmails() {
    // Clear lists
    this.emailsList = [];
    this.renderEmailsTable();
    
    // Inject a welcome email after 3 seconds
    setTimeout(() => {
      if (!this.isDemoMode || this.emailsList.length > 0) return;
      
      const welcomeEmail = {
        id: 'demo-welcome-uuid',
        inbox: this.inbox,
        sender: 'admin@azera.biz.id',
        sender_name: 'Azera OS Admin',
        subject: 'Welcome to your self-hosted Trash Mail client!',
        body_text: `Welcome to Azera OS Trash Mail!\n\nThis temporary email client is currently running in DEMO mode. Because you haven't configured your API endpoint yet, we are simulating incoming messages.\n\nTo hook up your real domain and receive emails from anyone on the internet:\n1. Open the "Worker Setup" help document on the desktop.\n2. Deploy the Cloudflare Worker inside the /worker directory.\n3. Configure Cloudflare Email Routing for your domain.\n4. Save your API URL in this window by clicking the ⚙️ API button.\n\nHave fun exploring the retro tools!\n- Azera System Admin`,
        body_html: `
          <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333; padding: 20px; background-color:#fafafa;">
              <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background: linear-gradient(135deg, #7b2cbf 0%, #3a067e 100%); color: #fff; padding: 20px; text-align: center;">
                  <h1 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">Azera OS v1.0</h1>
                  <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 12px;">Temporary Mail Service System</p>
                </div>
                <div style="padding: 25px;">
                  <h2 style="margin-top: 0; color: #333; font-size: 16px;">Welcome to your self-hosted Trash Mail!</h2>
                  <p>This temporary email client is currently running in <strong>Demo Mode</strong>. We are simulating incoming messages because your custom API server is not configured yet.</p>
                  
                  <div style="background-color: #f3e8ff; border-left: 4px solid #7b2cbf; padding: 12px; margin: 20px 0; border-radius: 4px;">
                    <strong style="color: #5b11a6;">Ready to make it live?</strong><br>
                    You can receive emails from any sender in the world (like Google, Facebook, or your friends) for free on your own domain! Follow the steps in the <strong>Worker Setup</strong> app on the desktop to deploy your Cloudflare Worker and D1 Database.
                  </div>

                  <p>Once deployed, click the <strong style="background: #eee; padding: 2px 5px; border-radius: 3px;">⚙️ API</strong> configuration button in this window and paste your Cloudflare Worker URL.</p>
                  
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="font-size: 12px; color: #777; text-align: center;">Azera OS Retro Utility Suite &copy; 2026. Powered by Cloudflare Serverless.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        received_at: Date.now()
      };

      this.emailsList.push(welcomeEmail);
      if (WindowManager.windows['win-mail'].minimized === false) {
        SoundManager.play('boot'); // Play alert tone when email arrives
      }
      this.renderEmailsTable();
    }, 4000);
  }
};
