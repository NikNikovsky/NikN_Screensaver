// Assume loadHtml is a utility function that loads HTML content.
// For this example, we'll define a simple body.html content directly.
var htmlContent = `
    <div id="app-container" style="width: 100vw; height: 100vh; overflow: hidden; position: relative; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">
        <canvas id="flurry-canvas" style="display: block;"></canvas>
    </div>
`;

// Hardcoded obfuscated parts for secret easter egg codes.
// These parts are reassembled from character codes.
var HARDCODED_SECRET_CODE_PARTS = [
    [[99, 101, 114, 116, 105, 102, 105, 99, 97, 116, 101, 115]], // certificates
    [[109, 97, 116, 114, 105, 120]], // matrix
    [[112, 108, 101, 97, 115, 101, 114, 101, 115, 101, 116, 109, 121, 112, 97, 115, 115, 119, 111, 114, 100, 98, 101, 99, 97, 117, 115, 101, 105, 102, 111, 114, 103, 111, 114]], // pleasereetmypasswordbecauseiforgor
    [[103, 111, 111, 115, 101]] // goose
];

// Special marker to indicate that the password should be reset on next startup
var RESET_PASSWORD_MARKER = "__ARC_OS_LOCKSCREEN_RESET__";

// This class extends ThirdPartyAppProcess, which is assumed to provide
// methods like getBody(), userPreferences(), userDaemon, handler, closeWindow.
class proc extends ThirdPartyAppProcess {
    // Corrected constructor and other methods to be inside the class body
    constructor(...args) {
        super(...args);
        this._canUsePersistentHashing = false; // Determined during constructor/render
        this._localPassword = null;
        this._localPasswordHash = null;
        this._lockScreenPasswordFilePath = 'U:/Config/NikN_Screensaver/lockscreen.pwd.hash';
        // REPLACE WHEN 7.0.5 RELEASES:const configPath = 'U:/System/Config/NikN_Screensaver/lockscreen.pwd.hash'
        this._computedSecretCodeHashes = [];
        this._u = 0; // lock overlay active
        this._s = 0; // secret code overlay active
        this._l = 0; // unlocked status
        this._m = 0; // matrix effect active
        this._disposed = false;

        // --- Initial Feature Detection for Persistent Hashing ---
        try {
            if (typeof util !== 'undefined' && typeof util.sha256 === 'function' &&
                typeof convert !== 'undefined' && typeof convert.arrayToText === 'function' && typeof convert.textToBlob === 'function' &&
                this.fs && typeof this.fs.readFile === 'function' && typeof this.fs.writeFile === 'function') {

                this._canUsePersistentHashing = true;
                if (typeof this.Log === 'function') this.Log("Persistent hashing and file system operations are initially detected as available.", LogLevel.info);
            } else {
                if (typeof this.Log === 'function') this.Log("Initial check: Some core utilities for persistent hashing are not fully available. Will fall back to in-memory password storage.", LogLevel.warning);
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log("Error during initial utility check for persistent hashing: " + e.message, LogLevel.error);
            this._canUsePersistentHashing = false; // Ensure it's false on any error
        }
    }

    // Call this method after instantiating proc to perform async initialization.
    async initialize() {
        if (this._canUsePersistentHashing && this.fs && typeof this.fs.readFile === 'function') {
            try {
                const configPath = 'U:/System/Config/NikN_Screensaver/lockscreen.pwd.hash';
                const configPath = 'U:/System/Config/NikN_Screensaver/lockscreen.pwd.hash';
                const file = await this.fs.readFile(configPath);
                if (file) {
                    const text = typeof convert !== 'undefined' && typeof convert.arrayToText === 'function'
                        ? convert.arrayToText(new Uint8Array(file))
                        : new TextDecoder().decode(new Uint8Array(file));
                    if (text === RESET_PASSWORD_MARKER) {
                        this._localPasswordHash = null;
                        if (typeof this.Log === 'function') this.Log("Lock screen password reset marker found. Prompting for new password.", LogLevel.info);
                    } else {
                        this._localPasswordHash = text;
                        if (typeof this.Log === 'function') this.Log("Loaded hashed lock screen password from file.", LogLevel.info);
                    }
                } else {
                    this._localPasswordHash = null;
                }
            } catch (e) {
                if (typeof this.Log === 'function') this.Log("Failed to read lock screen password file: " + e.message, LogLevel.warning);
                this._localPasswordHash = null;
            }
        }
    }

    _getUiBody() {
        return this.getBody();
    }
    _setupEventListeners() {
        // Add a listener for the space key to show the password overlay
        this._showOverlayListener = (e) => {
            if (!this.unlocking && !this.unlocked && (e.code === 'Space' || e.key === ' ')) {
                this.showPasswordOverlay();
            }
        };
        window.addEventListener('keydown', this._showOverlayListener);

        // Register Alt+I accelerator using acceleratorStore
        this.Log(`acceleratorStore state: ${this.acceleratorStore ? 'Available' : 'Unavailable'}`, 0); // LogLevel.info
        this.Log(`Fallback listener state: ${this._secretCodeKeyListener ? 'Active' : 'Inactive'}`, 0); // LogLevel.info
        if (this.acceleratorStore && Array.isArray(this.acceleratorStore)) {
            this.acceleratorStore.push({
                alt: true,
                key: "i",
                action: (proc, event) => {
                    this.Log(`Alt+I triggered. _u: ${this._u}, _l: ${this._l}`, 0); // LogLevel.info
                    if (this._u === 0 && this._l === 0) {
                        this.showSecretCodeInputOverlay();
                    } else {
                        this.Log("Alt+I conditions not met. Menu not opened.", 1); // LogLevel.warning
                    }
                },
                global: true
            });
            this.Log("Registered Alt+I keyboard shortcut via acceleratorStore.", 0); // LogLevel.info
        } else {
            this.Log("acceleratorStore not available or not an array. Alt+I shortcut will not be registered.", 1); // LogLevel.warning
            this._secretCodeKeyListener = (e) => {
                this.Log(`Alt+I keydown event. _u: ${this._u}, _l: ${this._l}`, 0); // LogLevel.info
                if (this._u === 0 && this._l === 0 && e.altKey && e.key === 'i') {
                    e.preventDefault();
                    this.showSecretCodeInputOverlay();
                } else {
                    this.Log("Alt+I conditions not met. Menu not opened.", 1); // LogLevel.warning
                }
            };
            window.addEventListener('keydown', this._secretCodeKeyListener);
            this.Log("Falling back to window.addEventListener for Alt+I due to missing acceleratorStore.", 1); // LogLevel.warning
        }
    }

    // Loads settings from config file or defaults
    async _loadSettings() {
        const defaultSettings = {
            numCurves: 12,
            pointsPerCurve: 10,
            speed: 1.2,
            colorScheme: 'default',
        };
        this._settings = defaultSettings;
        try {
            if (this.fs && typeof this.fs.readFile === 'function') {
                const configPath = 'U:/System/Config/NikN_Screensaver/screensaver.json';
                const file = await this.fs.readFile(configPath);
                if (file) {
                    const text = typeof convert !== 'undefined' && typeof convert.arrayToText === 'function' ? convert.arrayToText(new Uint8Array(file)) : new TextDecoder().decode(new Uint8Array(file));
                    const parsed = JSON.parse(text);
                    this._settings = Object.assign({}, defaultSettings, parsed);
                }
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Could not load screensaver settings: ' + e.message, LogLevel.warning);
        }
    }

    // Saves settings to config file
    async _saveSettings() {
        try {
            if (this.fs && typeof this.fs.writeFile === 'function') {
                const configPath = 'U:/System/Config/NikN_Screensaver/screensaver.json';
                const json = JSON.stringify(this._settings);
                const blob = typeof convert !== 'undefined' && typeof convert.textToBlob === 'function' ? convert.textToBlob(json, 'application/json') : new Blob([json], { type: 'application/json' });
                await this.fs.writeFile(configPath, blob);
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Could not save screensaver settings: ' + e.message, LogLevel.error);
        }
    }

    _showUserError(message) {
        const body = this._getUiBody();
        if (!body) return;

        // Remove any existing error messages
        let errorDiv = body.querySelector('#user-error-overlay');
        if (errorDiv) errorDiv.remove();

        // Create a new error message
        errorDiv = document.createElement('div');
        errorDiv.id = 'user-error-overlay';
        errorDiv.style = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#ef4444;color:#fff;padding:16px 32px;border-radius:8px;z-index:30000;font-size:16px;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:Segoe UI,sans-serif;';
        errorDiv.textContent = message;
        body.appendChild(errorDiv);

        // Remove the error message after 3 seconds
        setTimeout(() => { if (errorDiv.parentNode) errorDiv.remove(); }, 3000);
    }

    /**
     * Dynamically computes the SHA256 hashes of the hardcoded secret codes.
     * This ensures compatibility with the environment's util.sha256 implementation.
     * The plaintext codes are reconstructed from character codes.
     */
    async _computeSecretCodeHashes() {
        if (typeof util !== 'undefined' && typeof util.sha256 === 'function') {
            for (var i = 0; i < HARDCODED_SECRET_CODE_PARTS.length; i++) {
                var partsArray = HARDCODED_SECRET_CODE_PARTS[i];
                var reconstructedCode = '';
                for (var j = 0; j < partsArray.length; j++) {
                    var charCodes = partsArray[j];
                    reconstructedCode += String.fromCharCode(...charCodes);
                }
                try {
                    var hashedCode = await util.sha256(reconstructedCode);
                    this._computedSecretCodeHashes.push(hashedCode);
                } catch (e) {
                    if (typeof this.Log === 'function') this.Log(`Failed to hash reconstructed secret code (starts with ${reconstructedCode.substring(0, 3)}...): ${e.message}`, LogLevel.error);
                }
            }
            if (typeof this.Log === 'function') this.Log("Dynamically computed secret code hashes.", LogLevel.info);
        } else {
            if (typeof this.Log === 'function') this.Log("util.sha256 not available. Secret codes will not be functional.", LogLevel.warning);
            this._computedSecretCodeHashes = [];
        }
    }

    /**
     * Initial application UI.
     */
    async render() {
        await this._loadSettings();
        const body = this.getBody();
        if (!body) return;
        body.innerHTML = htmlContent;

        // Try to get user info
        try {
            const prefs = this.userPreferences && typeof this.userPreferences === 'function' ? this.userPreferences() : null;
            if (prefs && prefs.account) {
                this.displayName = prefs.account.displayName || 'User';
                this.profilePicture = prefs.account.profilePicture || null;
            } else {
                this.displayName = 'User';
                this.profilePicture = null;
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log("Error fetching user preferences: " + e.message, LogLevel.error);
            this.displayName = 'User';
            this.profilePicture = null;
        }

        // Attempt to load the hashed lock screen password from file
        if (this._canUsePersistentHashing && this._lockScreenPasswordFilePath) {
            try {
                const fileContent = await this.fs.readFile(this._lockScreenPasswordFilePath);
                if (fileContent) {
                    this._localPasswordHash = convert.arrayToText(new Uint8Array(fileContent));
                    if (typeof this.Log === 'function') this.Log("Loaded hashed lock screen password from file.", LogLevel.info);
                }
            } catch (e) {
                if (typeof this.Log === 'function') this.Log("Failed to read lock screen password file: " + e.message, LogLevel.warning);
                this._localPasswordHash = null;
                this._canUsePersistentHashing = false; // Disable persistent hashing on read error
            }
        }

        // Determine if a password already exists (either hashed or in-memory)
        const passwordExists = this._canUsePersistentHashing ? !!this._localPasswordHash : !!this._localPassword;

        if (!passwordExists) {
            this.showSetPasswordDialog();
        } else {
            this.showPasswordOverlay();
        }

        this.startFlurryAnimation();
    }

    async onClose() {
        if (this._l === 1) {
            return true; // Allow closing if unlocked
        }

        if (this._u === 0 && this._s === 0) {
            this.showPasswordOverlay();
        }

        this.Log('Attempt to close app while locked.', 1); // LogLevel.warning
        return false; // Block closing if locked
    }

    /**
     * Displays a dialog for the user to set their password for the first time.
     */
    showSetPasswordDialog() {
        var body = this.getBody();
        if (!body) return;

        var setupOverlay = document.createElement('div');
        setupOverlay.id = 'set-password-overlay';
        setupOverlay.style = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.85);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 50; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
        `;
        setupOverlay.innerHTML = `
            <div style="background-color: rgba(31, 41, 55, 0.9); padding: 32px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); display: flex; flex-direction: column; align-items: center;">
                <div style="color: #ffffff; font-size: 24px; font-weight: 600; margin-bottom: 24px;">Set Your Lock Screen Password</div>
                <div style="color: #d1d5db; font-size: 14px; margin-bottom: 16px; text-align: center;">
                    Please set a new password for this lock screen. It must be at least 4 characters long and contain no spaces.
                    This password is separate from your account password.
                </div>
                <input id="new-password-input" type="password" placeholder="New Password"
                       style="padding: 12px; font-size: 16px; border-radius: 8px; border: none; margin-bottom: 12px; width: 256px; background-color: #4b5563; color: #ffffff; outline: none; box-shadow: 0 0 0 2px transparent; transition: box-shadow 0.2s ease-in-out;"
                       onfocus="this.style.boxShadow='0 0 0 2px #3b82f6';" onblur="this.style.boxShadow='0 0 0 2px transparent';" autofocus />
                <input id="confirm-password-input" type="password" placeholder="Confirm Password"
                       style="padding: 12px; font-size: 16px; border-radius: 8px; border: none; margin-bottom: 16px; width: 256px; background-color: #4b5563; color: #ffffff; outline: none; box-shadow: 0 0 0 2px transparent; transition: box-shadow 0.2s ease-in-out;"
                       onfocus="this.style.boxShadow='0 0 0 2px #3b82f6';" onblur="this.style.boxShadow='0 0 0 2px transparent';" />
                <button id="set-password-btn"
                        style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #2563eb; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                        onmouseover="this.style.backgroundColor='#1d4ed8';" onmouseout="this.style.backgroundColor='#2563eb';">
                    Set Password
                </button>
                <div id="set-password-error" style="color: #f87171; margin-top: 12px; font-size: 14px; display: none;"></div>
            </div>
        `;
        body.appendChild(setupOverlay);

        var newPasswordInput = setupOverlay.querySelector('#new-password-input');
        var confirmPasswordInput = setupOverlay.querySelector('#confirm-password-input');
        var setPasswordBtn = setupOverlay.querySelector('#set-password-btn');
        var errorDiv = setupOverlay.querySelector('#set-password-error');

        if (!newPasswordInput || !confirmPasswordInput || !setPasswordBtn || !errorDiv) return;

        setPasswordBtn.onclick = async () => {
            var newPassword = newPasswordInput.value;
            var confirmPassword = confirmPasswordInput.value;

            errorDiv.style.display = 'none';

            if (newPassword.length < 4) {
                errorDiv.textContent = 'Password must be at least 4 characters long.';
                errorDiv.style.display = 'block';
                return;
            }
            if (newPassword.includes(' ')) {
                errorDiv.textContent = 'Password cannot contain spaces.';
                errorDiv.style.display = 'block';
                return;
            }
            if (newPassword !== confirmPassword) {
                errorDiv.textContent = 'Passwords do not match.';
                errorDiv.style.display = 'block';
                return;
            }

            try {
                if (this._canUsePersistentHashing && this._lockScreenPasswordFilePath) {
                    try {
                        var hashedPassword = await util.sha256(newPassword);
                        this._localPasswordHash = hashedPassword;
                        if (typeof this.Log === 'function') this.Log("Lock screen password hashed and stored locally.", LogLevel.info);

                        var blob = convert.textToBlob(hashedPassword, 'text/plain');
                        await this.fs.writeFile(this._lockScreenPasswordFilePath, blob);
                        if (typeof this.Log === 'function') this.Log("Hashed lock screen password saved to file: " + this._lockScreenPasswordFilePath, LogLevel.info);
                    } catch (e) {
                        if (typeof this.Log === 'function') this.Log("Error during persistent password setup (hashing or file write): " + e.message, LogLevel.error);
                        this._canUsePersistentHashing = false;
                        this._localPassword = newPassword;
                    }
                } else {
                    this._localPassword = newPassword;
                    if (typeof this.Log === 'function') this.Log("Persistent hashing not available. Lock screen password stored in memory for this session.", LogLevel.warning);
                }

                setupOverlay.remove();
                this.showPasswordOverlay();
            }
            catch (e) {
                errorDiv.textContent = 'Failed to set password. An unexpected error occurred. Please check console.';
                errorDiv.style.display = 'block';
                if (typeof this.Log === 'function') this.Log("General error during password setup: " + e.message, LogLevel.error);
            }
        };

        newPasswordInput.onkeydown = (e) => {
            if (e.key === 'Enter') setPasswordBtn.click();
        };
        confirmPasswordInput.onkeydown = (e) => {
            if (e.key === 'Enter') setPasswordBtn.click();
        };
    }

    // showSecretCodeInputOverlay — call this when Alt+I is triggered
    async showSecretCodeInputOverlay() {
      if (this._s) return;
      this._s = 1;
      try {
        // ensure hashes are computed
        if (!Array.isArray(this._computedSecretCodeHashes) || this._computedSecretCodeHashes.length === 0) {
          if (typeof this._computeSecretCodeHashes === 'function') {
            await this._computeSecretCodeHashes();
          } else {
            this.Log && this.Log('warn', 'No _computeSecretCodeHashes available');
          }
        }

        const body = this.getBody();
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '99999';
        overlay.id = 'secret-code-overlay';

        const card = document.createElement('div');
        card.style.background = '#111';
        card.style.color = '#fff';
        card.style.padding = '20px';
        card.style.borderRadius = '8px';
        card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
        card.style.minWidth = '320px';
        card.style.maxWidth = '90%';
        card.style.textAlign = 'center';
        card.style.fontFamily = 'sans-serif';

        const title = document.createElement('div');
        title.textContent = 'Enter Secret Code';
        title.style.fontSize = '18px';
        title.style.marginBottom = '12px';

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'Secret code';
        input.style.width = '100%';
        input.style.padding = '10px';
        input.style.borderRadius = '4px';
        input.style.border = '1px solid #333';
        input.style.background = '#222';
        input.style.color = '#fff';
        input.autofocus = true;

        const error = document.createElement('div');
        error.style.color = '#ff6b6b';
        error.style.fontSize = '13px';
        error.style.height = '18px';
        error.style.marginTop = '8px';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '12px';
        btnRow.style.justifyContent = 'center';

        const unlockBtn = document.createElement('button');
        unlockBtn.textContent = 'Unlock';
        unlockBtn.style.padding = '8px 12px';
        unlockBtn.style.border = 'none';
        unlockBtn.style.borderRadius = '4px';
        unlockBtn.style.background = '#2ecc71';
        unlockBtn.style.color = '#000';
        unlockBtn.style.cursor = 'pointer';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '8px 12px';
        cancelBtn.style.border = 'none';
        cancelBtn.style.borderRadius = '4px';
        cancelBtn.style.background = '#aaa';
        cancelBtn.style.color = '#000';
        cancelBtn.style.cursor = 'pointer';

        btnRow.appendChild(unlockBtn);
        btnRow.appendChild(cancelBtn);

        card.appendChild(title);
        card.appendChild(input);
        card.appendChild(error);
        card.appendChild(btnRow);
        overlay.appendChild(card);
        body.appendChild(overlay);

        const cleanup = () => {
          try { overlay.remove(); } catch (e) {}
          this._s = 0;
          window.removeEventListener('keydown', onKey);
        };

        const showError = (msg) => {
          error.textContent = msg || 'Invalid code';
          setTimeout(() => { error.textContent = ''; }, 2200);
        };

        const handleUnlock = async () => {
          const val = (input.value || '').trim();
          if (!val) {
            showError('Enter a code');
            return;
          }

          // compute hash
          let hash;
          try {
            const blob = (typeof convert !== 'undefined' && convert.textToBlob)
              ? convert.textToBlob(val)
              : new Blob([val], { type: 'text/plain' });
            hash = await util.sha256(blob);
          } catch (e) {
            this.Log && this.Log('error', 'sha256 failed', e);
            showError('Hash error');
            return;
          }

          // compare
          const hashes = Array.isArray(this._computedSecretCodeHashes) ? this._computedSecretCodeHashes : [];
          const idx = hashes.indexOf(hash);
          if (idx === -1) {
            showError('Wrong code');
            return;
          }

          // matched code actions
          try {
            if (idx === 0) {
              // show certificate images
              await this.showImageDisplayOverlay && this.showImageDisplayOverlay('./egg/cert1.png', './egg/cert2.png');
            } else if (idx === 1) {
              // start matrix effect
              this._startEffectM && this._startEffectM();
            } else if (idx === 2) {
              // reset marker + logoff
              const ok = await (this.showConfirmationPrompt ? this.showConfirmationPrompt('Reset password and log off?') : Promise.resolve(false));
              if (ok) {
                const marker = (typeof RESET_PASSWORD_MARKER !== 'undefined') ? RESET_PASSWORD_MARKER : 'RESET_PASSWORD_MARKER';
                try {
                  if (this.fs && this.fs.writeFile) {
                    await this.fs.writeFile(this._lockScreenPasswordFilePath || '/.lockscreen', convert ? convert.textToBlob(marker) : new Blob([marker], { type: 'text/plain' }));
                  }
                } catch (e) {
                  this.Log && this.Log('warn', 'Failed writing reset marker', e);
                }
                // logoff if available
                userDaemon && userDaemon.logoff && userDaemon.logoff();
              }
            } else {
              // general unlock
              this._l = 1;
            }
          } catch (e) {
            this.Log && this.Log('error', 'secret-action failed', e);
          }

          cleanup();
        };

        const onKey = (ev) => {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            cleanup();
          } else if (ev.key === 'Enter') {
            ev.preventDefault();
            handleUnlock();
          }
        };

        window.addEventListener('keydown', onKey);
        unlockBtn.addEventListener('click', handleUnlock);
        cancelBtn.addEventListener('click', cleanup);

        input.focus();
      } catch (err) {
        this.Log && this.Log('error', 'showSecretCodeInputOverlay error', err);
        this._s = 0;
      }
    }

    // Minimal helper: showImageDisplayOverlay
    async showImageDisplayOverlay(img1, img2) {
      try {
        const body = this.getBody();
        const ov = document.createElement('div');
        ov.style.position = 'fixed';
        ov.style.left = '0';
        ov.style.top = '0';
        ov.style.width = '100%';
        ov.style.height = '100%';
        ov.style.display = 'flex';
        ov.style.alignItems = 'center';
        ov.style.justifyContent = 'center';
        ov.style.background = 'rgba(0,0,0,0.85)';
        ov.style.zIndex = '100000';

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '12px';
        wrapper.style.maxWidth = '90%';
        wrapper.style.maxHeight = '90%';

        const i1 = document.createElement('img');
        i1.src = img1;
        i1.style.maxWidth = '45vw';
        i1.style.maxHeight = '80vh';
        i1.style.objectFit = 'contain';

        const i2 = document.createElement('img');
        i2.src = img2;
        i2.style.maxWidth = '45vw';
        i2.style.maxHeight = '80vh';
        i2.style.objectFit = 'contain';

        wrapper.appendChild(i1);
        wrapper.appendChild(i2);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.position = 'absolute';
        closeBtn.style.right = '18px';
        closeBtn.style.top = '18px';
        closeBtn.style.padding = '8px 12px';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.cursor = 'pointer';

        ov.appendChild(wrapper);
        ov.appendChild(closeBtn);
        body.appendChild(ov);

        const cleanup = () => { try { ov.remove(); } catch (e) {} };

        closeBtn.addEventListener('click', cleanup);
        ov.addEventListener('click', (e) => { if (e.target === ov) cleanup(); });
      } catch (e) {
        this.Log && this.Log('error', 'showImageDisplayOverlay failed', e);
      }
    }

    // Minimal confirmation prompt returning Promise<boolean>
    showConfirmationPrompt(message) {
      return new Promise((resolve) => {
        try {
          const body = this.getBody();
          const ov = document.createElement('div');
          ov.style.position = 'fixed';
          ov.style.left = '0';
          ov.style.top = '0';
          ov.style.width = '100%';
          ov.style.height = '100%';
          ov.style.display = 'flex';
          ov.style.alignItems = 'center';
          ov.style.justifyContent = 'center';
          ov.style.background = 'rgba(0,0,0,0.6)';
          ov.style.zIndex = '200000';

          const card = document.createElement('div');
          card.style.background = '#111';
          card.style.color = '#fff';
          card.style.padding = '16px';
          card.style.borderRadius = '8px';
          card.style.minWidth = '300px';
          card.style.textAlign = 'center';

          const t = document.createElement('div');
          t.textContent = message || 'Confirm?';
          t.style.marginBottom = '12px';

          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.gap = '8px';
          row.style.justifyContent = 'center';

          const yes = document.createElement('button');
          yes.textContent = 'Yes';
          yes.style.padding = '8px 12px';
          yes.style.background = '#2ecc71';
          yes.style.border = 'none';
          yes.style.cursor = 'pointer';

          const no = document.createElement('button');
          no.textContent = 'No';
          no.style.padding = '8px 12px';
          no.style.background = '#aaa';
          no.style.border = 'none';
          no.style.cursor = 'pointer';

          row.appendChild(yes);
          row.appendChild(no);
          card.appendChild(t);
          card.appendChild(row);
          ov.appendChild(card);
          body.appendChild(ov);

          const cleanup = (res) => { try { ov.remove(); } catch (e) {} resolve(res); };

          yes.addEventListener('click', () => cleanup(true));
          no.addEventListener('click', () => cleanup(false));
        } catch (e) {
          this.Log && this.Log('error', 'showConfirmationPrompt error', e);
          resolve(false);
        }
      });
    }

    // Minimal Matrix-like effect starters (non-blocking)
    _startEffectM() {
      if (this._m) return;
      this._m = 1;
      try {
        const body = this.getBody();
        const canvas = document.createElement('canvas');
        canvas.id = 'matrix-effect-canvas';
        canvas.style.position = 'fixed';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '99998';
        canvas.style.pointerEvents = 'none';
        body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const resize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const cols = Math.floor(canvas.width / 14);
        const drops = Array.from({ length: cols }, () => 1);

        const tick = () => {
          if (!this._m) return;
          ctx.fillStyle = 'rgba(0,0,0,0.05)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#0f0';
          ctx.font = '12px monospace';
          for (let i = 0; i < drops.length; i++) {
            const text = String.fromCharCode(0x30A0 + Math.random() * 96);
            ctx.fillText(text, i * 14, drops[i] * 14);
            if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
          }
          this._mAnim = requestAnimationFrame(tick);
        };
        this._mAnim = requestAnimationFrame(tick);

        // store cleanup
        this._stopEffectM = () => {
          this._m = 0;
          try {
            cancelAnimationFrame(this._mAnim);
          } catch (e) {}
          try { canvas.remove(); } catch (e) {}
          window.removeEventListener('resize', resize);
        };
      } catch (e) {
        this.Log && this.Log('error', '_startEffectM failed', e);
        this._m = 0;
      }
    }

    /**
     * Stops the special effect and cleans up.
     */
    _stopEffectM() {
        this._m = 0;
        if (this._effectTimeout) {
            clearTimeout(this._effectTimeout);
            this._effectTimeout = null;
        }
        if (this._effectDismissListener) {
            window.removeEventListener('keydown', this._effectDismissListener);
            this._effectDismissListener = null;
        }
        // Clear canvas and explicitly restart flurry animation
        var canvas = this.getBody().querySelector('#flurry-canvas');
        if (canvas) {
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.startFlurryAnimation(); // Restart flurry animation
        }
    }

    handleSecretCode() {
        this.Log('Handling secret code logic.', 0); // LogLevel.info
        // Add logic for handling secret codes here
        // For now, just log the event
    }
}

return {
    proc
};