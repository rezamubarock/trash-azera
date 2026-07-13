// --- RETRO SYSTEM UTILITY TOOLS ---
const RetroTools = {
  init() {
    this.initEncoder();
    this.initJSONBeautifier();
    this.initPassGen();
    this.initSpecs();
  },

  // 1. Base64 & URL Encoder/Decoder
  initEncoder() {
    const input = document.getElementById('encoder-input');
    const output = document.getElementById('encoder-output');
    const charCount = document.getElementById('encoder-char-count');

    const updateCharCount = () => {
      charCount.textContent = input.value.length;
    };

    input.addEventListener('input', updateCharCount);

    document.getElementById('btn-b64-encode').addEventListener('click', () => {
      SoundManager.play('click');
      try {
        output.value = btoa(unescape(encodeURIComponent(input.value)));
      } catch (e) {
        SoundManager.play('error');
        output.value = `Error encoding Base64: ${e.message}`;
      }
    });

    document.getElementById('btn-b64-decode').addEventListener('click', () => {
      SoundManager.play('click');
      try {
        output.value = decodeURIComponent(escape(atob(input.value.trim())));
      } catch (e) {
        SoundManager.play('error');
        output.value = `Error decoding Base64: Invalid string.`;
      }
    });

    document.getElementById('btn-url-encode').addEventListener('click', () => {
      SoundManager.play('click');
      try {
        output.value = encodeURIComponent(input.value);
      } catch (e) {
        SoundManager.play('error');
        output.value = `Error encoding URL: ${e.message}`;
      }
    });

    document.getElementById('btn-url-decode').addEventListener('click', () => {
      SoundManager.play('click');
      try {
        output.value = decodeURIComponent(input.value.replace(/\+/g, ' '));
      } catch (e) {
        SoundManager.play('error');
        output.value = `Error decoding URL: ${e.message}`;
      }
    });

    document.getElementById('btn-rot13').addEventListener('click', () => {
      SoundManager.play('click');
      const text = input.value;
      const rot13 = text.replace(/[a-zA-Z]/g, (c) => {
        return String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
      });
      output.value = rot13;
    });

    document.getElementById('btn-clear-encoder').addEventListener('click', () => {
      SoundManager.play('click');
      input.value = '';
      output.value = '';
      updateCharCount();
    });

    document.getElementById('btn-copy-encoder').addEventListener('click', () => {
      this.copyToClipboard(output, 'btn-copy-encoder');
    });
  },

  // 2. JSON Formatter & Minifier
  initJSONBeautifier() {
    const input = document.getElementById('json-input');
    const output = document.getElementById('json-output');
    const validationBox = document.getElementById('json-validation-box');
    const validationText = document.getElementById('json-validation-text');
    const statusLines = document.getElementById('json-status-detail');

    const updateStatus = (lines = 0) => {
      statusLines.textContent = `Lines: ${lines}`;
    };

    const processJSON = (space) => {
      const val = input.value.trim();
      if (!val) {
        setValidation('Enter some JSON to validate.', 'valid');
        output.value = '';
        updateStatus(0);
        return;
      }

      try {
        const parsed = JSON.parse(val);
        const formatted = JSON.stringify(parsed, null, space);
        output.value = formatted;
        
        const lines = formatted.split('\n').length;
        setValidation('Valid JSON syntax. Formatting complete.', 'valid');
        updateStatus(lines);
        SoundManager.play('click');
      } catch (e) {
        SoundManager.play('error');
        output.value = '';
        setValidation(`Invalid JSON: ${e.message}`, 'invalid');
        updateStatus(0);
      }
    };

    const setValidation = (message, status) => {
      validationText.textContent = message;
      if (status === 'valid') {
        validationBox.className = 'validation-status-box id-valid';
      } else {
        validationBox.className = 'validation-status-box id-invalid';
      }
    };

    document.getElementById('btn-json-beautify-2').addEventListener('click', () => {
      processJSON(2);
    });

    document.getElementById('btn-json-beautify-4').addEventListener('click', () => {
      processJSON(4);
    });

    document.getElementById('btn-json-minify').addEventListener('click', () => {
      processJSON(0); // JSON.stringify(parsed)
    });

    document.getElementById('btn-clear-json').addEventListener('click', () => {
      SoundManager.play('click');
      input.value = '';
      output.value = '';
      setValidation('Enter some JSON to validate.', 'valid');
      updateStatus(0);
    });

    document.getElementById('btn-copy-json').addEventListener('click', () => {
      this.copyToClipboard(output, 'btn-copy-json');
    });
  },

  // 3. Secure Password Generator
  initPassGen() {
    const lengthInput = document.getElementById('pass-length');
    const lengthVal = document.getElementById('pass-length-val');
    const upperInput = document.getElementById('pass-upper');
    const lowerInput = document.getElementById('pass-lower');
    const numbersInput = document.getElementById('pass-numbers');
    const symbolsInput = document.getElementById('pass-symbols');
    const passOutput = document.getElementById('pass-output');
    
    const strengthFill = document.getElementById('strength-fill');
    const strengthLabel = document.getElementById('strength-label');

    lengthInput.addEventListener('input', () => {
      lengthVal.textContent = lengthInput.value;
    });

    const generatePassword = () => {
      const length = parseInt(lengthInput.value);
      const useUpper = upperInput.checked;
      const useLower = lowerInput.checked;
      const useNumbers = numbersInput.checked;
      const useSymbols = symbolsInput.checked;

      const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
      const numberChars = '0123456789';
      const symbolChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

      let charPool = '';
      if (useUpper) charPool += upperChars;
      if (useLower) charPool += lowerChars;
      if (useNumbers) charPool += numberChars;
      if (useSymbols) charPool += symbolChars;

      if (!charPool) {
        SoundManager.play('error');
        passOutput.value = '';
        strengthFill.style.width = '0%';
        strengthFill.className = 'strength-fill strength-weak';
        strengthLabel.textContent = 'Select Options';
        return;
      }

      // Cryptographically secure random values
      let password = '';
      const array = new Uint32Array(length);
      window.crypto.getRandomValues(array);
      
      for (let i = 0; i < length; i++) {
        password += charPool.charAt(array[i] % charPool.length);
      }

      passOutput.value = password;
      updateStrength(password, useUpper, useLower, useNumbers, useSymbols);
      SoundManager.play('click');
    };

    const updateStrength = (password, hasUpper, hasLower, hasNumbers, hasSymbols) => {
      const len = password.length;
      let countTypes = 0;
      if (hasUpper) countTypes++;
      if (hasLower) countTypes++;
      if (hasNumbers) countTypes++;
      if (hasSymbols) countTypes++;

      let strength = 0;
      if (len >= 6) strength += 20;
      if (len >= 12) strength += 20;
      if (len >= 16) strength += 20;
      if (countTypes >= 2) strength += 20;
      if (countTypes >= 4) strength += 20;

      strengthFill.style.width = `${strength}%`;

      if (strength <= 40) {
        strengthFill.className = 'strength-fill strength-weak';
        strengthLabel.textContent = 'Weak';
      } else if (strength <= 60) {
        strengthFill.className = 'strength-fill strength-medium';
        strengthLabel.textContent = 'Medium';
      } else if (strength <= 80) {
        strengthFill.className = 'strength-fill strength-strong';
        strengthLabel.textContent = 'Strong';
      } else {
        strengthFill.className = 'strength-fill strength-perfect';
        strengthLabel.textContent = 'Military Grade';
      }
    };

    document.getElementById('btn-generate-pass').addEventListener('click', generatePassword);

    document.getElementById('btn-copy-pass').addEventListener('click', () => {
      this.copyToClipboard(passOutput, 'btn-copy-pass');
    });
  },

  // 4. System Diagnostics
  initSpecs() {
    const specOs = document.getElementById('spec-os');
    const specBrowser = document.getElementById('spec-browser');
    const specRes = document.getElementById('spec-resolution');
    const specViewport = document.getElementById('spec-viewport');
    const specIp = document.getElementById('spec-ip');
    const specNetwork = document.getElementById('spec-network');
    const specTime = document.getElementById('spec-time');

    // 1. Detect Operating System
    const ua = navigator.userAgent;
    let os = 'Unknown Operating System';
    if (ua.indexOf('Win') !== -1) os = 'Windows NT Kernel';
    if (ua.indexOf('Mac') !== -1) os = 'macOS Darwin';
    if (ua.indexOf('X11') !== -1) os = 'UNIX/Linux System';
    if (ua.indexOf('Linux') !== -1) os = 'Linux Core';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) os = 'Mobile OS';
    specOs.textContent = os;

    // 2. Detect Browser Engine
    let browser = 'Unknown WebKit Browser';
    if (ua.indexOf('Chrome') !== -1 && ua.indexOf('Safari') !== -1 && ua.indexOf('Edge') === -1) browser = 'Google Chrome';
    else if (ua.indexOf('Firefox') !== -1) browser = 'Mozilla Firefox';
    else if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) browser = 'Apple Safari';
    else if (ua.indexOf('Edge') !== -1) browser = 'Microsoft Edge';
    else if (ua.indexOf('MSIE') !== -1 || !!document.documentMode) browser = 'Internet Explorer';
    specBrowser.textContent = browser;

    // 3. Screen Dimensions
    specRes.textContent = `${window.screen.width} x ${window.screen.height} px`;

    // 4. Viewport Dimensions
    const updateViewport = () => {
      specViewport.textContent = `${window.innerWidth} x ${window.innerHeight} px`;
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);

    // 5. Network status
    const updateNetwork = () => {
      specNetwork.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
      specNetwork.className = navigator.onLine ? 'spec-value badge-green' : 'spec-value badge-red';
    };
    updateNetwork();
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);

    // 6. Real-time Clock on specs
    const updateTime = () => {
      const now = new Date();
      specTime.textContent = now.toTimeString();
    };
    setInterval(updateTime, 1000);
    updateTime();

    // 7. Get Client Public IP (from free public api)
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        specIp.textContent = data.ip;
      })
      .catch(() => {
        specIp.textContent = 'ERR: BLOCKED_BY_CORS';
      });
  },

  // Utility Copy helper
  copyToClipboard(element, btnId) {
    if (!element.value) return;
    
    element.select();
    element.setSelectionRange(0, 99999); // For mobile devices
    
    navigator.clipboard.writeText(element.value).then(() => {
      SoundManager.play('click');
      const btn = document.getElementById(btnId);
      const oldText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.disabled = true;
      
      setTimeout(() => {
        btn.textContent = oldText;
        btn.disabled = false;
      }, 1500);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }
};
