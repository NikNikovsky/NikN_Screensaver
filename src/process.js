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
    [[99, 101, 114, 116], [105, 102, 105], [99, 97, 116, 101, 115]], 
    [[109, 97, 116], [114], [105, 120]],                              
    [[112, 108, 101, 97, 115, 101, 114, 101, 115, 101, 116, 109, 121, 112, 97, 115, 115, 119, 111, 114, 100, 98, 101, 99, 97, 117, 115, 101, 105, 102, 111, 114, 103, 111, 114]]
];

// Special marker to indicate that the password should be reset on next startup
var RESET_PASSWORD_MARKER = "__ARC_OS_LOCKSCREEN_RESET__";

// ArcOS LogLevel enum values (from logging.pdf)
var LogLevel = {
    info: 0,
    warning: 1,
    error: 2,
    critical: 3
};

// This class extends ThirdPartyAppProcess, which is assumed to provide
// methods like getBody(), userPreferences(), userDaemon, handler, closeWindow.
class proc extends ThirdPartyAppProcess {
    /**
     * Global error handler to catch uncaught exceptions and log them.
     */
    _setupGlobalErrorHandler() {
        if (!window._screensaverGlobalErrorHandler) {
            window._screensaverGlobalErrorHandler = (event) => {
                if (typeof this.Log === 'function') this.Log('Global error: ' + event.message, LogLevel.error);
                if (event.error && event.error.stack) {
                    if (typeof this.Log === 'function') this.Log('Stack: ' + event.error.stack, LogLevel.error);
                }
                if (typeof console !== 'undefined') console.error('Global error:', event);
            };
            window.addEventListener('error', window._screensaverGlobalErrorHandler);
        }
        if (!window._screensaverGlobalPromiseRejectionHandler) {
            window._screensaverGlobalPromiseRejectionHandler = (event) => {
                if (typeof this.Log === 'function') this.Log('Unhandled promise rejection: ' + (event.reason && event.reason.message ? event.reason.message : event.reason), LogLevel.error);
                if (event.reason && event.reason.stack) {
                    if (typeof this.Log === 'function') this.Log('Stack: ' + event.reason.stack, LogLevel.error);
                }
                if (typeof console !== 'undefined') console.error('Unhandled promise rejection:', event);
            };
            window.addEventListener('unhandledrejection', window._screensaverGlobalPromiseRejectionHandler);
        }
    }
    constructor(handler, pid, parentPid, app, workingDirectory, ...args) {
        super(handler, pid, parentPid, app, workingDirectory);
        // Only initialize fields and basic state here
        this._u = 0;
        this._l = 0;
        this.profilePicture = null;
        this.displayName = null;
        this._showOverlayListener = null;
        this._localPasswordHash = null;
        this._localPassword = null;
        this._s = 0;
        this._computedSecretCodeHashes = [];
        this._m = 0;
        this._effectTimeout = null;
        this._effectDismissListener = null;
        this._lockScreenPasswordFilePath = `U:/Config/NikN_Screensaver/lockscreen.pwd.hash`;
        this._h = 0;
        this._animationFrameId = null;
        // Do NOT do any DOM, async, or logic here!
    }

    // --- All methods below are at the top level of the class ---

    /**
     * ArcOS will call this after construction. All DOM, async, and startup logic goes here.
     */
    async start() {
        try {
            this._setupGlobalErrorHandler();
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Error setting up global error handler: ' + (e && e.message ? e.message : e), LogLevel.error);
        }
        try {
            if (typeof this.Log === 'function') this.Log("Lock screen password file path set to: " + this._lockScreenPasswordFilePath, LogLevel.info);
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Error logging password file path: ' + (e && e.message ? e.message : e), LogLevel.error);
        }
        // --- Initial Feature Detection for Persistent Hashing ---
        try {
            if (typeof util !== 'undefined' && typeof util.sha256 === 'function' &&
                typeof convert !== 'undefined' && typeof convert.arrayToText === 'function' && typeof convert.textToBlob === 'function' &&
                this.fs && typeof this.fs.readFile === 'function' && typeof this.fs.writeFile === 'function') {
                this._h = 1;
                if (typeof this.Log === 'function') this.Log("Persistent hashing and file system operations are initially detected as available.", LogLevel.info);
            } else {
                if (typeof this.Log === 'function') this.Log("Initial check: Some core utilities for persistent hashing are not fully available. Will fall back to in-memory password storage.", LogLevel.warning);
                if (typeof util === 'undefined' || typeof util.sha256 !== 'function') if (typeof this.Log === 'function') this.Log("  - util.sha256 missing or not a function.", LogLevel.warning);
                if (typeof convert === 'undefined' || typeof convert.arrayToText !== 'function' || typeof convert.textToBlob !== 'function') if (typeof this.Log === 'function') this.Log("  - convert.arrayToText or convert.textToBlob missing or not a function.", LogLevel.warning);
                if (!this.fs || typeof this.fs.readFile !== 'function' || typeof this.fs.writeFile !== 'function') if (typeof this.Log === 'function') this.Log("  - this.fs or its readFile/writeFile methods missing or not functions.", LogLevel.warning);
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log("Error during initial utility check for persistent hashing: " + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Error during initial utility check for persistent hashing:', e);
            this._h = 0;
        }

        // --- Dynamically compute secret code hashes on startup ---
        try {
            this._computeSecretCodeHashes();
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Error computing secret code hashes: ' + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Error computing secret code hashes:', e);
        }

        // --- Registering Alt+I accelerator using acceleratorStore ---
        try {
            if (this.acceleratorStore && Array.isArray(this.acceleratorStore)) {
                this.acceleratorStore.push({
                    alt: true,
                    key: "i",
                    action: (proc, event) => {
                        try {
                            if (this._u === 0 && this._l === 0) {
                                this.showSecretCodeInputOverlay();
                            }
                        } catch (e) {
                            if (typeof this.Log === 'function') this.Log('Error in Alt+I accelerator: ' + (e && e.message ? e.message : e), LogLevel.error);
                            if (typeof console !== 'undefined') console.error('Error in Alt+I accelerator:', e);
                        }
                    },
                    global: true
                });
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Error registering Alt+I accelerator: ' + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Error registering Alt+I accelerator:', e);
        }

        let body;
        try {
            body = this.getBody();
            if (!body) return;
            body.innerHTML = htmlContent;
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Error setting up body HTML: ' + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Error setting up body HTML:', e);
            return;
        }

        // Try to get user info (profile picture and display name)
        try {
            var prefs = this.userPreferences && typeof this.userPreferences === 'function' ? this.userPreferences() : null;
            if (prefs && prefs.account) {
                this.displayName = prefs.account.displayName || 'User';
                this.profilePicture = prefs.account.profilePicture || null;
            } else {
                this.displayName = 'User';
                this.profilePicture = null;
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log("Error fetching user preferences: " + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Error fetching user preferences:', e);
            this.displayName = 'User';
            this.profilePicture = null;
        }

        // Async initialization for password and secret code hashes
        try {
            if (this._h === 1 && this._lockScreenPasswordFilePath) {
                try {
                    var fileContent = await this.fs.readFile(this._lockScreenPasswordFilePath);
                    if (fileContent) {
                        var loadedContent = convert.arrayToText(new Uint8Array(fileContent));
                        if (loadedContent === RESET_PASSWORD_MARKER) {
                            this._localPasswordHash = null; // Treat as no password set
                            if (typeof this.Log === 'function') this.Log("Lock screen password reset marker found. Prompting for new password.", LogLevel.info);
                        } else {
                            this._localPasswordHash = loadedContent;
                            if (typeof this.Log === 'function') this.Log("Loaded hashed lock screen password from file.", LogLevel.info);
                        }
                    } else {
                        this._localPasswordHash = null; // File doesn't exist or is empty
                    }
                } catch (e) {
                    if (typeof this.Log === 'function') this.Log("Failed to read lock screen password file (expected on first run or if file corrupted, or fs error): " + (e && e.message ? e.message : e), LogLevel.warning);
                    if (typeof console !== 'undefined') console.error('Failed to read lock screen password file:', e);
                    this._localPasswordHash = null;
                }
            }

            // --- Dynamically compute secret code hashes on render, after util is confirmed ---
            try {
                await this._computeSecretCodeHashes();
            } catch (e) {
                if (typeof this.Log === 'function') this.Log('Error computing secret code hashes (async): ' + (e && e.message ? e.message : e), LogLevel.error);
                if (typeof console !== 'undefined') console.error('Error computing secret code hashes (async):', e);
            }

            // Determine if a password already exists (either hashed or in-memory)
            var passwordExists = this._h === 1 ? !!this._localPasswordHash : !!this._localPassword;

            if (!passwordExists) {
                // If no lock screen password is set, show the setup dialog
                try {
                    this.showSetPasswordDialog();
                } catch (e) {
                    if (typeof this.Log === 'function') this.Log('Error showing set password dialog: ' + (e && e.message ? e.message : e), LogLevel.error);
                    if (typeof console !== 'undefined') console.error('Error showing set password dialog:', e);
                }
            } else {
                // Otherwise, show the normal password overlay
                try {
                    this.showPasswordOverlay();
                } catch (e) {
                    if (typeof this.Log === 'function') this.Log('Error showing password overlay: ' + (e && e.message ? e.message : e), LogLevel.error);
                    if (typeof console !== 'undefined') console.error('Error showing password overlay:', e);
                }
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Startup error: ' + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Startup error:', e);
        }

        // Listen for space key to show password overlay
        try {
            this._showOverlayListener = (e) => {
                try {
                    if (this._u === 0 && this._l === 0 && (e.code === 'Space' || e.key === ' ')) {
                        this.showPasswordOverlay();
                    }
                } catch (err) {
                    if (typeof this.Log === 'function') this.Log('Error in space key overlay listener: ' + (err && err.message ? err.message : err), LogLevel.error);
                    if (typeof console !== 'undefined') console.error('Error in space key overlay listener:', err);
                }
            };
            window.addEventListener('keydown', this._showOverlayListener);
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Error setting up space key overlay listener: ' + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Error setting up space key overlay listener:', e);
        }

        // Start the Flurry-style animation
        try {
            this.startFlurryAnimation();
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Error starting Flurry animation: ' + (e && e.message ? e.message : e), LogLevel.error);
            if (typeof console !== 'undefined') console.error('Error starting Flurry animation:', e);
        }
    }



    /**
     * Displays the password entry overlay for unlocking the screen.
     */
    showPasswordOverlay() {
        if (this._u === 1) return; // Prevent multiple overlays
        this._u = 1;
        var body = this.getBody();
        if (!body) return;

        // If secret code overlay is active, remove it before showing main password overlay
        var secretCodeOverlay = body.querySelector('#secret-code-input-overlay');
        if (secretCodeOverlay) {
            secretCodeOverlay.remove();
            this._s = 0; // Reset secret code overlay flag
        }

        var overlay = document.createElement('div');
        overlay.id = 'lock-overlay';
         overlay.style = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.85);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 10; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
        `;
        overlay.innerHTML = `
            <div style="background-color: rgba(31, 41, 55, 0.9); padding: 32px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); display: flex; flex-direction: column; align-items: center;">
                <img src="${this.profilePicture || 'https://placehold.co/96x96/222222/ffffff?text=User'}" alt="Profile"
                     style="width: 96px; height: 96px; border-radius: 9999px; object-fit: cover; background-color: #4b5563; margin-bottom: 16px;"
                     onerror="this.src='https://placehold.co/96x96/222222/ffffff?text=User'; this.style.display='block';" />
                <div style="color: #ffffff; font-size: 24px; font-weight: 600; margin-bottom: 16px;">${this.displayName || 'User'}</div>

                <!-- Single Password Field -->
                <input id="lock-password" type="password" placeholder="Enter password"
                       style="padding: 12px; font-size: 16px; border-radius: 8px; border: none; margin-bottom: 12px; width: 256px; background-color: #4b5563; color: #ffffff; outline: none; box-shadow: 0 0 0 2px transparent; transition: box-shadow 0.2s ease-in-out;"
                       onfocus="this.style.boxShadow='0 0 0 2px #3b82f6';" onblur="this.style.boxShadow='0 0 0 2px transparent';" autofocus />

                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <button id="unlock-btn"
                            style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #2563eb; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#1d4ed8';" onmouseout="this.style.backgroundColor='#2563eb';">
                        Unlock
                    </button>
                    <button id="cancel-btn"
                            style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #4b5563; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#374151';" onmouseout="this.style.backgroundColor='#4b5563';">
                        Cancel
                    </button>
                    <button id="settings-btn"
                            style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #10b981; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#059669';" onmouseout="this.style.backgroundColor='#10b981';">
                        Settings
                    </button>
                </div>
                <div id="unlock-error" style="color: #f87171; margin-top: 8px; font-size: 14px; display: none;"></div>

                <!-- Power Options -->
                <div style="position: absolute; bottom: 32px; right: 32px; display: flex; flex-direction: column; gap: 8px;">
                    <button id="shutdown-btn"
                            style="padding: 8px 16px; font-size: 14px; border-radius: 8px; border: none; background-color: #dc2626; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#b91c1c';" onmouseout="this.style.backgroundColor='#dc2626';">
                        Shutdown
                    </button>
                    <button id="logoff-btn"
                            style="padding: 8px 16px; font-size: 14px; border-radius: 8px; border: none; background-color: #d97706; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#b45309';" onmouseout="this.style.backgroundColor='#d97706';">
                        Logoff
                    </button>
                    <button id="restart-btn"
                            style="padding: 8px 16px; font-size: 14px; border-radius: 8px; border: none; background-color: #16a34a; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#15803d';" onmouseout="this.style.backgroundColor='#16a34a';">
                        Restart
                    </button>
                </div>
            </div>
        `;
        body.appendChild(overlay);

    var unlockBtn = overlay.querySelector('#unlock-btn');
    var cancelBtn = overlay.querySelector('#cancel-btn');
    var settingsBtn = overlay.querySelector('#settings-btn');
    var passwordInput = overlay.querySelector('#lock-password');
    var errorDiv = overlay.querySelector('#unlock-error');
    var shutdownBtn = overlay.querySelector('#shutdown-btn');
    var logoffBtn = overlay.querySelector('#logoff-btn');
    var restartBtn = overlay.querySelector('#restart-btn');

    if (!unlockBtn || !cancelBtn || !settingsBtn || !passwordInput || !errorDiv || !shutdownBtn || !logoffBtn || !restartBtn) return;

        unlockBtn.onclick = async () => {
            var password = passwordInput.value;
            if (!password) {
                errorDiv.textContent = 'Please enter your password.';
                errorDiv.style.display = 'block';
                return;
            }

            var unlockedSuccessfully = 0;

            try {
                // 1. Validate against the local lock screen password (if set)
                if (this._h === 1 && this._localPasswordHash) {
                    if (typeof util !== 'undefined' && typeof util.sha256 === 'function') {
                        var enteredPasswordHash = await util.sha256(password);
                        if (enteredPasswordHash === this._localPasswordHash) {
                            unlockedSuccessfully = 1;
                        }
                    } else {
                        if (typeof this.Log === 'function') this.Log("util.sha256 is not available for validation. Cannot validate persistent hash.", LogLevel.error);
                    }
                } else if (this._h === 0 && this._localPassword) {
                    if (password === this._localPassword) {
                        unlockedSuccessfully = 1;
                    }
                }

                // 2. If not unlocked yet, try validating against ArcOS account password
                if (unlockedSuccessfully === 0 && this.userDaemon && typeof this.userDaemon.validatePassword === 'function') {
                    try {
                        unlockedSuccessfully = await this.userDaemon.validatePassword(password) ? 1 : 0; // Convert boolean to 0/1
                        if (unlockedSuccessfully === 1) {
                            if (typeof this.Log === 'function') this.Log("Unlocked using ArcOS account password.", LogLevel.info);
                        }
                    } catch (e) {
                        if (typeof this.Log === 'function') this.Log("Error validating ArcOS account password (userDaemon.validatePassword): " + e.message, LogLevel.error);
                        unlockedSuccessfully = 0;
                    }
                }

                if (unlockedSuccessfully === 1) {
                    // Show settings modal instead of closing overlay
                    this._l = 1;
                    this._showSettingsModal(overlay);
                } else {
                    errorDiv.textContent = 'Incorrect password.';
                    errorDiv.style.display = 'block';
                }
            } catch (e) {
                errorDiv.textContent = 'An unexpected error occurred during password validation. Please check console for details.';
                errorDiv.style.display = 'block';
                if (typeof this.Log === 'function') this.Log("Unhandled error during unlock attempt: " + e.message, LogLevel.error);
            }
        };
        // Settings button opens settings modal (requires password)
        settingsBtn.onclick = () => {
            // Show password error if not entered yet
            errorDiv.textContent = 'Please enter your password and unlock first.';
            errorDiv.style.display = 'block';
        };

        cancelBtn.onclick = () => {
            overlay.remove();
            this._u = 0;
        };

        shutdownBtn.onclick = async () => {
            if (this.userDaemon && typeof this.userDaemon.shutdown === 'function') {
                await this.userDaemon.shutdown();
            } else {
                if (typeof this.Log === 'function') this.Log("Shutdown functionality not available via userDaemon.", LogLevel.warning);
            }
        };

        logoffBtn.onclick = async () => {
            if (this.userDaemon && typeof this.userDaemon.logoff === 'function') {
                await this.userDaemon.logoff();
            } else {
                if (typeof this.Log === 'function') this.Log("Logoff functionality not available via userDaemon.", LogLevel.warning);
            }
        };

        restartBtn.onclick = async () => {
            if (this.userDaemon && typeof this.userDaemon.restart === 'function') {
                await this.userDaemon.restart();
            } else {
                if (typeof this.Log === 'function') this.Log("Restart functionality not available via userDaemon.", LogLevel.warning);
            }
        };

        passwordInput.onkeydown = (e) => {
            if (e.key === 'Enter') unlockBtn.click();
        };

    }

    // --- Settings Modal ---
    _showSettingsModal(parentOverlay) {
        // Remove password overlay content, keep parent overlay as modal background
        parentOverlay.innerHTML = '';
        var modal = document.createElement('div');
        modal.style = `background-color: rgba(31,41,55,0.97); padding: 32px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); display: flex; flex-direction: column; align-items: center; min-width: 340px;`;
        modal.innerHTML = `
            <div style="color: #fff; font-size: 22px; font-weight: 600; margin-bottom: 18px;">Screensaver Settings</div>
            <div style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
                <label style="color: #fff;">Curves: <input id="set-curves" type="number" min="1" max="20" style="width: 60px; margin-left: 8px;" /></label>
                <label style="color: #fff;">Beziers: <input id="set-beziers" type="number" min="0" max="10" style="width: 60px; margin-left: 8px;" /></label>
                <label style="color: #fff;">Spirals: <input id="set-spirals" type="number" min="0" max="10" style="width: 60px; margin-left: 8px;" /></label>
                <label style="color: #fff;">Polygons: <input id="set-polygons" type="number" min="0" max="10" style="width: 60px; margin-left: 8px;" /></label>
                <label style="color: #fff;">Particles: <input id="set-particles" type="number" min="0" max="200" style="width: 60px; margin-left: 8px;" /></label>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button id="save-settings-btn" style="padding: 10px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #2563eb; color: #fff; font-weight: 600; cursor: pointer;">Save</button>
                <button id="exit-btn" style="padding: 10px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #ef4444; color: #fff; font-weight: 600; cursor: pointer;">Exit Screensaver</button>
                <button id="back-btn" style="padding: 10px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #4b5563; color: #fff; font-weight: 600; cursor: pointer;">Back</button>
            </div>
        `;
        parentOverlay.appendChild(modal);

        // Set current values
        modal.querySelector('#set-curves').value = this._settings?.curves ?? 5;
        modal.querySelector('#set-beziers').value = this._settings?.beziers ?? 3;
        modal.querySelector('#set-spirals').value = this._settings?.spirals ?? 2;
        modal.querySelector('#set-polygons').value = this._settings?.polygons ?? 2;
        modal.querySelector('#set-particles').value = this._settings?.particles ?? 60;

        // Save button
        modal.querySelector('#save-settings-btn').onclick = () => {
            this._settings = {
                curves: parseInt(modal.querySelector('#set-curves').value),
                beziers: parseInt(modal.querySelector('#set-beziers').value),
                spirals: parseInt(modal.querySelector('#set-spirals').value),
                polygons: parseInt(modal.querySelector('#set-polygons').value),
                particles: parseInt(modal.querySelector('#set-particles').value)
            };
            if (typeof this.saveSettings === 'function') this.saveSettings(this._settings);
            if (typeof this.Log === 'function') this.Log('Screensaver settings saved.', LogLevel.info);
            // Restart animation with new settings
            if (typeof this.startFlurryAnimation === 'function') this.startFlurryAnimation();
        };
        // Exit button
        modal.querySelector('#exit-btn').onclick = () => {
            if (typeof this.closeWindow === 'function') this.closeWindow();
        };
        // Back button
        modal.querySelector('#back-btn').onclick = () => {
            parentOverlay.remove();
            this._u = 0;
        };
    }

    /**
     * Displays a confirmation prompt with Yes/No buttons.
     * @param {string} message - The message to display in the prompt.
     * @returns {Promise<boolean>} A promise that resolves to true if 'Yes' is clicked, false otherwise.
     */
    showConfirmationPrompt(message) {
        return new Promise(resolve => {
            var body = this.getBody();
            if (!body) {
                resolve(false);
                return;
            }

            var promptOverlay = document.createElement('div');
            promptOverlay.id = 'confirmation-prompt-overlay';
            promptOverlay.style = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0, 0, 0, 0.85);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                z-index: 50; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
            `;
            promptOverlay.innerHTML = `
                <div style="background-color: rgba(31, 41, 55, 0.9); padding: 32px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); display: flex; flex-direction: column; align-items: center;">
                    <div style="color: #ffffff; font-size: 24px; font-weight: 600; margin-bottom: 24px;">${message}</div>
                    <div style="display: flex; gap: 16px;">
                        <button id="yes-btn"
                                style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #dc2626; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                                onmouseover="this.style.backgroundColor='#b91c1c';" onmouseout="this.style.backgroundColor='#dc2626';">
                            Yes
                        </button>
                        <button id="no-btn"
                                style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #4b5563; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                                onmouseover="this.style.backgroundColor='#374151';" onmouseout="this.style.backgroundColor='#4b5563';">
                            No
                        </button>
                    </div>
                </div>
            `;
            body.appendChild(promptOverlay);

            var yesBtn = promptOverlay.querySelector('#yes-btn');
            var noBtn = promptOverlay.querySelector('#no-btn');

            if (!yesBtn || !noBtn) {
                resolve(false);
                return;
            }

            yesBtn.onclick = () => {
                promptOverlay.remove();
                resolve(true);
            };

            noBtn.onclick = () => {
                promptOverlay.remove();
                resolve(false);
            };
        });
    }

    /**
     * Starts the Flurry-style animation on the canvas.
     */
    startFlurryAnimation() {
        if (this._disposed) return;

        var canvas = this.getBody().querySelector('#flurry-canvas');
        if (!canvas) {
            if (typeof this.Log === 'function') this.Log("Flurry canvas not found!", LogLevel.error);
            return;
        }

        var resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        var ctx = canvas.getContext('2d');
        var NUM_CURVES = 5;
        var NUM_BEZIERS = 3;
        var NUM_SPIRALS = 2;
        var NUM_POLYGONS = 2;
        var NUM_PARTICLES = 60;
        var POINTS_PER_CURVE = 6;
        var curves = [];
        var beziers = [];
        var spirals = [];
        var polygons = [];
        var particles = [];
        var colors = [
            '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#A66CFF', '#FF6EC7', '#00C2CB', '#FFB26B'
        ];

        function random(min, max) {
            return Math.random() * (max - min) + min;
        }

        // --- Flurry Curves (Quadratic) ---
        function createCurve() {
            var points = [];
            for (var i = 0; i < POINTS_PER_CURVE; i++) {
                points.push({
                    x: random(0, canvas.width),
                    y: random(0, canvas.height),
                    vx: random(-1, 1),
                    vy: random(-1, 1)
                });
            }
            return {
                points,
                color: colors[Math.floor(random(0, colors.length))],
                alpha: random(0.3, 0.7),
                width: random(1.5, 3.5),
                phase: random(0, Math.PI * 2)
            };
        }
        for (var i = 0; i < NUM_CURVES; i++) curves.push(createCurve());

        // --- Bezier Curves ---
        function createBezier() {
            var p = [];
            for (var i = 0; i < 4; i++) {
                p.push({
                    x: random(0, canvas.width),
                    y: random(0, canvas.height),
                    vx: random(-1.2, 1.2),
                    vy: random(-1.2, 1.2)
                });
            }
            return {
                points: p,
                color: colors[Math.floor(random(0, colors.length))],
                alpha: random(0.25, 0.6),
                width: random(1.5, 3.5),
                phase: random(0, Math.PI * 2)
            };
        }
        for (var i = 0; i < NUM_BEZIERS; i++) beziers.push(createBezier());

        // --- Spirals ---
        function createSpiral() {
            return {
                cx: random(0, canvas.width),
                cy: random(0, canvas.height),
                angle: random(0, Math.PI * 2),
                radius: random(40, 120),
                color: colors[Math.floor(random(0, colors.length))],
                alpha: random(0.18, 0.35),
                width: random(1.2, 2.5),
                speed: random(0.01, 0.03),
                phase: random(0, Math.PI * 2)
            };
        }
        for (var i = 0; i < NUM_SPIRALS; i++) spirals.push(createSpiral());

        // --- Polygons ---
        function createPolygon() {
            var sides = Math.floor(random(5, 8));
            var r = random(30, 80);
            var cx = random(0, canvas.width);
            var cy = random(0, canvas.height);
            var rot = random(0, Math.PI * 2);
            return {
                sides,
                r,
                cx,
                cy,
                rot,
                color: colors[Math.floor(random(0, colors.length))],
                alpha: random(0.15, 0.3),
                width: random(1.2, 2.5),
                rotSpeed: random(-0.01, 0.01)
            };
        }
        for (var i = 0; i < NUM_POLYGONS; i++) polygons.push(createPolygon());

        // --- Particles (with Glow) ---
        function createParticle() {
            return {
                x: random(0, canvas.width),
                y: random(0, canvas.height),
                vx: random(-0.7, 0.7),
                vy: random(-0.7, 0.7),
                color: colors[Math.floor(random(0, colors.length))],
                alpha: random(0.25, 0.7),
                radius: random(2, 6),
                glow: random(8, 24)
            };
        }
        for (var i = 0; i < NUM_PARTICLES; i++) particles.push(createParticle());

        var t = 0;
        var animate = () => {
            if (this._disposed || this._m === 1) {
                if (this._m === 1 && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            t += 0.016;

            // --- Flurry Curves (Quadratic) ---
            for (var i = 0; i < curves.length; i++) {
                var curve = curves[i];
                ctx.save();
                // Animate color, width, alpha
                var hue = (t * 40 + i * 60) % 360;
                ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
                ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t + curve.phase);
                ctx.lineWidth = 2 + 1.5 * Math.abs(Math.sin(t + curve.phase));
                ctx.beginPath();
                ctx.moveTo(curve.points[0].x, curve.points[0].y);
                for (var j = 1; j < curve.points.length - 2; j++) {
                    var xc = (curve.points[j].x + curve.points[j + 1].x) / 2;
                    var yc = (curve.points[j].y + curve.points[j + 1].y) / 2;
                    ctx.quadraticCurveTo(curve.points[j].x, curve.points[j].y, xc, yc);
                }
                ctx.quadraticCurveTo(
                    curve.points[curve.points.length - 2].x,
                    curve.points[curve.points.length - 2].y,
                    curve.points[curve.points.length - 1].x,
                    curve.points[curve.points.length - 1].y
                );
                ctx.shadowColor = ctx.strokeStyle;
                ctx.shadowBlur = 12;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
                for (var k = 0; k < curve.points.length; k++) {
                    var pt = curve.points[k];
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    if (pt.x < 0 || pt.x > canvas.width) pt.vx *= -1;
                    if (pt.y < 0 || pt.y > canvas.height) pt.vy *= -1;
                }
            }

            // --- Bezier Curves ---
            for (var i = 0; i < beziers.length; i++) {
                var bez = beziers[i];
                ctx.save();
                var hue = (t * 60 + i * 90) % 360;
                ctx.strokeStyle = `hsl(${hue}, 90%, 70%)`;
                ctx.globalAlpha = 0.3 + 0.2 * Math.cos(t + bez.phase);
                ctx.lineWidth = 1.5 + 1.2 * Math.abs(Math.cos(t + bez.phase));
                ctx.beginPath();
                ctx.moveTo(bez.points[0].x, bez.points[0].y);
                ctx.bezierCurveTo(
                    bez.points[1].x, bez.points[1].y,
                    bez.points[2].x, bez.points[2].y,
                    bez.points[3].x, bez.points[3].y
                );
                ctx.shadowColor = ctx.strokeStyle;
                ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
                for (var k = 0; k < bez.points.length; k++) {
                    var pt = bez.points[k];
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    if (pt.x < 0 || pt.x > canvas.width) pt.vx *= -1;
                    if (pt.y < 0 || pt.y > canvas.height) pt.vy *= -1;
                }
            }

            // --- Spirals ---
            for (var i = 0; i < spirals.length; i++) {
                var sp = spirals[i];
                ctx.save();
                var hue = (t * 80 + i * 120) % 360;
                ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
                ctx.globalAlpha = sp.alpha + 0.1 * Math.sin(t + sp.phase);
                ctx.lineWidth = sp.width + 0.5 * Math.abs(Math.sin(t + sp.phase));
                ctx.beginPath();
                var spiralPoints = 80;
                for (var j = 0; j < spiralPoints; j++) {
                    var angle = sp.angle + j * 0.2;
                    var radius = sp.radius + 8 * Math.sin(t + j * 0.1 + sp.phase);
                    var x = sp.cx + Math.cos(angle) * radius;
                    var y = sp.cy + Math.sin(angle) * radius;
                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.shadowColor = ctx.strokeStyle;
                ctx.shadowBlur = 8;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
                sp.angle += sp.speed;
            }

            // --- Polygons ---
            for (var i = 0; i < polygons.length; i++) {
                var poly = polygons[i];
                ctx.save();
                var hue = (t * 100 + i * 80) % 360;
                ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
                ctx.globalAlpha = poly.alpha + 0.1 * Math.cos(t + poly.rot);
                ctx.lineWidth = poly.width + 0.5 * Math.abs(Math.sin(t + poly.rot));
                ctx.beginPath();
                for (var j = 0; j <= poly.sides; j++) {
                    var angle = poly.rot + j * 2 * Math.PI / poly.sides;
                    var x = poly.cx + Math.cos(angle) * poly.r;
                    var y = poly.cy + Math.sin(angle) * poly.r;
                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.shadowColor = ctx.strokeStyle;
                ctx.shadowBlur = 6;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
                poly.rot += poly.rotSpeed;
            }

            // --- Particles (with Glow) ---
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                ctx.save();
                var hue = (t * 120 + i * 10) % 360;
                ctx.globalAlpha = p.alpha + 0.2 * Math.sin(t + i);
                ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
                ctx.shadowBlur = p.glow;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius + 1.5 * Math.abs(Math.sin(t + i)), 0, Math.PI * 2);
                ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.restore();
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            }

            requestAnimationFrame(animate);
        };
    animate();
    }

    /**
     * Starts the special code effect on the canvas.
     */
    _startEffectM() {
        this._m = 1; // Set effect active flag to true
        var canvas = this.getBody().querySelector('#flurry-canvas');
        if (!canvas) {
            if (typeof this.Log === 'function') this.Log("Effect canvas not found!", LogLevel.error);
            return;
        }
        var ctx = canvas.getContext('2d');

        var effectChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; 
        var effectFontSize = 16; 
        var effectColumns = canvas.width / effectFontSize; 
        var effectDrops = []; // Array to store y-position of each column's character

        // Initialize drops to random starting positions
        for (var x = 0; x < effectColumns; x++) {
            effectDrops[x] = Math.random() * canvas.height / effectFontSize;
        }

        var drawEffect = () => { // Formerly drawMatrix
            if (this._m === 0 || this._disposed) return; // Stop if effect is NOT active or disposed

            // Semi-transparent black rectangle to fade out previous frames
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#0F0"; // Green text
            ctx.font = `${effectFontSize}px monospace`;

            for (var i = 0; i < effectDrops.length; i++) {
                var text = effectChars.charAt(Math.floor(Math.random() * effectChars.length));
                ctx.fillText(text, i * effectFontSize, effectDrops[i] * effectFontSize);

                // Send the character back to the top randomly
                if (effectDrops[i] * effectFontSize > canvas.height && Math.random() > 0.975) {
                    effectDrops[i] = 0;
                }
                effectDrops[i]++;
            }

            requestAnimationFrame(drawEffect);
        };

        drawEffect(); // Start the effect animation loop

        // Set a timeout to automatically revert after a few seconds
        this._effectTimeout = setTimeout(() => {
            this._stopEffectM(); // Call obfuscated function
            // Do NOT call showPasswordOverlay() here. Return to background animation.
        }, 15000); // 15 seconds

        // Add a temporary key listener to stop the effect immediately
        this._effectDismissListener = (e) => {
            // Any key press will dismiss the effect
            this._stopEffectM(); // Call obfuscated function
            // Do NOT call showPasswordOverlay() here. Return to background animation.
            window.removeEventListener('keydown', this._effectDismissListener);
        };
        window.addEventListener('keydown', this._effectDismissListener);
    }

    /**
     * Stops the special code effect and cleans up.
     */
    _stopEffectM() {
        this._m = 0; // Set effect active flag to false
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
}


return { proc };
