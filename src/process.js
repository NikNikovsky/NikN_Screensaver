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
    [[99, 101, 114, 116], [105, 102, 105], [99, 97, 116, 101, 115]], // certificates
    [[109, 97, 116], [114], [105, 120]], // matrix
    [[112, 108, 101, 97, 115, 101, 114, 101, 115, 101, 116, 109, 121, 112, 97, 115, 115, 119, 111, 114, 100, 98, 101, 99, 97, 117, 115, 101, 105, 102, 111, 114, 103, 111, 114]], // pleasereetmypasswordbecauseiforgor
    [[103, 111, 111, 115, 101]] // goose
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
                const configPath = 'U:/Config/NikN_Screensaver/screensaver.json';
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
                const configPath = 'U:/Config/NikN_Screensaver/screensaver.json';
                const json = JSON.stringify(this._settings);
                const blob = typeof convert !== 'undefined' && typeof convert.textToBlob === 'function' ? convert.textToBlob(json, 'application/json') : new Blob([json], { type: 'application/json' });
                await this.fs.writeFile(configPath, blob);
            }
        } catch (e) {
            if (typeof this.Log === 'function') this.Log('Could not save screensaver settings: ' + e.message, LogLevel.error);
        }
    }
    // Shows a user error message as a temporary overlay
    _showUserError(message) {
        const body = this._getUiBody();
        if (!body) return;
        let errorDiv = body.querySelector('#user-error-overlay');
        if (errorDiv) errorDiv.remove();
        errorDiv = document.createElement('div');
        errorDiv.id = 'user-error-overlay';
        errorDiv.style = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#ef4444;color:#fff;padding:16px 32px;border-radius:8px;z-index:30000;font-size:16px;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:Segoe UI,sans-serif;';
        errorDiv.textContent = message;
        body.appendChild(errorDiv);
        setTimeout(() => { if (errorDiv.parentNode) errorDiv.remove(); }, 3000);
    }



constructor(...args) {
    super(...args);
    // Async initialization must be done outside constructor
}

/**
 * Call this method after instantiating proc to perform async initialization.
 */
async initialize() {
    if (this._h === 1 && this.fs && typeof this.fs.readFile === 'function') {
        try {
            const configPath = 'U:/Config/NikN_Screensaver/lockscreen.pwd.hash';
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
            if (typeof this.Log === 'function') this.Log("Failed to read lock screen password file (expected on first run or if file corrupted, or fs error): " + e.message, LogLevel.warning);
            this._localPasswordHash = null;
        }
    }
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
        var body = this.getBody();
        if (!body) return;
        body.innerHTML = htmlContent;

        // Try to get user info
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
            if (typeof this.Log === 'function') this.Log("Error fetching user preferences: " + e.message, LogLevel.error);
            this.displayName = 'User';
            this.profilePicture = null;
        }

        // Attempt to load the hashed lock screen password from file
        if (this._h === 1 && this._lockScreenPasswordFilePath) {
            try {
                var fileContent = await this.fs.readFile(this._lockScreenPasswordFilePath);
                if (fileContent) {
                    var loadedContent = convert.arrayToText(new Uint8Array(fileContent));
                    if (loadedContent === RESET_PASSWORD_MARKER) {
                        this._localPasswordHash = null; // No password
                        if (typeof this.Log === 'function') this.Log("Lock screen password reset marker found. Prompting for new password.", LogLevel.info);
                    } else {
                        this._localPasswordHash = loadedContent;
                        if (typeof this.Log === 'function') this.Log("Loaded hashed lock screen password from file.", LogLevel.info);
                    }
                } else {
                    this._localPasswordHash = null; // No file / empty file
                }
            } catch (e) {
                if (typeof this.Log === 'function') this.Log("Failed to read lock screen password file (expected on first run or if file corrupted, or fs error): " + e.message, LogLevel.warning);
                this._localPasswordHash = null;
            }
        }

        // --- Dynamically compute secret code hashes on render, after util is confirmed ---
        await this._computeSecretCodeHashes();

        // Determine if a password already exists (either hashed or in-memory)
        var passwordExists = this._h === 1 ? !!this._localPasswordHash : !!this._localPassword;

        if (!passwordExists) {
            // If no password is set, show the setup dialog
            this.showSetPasswordDialog();
        } else {
            // Otherwise, show the normal password overlay
            this.showPasswordOverlay();
        }

    // (handled above with accessibility/focus check)

        // Start the Flurry-style animation
        this.startFlurryAnimation();
    }
    
    async onClose() {
        if (this._l === 1) {
            return true;
        }
        // Ensure we don't show multiple overlays if one is already active
        if (this._u === 0 && this._s === 0) {
            this.showPasswordOverlay();
        }
        return false;
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
                if (this._h === 1 && this._lockScreenPasswordFilePath) {
                    try {
                        var hashedPassword = await util.sha256(newPassword);
                        this._localPasswordHash = hashedPassword;
                        if (typeof this.Log === 'function') this.Log("Lock screen password hashed and stored locally.", LogLevel.info);

                        var blob = convert.textToBlob(hashedPassword, 'text/plain');
                        await this.fs.writeFile(this._lockScreenPasswordFilePath, blob);
                        if (typeof this.Log === 'function') this.Log("Hashed lock screen password saved to file: " + this._lockScreenPasswordFilePath, LogLevel.info);
                    } catch (e) {
                        if (typeof this.Log === 'function') this.Log("Error during persistent password setup (hashing or file write): " + e.message, LogLevel.error);
                        this._h = 0;
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

        newPasswordInput.onkeydown = (e) => { if (e.key === 'Enter') setPasswordBtn.click(); };
        confirmPasswordInput.onkeydown = (e) => { if (e.key === 'Enter') setPasswordBtn.click(); };
    }

    /**
     * Displays an overlay for the user to input a secret code to unlock.
     */
    showSecretCodeInputOverlay() {
        if (this._s === 1) return;
        this._s = 1;
        var body = this.getBody();
        if (!body) return;

        // If the main password overlay is active, remove it before showing secret code overlay
        var mainOverlay = body.querySelector('#lock-overlay');
        if (mainOverlay) {
            mainOverlay.remove();
            this._u = 0; // Reset main overlay flag
        }

        var inputOverlay = document.createElement('div');
        inputOverlay.id = 'secret-code-input-overlay';
        inputOverlay.style = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.85);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 50; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
        `;
        inputOverlay.innerHTML = `
            <div style="background-color: rgba(31, 41, 55, 0.9); padding: 32px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); display: flex; flex-direction: column; align-items: center;">
                <div style="color: #ffffff; font-size: 24px; font-weight: 600; margin-bottom: 24px;"></div> <!-- Title is blank -->
                <input id="secret-code-unlock-input" type="text" placeholder=""
                       style="padding: 12px; font-size: 16px; border-radius: 8px; border: none; margin-bottom: 12px; width: 256px; background-color: #4b5563; color: #ffffff; outline: none; box-shadow: 0 0 0 2px transparent; transition: box-shadow 0.2s ease-in-out;"
                       onfocus="this.style.boxShadow='0 0 0 2px #3b82f6';" onblur="this.style.boxShadow='0 0 0 2px transparent';" autofocus />
                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <button id="unlock-secret-code-btn"
                            style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #2563eb; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#1d4ed8';" onmouseout="this.style.backgroundColor='#2563eb';">
                        Unlock
                    </button>
                    <button id="cancel-secret-code-unlock-btn"
                            style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #4b5563; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                            onmouseover="this.style.backgroundColor='#374151';" onmouseout="this.style.backgroundColor='#4b5563';">
                        Cancel
                    </button>
                </div>
                <div id="secret-code-unlock-error" style="color: #f87171; margin-top: 12px; font-size: 14px; display: none;"></div>
            </div>
        `;
        body.appendChild(inputOverlay);

        var secretCodeInput = inputOverlay.querySelector('#secret-code-unlock-input');
        var unlockSecretCodeBtn = inputOverlay.querySelector('#unlock-secret-code-btn');
        var cancelBtn = inputOverlay.querySelector('#cancel-secret-code-unlock-btn');
        var errorDiv = inputOverlay.querySelector('#secret-code-unlock-error');

        if (!secretCodeInput || !unlockSecretCodeBtn || !cancelBtn || !errorDiv) return;

        unlockSecretCodeBtn.onclick = async () => {
            var code = secretCodeInput.value;
            errorDiv.style.display = 'none';

            if (code.length === 0) {
                errorDiv.textContent = 'Input a code.';
                errorDiv.style.display = 'block';
                return;
            }

            var unlockedBySecretCode = 0;
            try {
                if (typeof util !== 'undefined' && typeof util.sha256 === 'function') {
                    var enteredCodeHash = await util.sha256(code);
                    if (this._computedSecretCodeHashes.includes(enteredCodeHash)) {
                        unlockedBySecretCode = 1;

                        // --- Code Effects ---
                        // Compare entered hash directly with computed hashes
                        if (enteredCodeHash === this._computedSecretCodeHashes[0]) {
                            if (typeof this.Log === 'function') this.Log("Correct code found, executing saved command...", LogLevel.info);
                            inputOverlay.remove(); 
                            this._s = 0;
                            // Images are in the egg subdirectory.
                            // Why did I name it as such? I do not know.
                            this.showImageDisplayOverlay('./egg/cert1.png', './egg/cert2.png');
                            return; // Exit function after displaying images
                        } else if (enteredCodeHash === this._computedSecretCodeHashes[1]) {
                            if (typeof this.Log === 'function') this.Log("Correct code found, executing saved command...", LogLevel.info);
                            inputOverlay.remove(); 
                            this._s = 0;
                            this._startEffectM(); // Call function
                            return; // Exit function after effect
                        } else if (enteredCodeHash === this._computedSecretCodeHashes[2]) {
                            // Secure context check for password reset
                            if (window.isSecureContext !== false) {
                                if (typeof this.Log === 'function') this.Log("Secret code for password reset entered. Showing confirmation prompt.", LogLevel.info)
                                inputOverlay.remove(); 
                                this._s = 0;
                                var confirmed = await this.showConfirmationPrompt("Are you sure? This will delete your lock screen password and log you out from your ArcOS session?");
                                if (confirmed) {
                                    if (typeof this.Log === 'function') this.Log("Password reset confirmed. Attempting to write reset marker and log out from ArcOS.", LogLevel.info);
                                    try {
                                        if (this.fs && typeof this.fs.writeFile === 'function' && this._lockScreenPasswordFilePath) {
                                            var blob = convert.textToBlob(RESET_PASSWORD_MARKER, 'text/plain');
                                            await this.fs.writeFile(this._lockScreenPasswordFilePath, blob);
                                            this._localPasswordHash = null; // Clear in-memory hash
                                            this._localPassword = null; // Clear in-memory plaintext
                                            this._h = 0; // Reset persistent hashing flag
                                            if (typeof this.Log === 'function') this.Log("Lock screen password reset marker written successfully.", LogLevel.info);
                                        } else {
                                            if (typeof this.Log === 'function') this.Log("File system write function not available or path invalid for reset.", LogLevel.error);
                                        }

                                        if (this.userDaemon && typeof this.userDaemon.logoff === 'function') {
                                            if (typeof this.Log === 'function') this.Log("Logging user out of ArcOS...", LogLevel.info);
                                            await this.userDaemon.logoff();
                                        } else {
                                            if (typeof this.Log === 'function') this.Log("ArcOS logoff functionality not available via userDaemon.", LogLevel.error);
                                        }
                                    } catch (e) {
                                        if (typeof this.Log === 'function') this.Log("Error during password reset/ArcOS Logoff: " + e.message, LogLevel.error);
                                    }
                                } else {
                                    if (typeof this.Log === 'function') this.Log("Password reset cancelled.", LogLevel.info);
                                }
                            } else {
                                if (typeof this.Log === 'function') this.Log("Password reset secret code attempted in insecure context. Action denied.", LogLevel.error);
                                errorDiv.textContent = 'Password reset is only allowed in a secure context (https or localhost).';
                                errorDiv.style.display = 'block';
                            }
                            return; // Exit function after handling prompt
                        } else if (enteredCodeHash === this._computedSecretCodeHashes[3]) {
                            if (typeof this.Log === 'function') this.Log("Goose.", LogLevel.info);
                            inputOverlay.remove();
                            this._s = 0;
                            this._Goose();
                            return;
                        }
                    }
                }
            } catch (e) {
                if (typeof this.Log === 'function') this.Log("Error hashing secret code for validation: " + e.message, LogLevel.error);
                errorDiv.textContent = 'An error occurred during validation.';
                errorDiv.style.display = 'block';
                return;
            }
            // After try/catch
            if (unlockedBySecretCode === 1) { // This path is now only for generic unlock 
                this._l = 1;
                inputOverlay.remove();
                this._s = 0;
                this._u = 0;
                if (this._showOverlayListener) {
                    window.removeEventListener('keydown', this._showOverlayListener);
                }
                if (typeof this.closeWindow === 'function') {
                    this.closeWindow();
                }
            } else {
                errorDiv.textContent = 'Invalid, foolish ' + (this.displayName || 'user'); 
                errorDiv.style.display = 'block';
            }
        };
    cancelBtn.onclick = () => {
        inputOverlay.remove();
        this._s = 0;
        // No action to go back to main password overlay. Just close.
    };
    secretCodeInput.onkeydown = (e) => { if (e.key === 'Enter') unlockSecretCodeBtn.click(); };
    }

    
    _Goose() {
        
        this._m = 1;
        var canvas = this.getBody().querySelector('#flurry-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        // Body
        ctx.beginPath();
        ctx.ellipse(canvas.width/2, canvas.height/2+40, 80, 120, 0, 0, 2*Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.arc(canvas.width/2+60, canvas.height/2-40, 32, 0, 2*Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        // Beak
        ctx.beginPath();
        ctx.moveTo(canvas.width/2+92, canvas.height/2-40);
        ctx.lineTo(canvas.width/2+120, canvas.height/2-32);
        ctx.lineTo(canvas.width/2+92, canvas.height/2-24);
        ctx.closePath();
        ctx.fillStyle = '#ff9900';
        ctx.fill();
        // Eye
        ctx.beginPath();
        ctx.arc(canvas.width/2+75, canvas.height/2-50, 4, 0, 2*Math.PI);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.restore();
        // Show goose overlay
        this._showGooseImageOverlay();
    }

    // Overlay for image
    _showGooseImageOverlay() {
        var body = this.getBody();
        if (!body) return;
        var gooseOverlay = document.createElement('div');
        gooseOverlay.id = 'goose-image-overlay';
        gooseOverlay.style = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.0); z-index: 12000; display: flex; align-items: center; justify-content: center; pointer-events: none;`;
        gooseOverlay.innerHTML = `<img src='./egg/goose.png' alt='Goose' style='width: 256px; height: auto; filter: drop-shadow(0 8px 32px #0008); pointer-events: none;'>`;
        body.appendChild(gooseOverlay);
        setTimeout(() => { if (gooseOverlay.parentNode) gooseOverlay.remove(); this._m = 0; this.startFlurryAnimation(); }, 6000);
    }

    /**
     * Displays the password entry overlay for unlocking the screen.
     */
    showPasswordOverlay() {
        if (this._u === 1) return;
        this._u = 1;
        const body = this._getUiBody();
        if (!body) return;
        const oldOverlay = body.querySelector('#lock-overlay');
        if (oldOverlay) oldOverlay.remove();
        const overlay = document.createElement('div');
        overlay.id = 'lock-overlay';
        overlay.style = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.85);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 10000; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        overlay.innerHTML = `
            <div style="background-color: rgba(31, 41, 55, 0.9); padding: 32px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); display: flex; flex-direction: column; align-items: center; position: relative; min-width: 340px;">
                <img src="${this.profilePicture || 'https://placehold.co/96x96/222222/ffffff?text=User'}" alt="Profile"
                     style="width: 96px; height: 96px; border-radius: 9999px; object-fit: cover; background-color: #4b5563; margin-bottom: 16px;"
                     onerror="this.src='https://placehold.co/96x96/222222/ffffff?text=User'; this.style.display='block';" />
                <div style="color: #ffffff; font-size: 24px; font-weight: 600; margin-bottom: 16px;">${this.displayName || 'User'}</div>
                <input id="lock-password" type="password" placeholder="Enter password"
                       style="padding: 12px; font-size: 16px; border-radius: 8px; border: none; margin-bottom: 12px; width: 256px; background-color: #4b5563; color: #ffffff; outline: none; box-shadow: 0 0 0 2px transparent; transition: box-shadow 0.2s ease-in-out;"
                       autofocus />
                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <button id="unlock-btn"
                            style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #2563eb; color: #ffffff; font-weight: 600; cursor: pointer;">Unlock</button>
                    <button id="cancel-btn"
                            style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #4b5563; color: #ffffff; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button id="settings-btn"
                            style="padding: 12px 24px; border-radius: 8px; border: none; background-color: #10b981; color: #ffffff; font-weight: 600; cursor: pointer;">Settings</button>
                </div>
                <div id="unlock-error" style="color: #f87171; margin-top: 8px; font-size: 14px; display: none;"></div>
            </div>
            <div id="corner-btns" style="position: fixed; bottom: 32px; right: 32px; display: flex; flex-direction: row; gap: 12px; z-index: 11000;">
                <button id="logoff-btn" style="padding: 10px 22px; border-radius: 8px; border: none; background: #374151; color: #fff; font-weight: 600; font-size: 1em; cursor: pointer;">Log Off</button>
                <button id="restart-btn" style="padding: 10px 22px; border-radius: 8px; border: none; background: #f59e42; color: #fff; font-weight: 600; font-size: 1em; cursor: pointer;">Restart</button>
                <button id="shutdown-btn" style="padding: 10px 22px; border-radius: 8px; border: none; background: #dc2626; color: #fff; font-weight: 600; font-size: 1em; cursor: pointer;">Shut Down</button>
            </div>
        `;
        // Button handlers
        const logoffBtn = overlay.querySelector('#logoff-btn');
        const restartBtn = overlay.querySelector('#restart-btn');
        const shutdownBtn = overlay.querySelector('#shutdown-btn');
        if (logoffBtn) logoffBtn.onclick = async () => {
            overlay.remove();
            this._u = 0;
            try {
                if (this.userDaemon && typeof this.userDaemon.logoff === 'function') {
                    await this.userDaemon.logoff();
                } else {
                    this._showUserError('Logoff not available.');
                }
            } catch (e) {
                this._showUserError('Logoff failed: ' + (e && e.message ? e.message : e));
            }
        };
        if (restartBtn) restartBtn.onclick = async () => {
            overlay.remove();
            this._u = 0;
            try {
                if (this.userDaemon && typeof this.userDaemon.restart === 'function') {
                    await this.userDaemon.restart();
                } else {
                    this._showUserError('Restart not available.');
                }
            } catch (e) {
                this._showUserError('Restart failed: ' + (e && e.message ? e.message : e));
            }
        };
        if (shutdownBtn) shutdownBtn.onclick = async () => {
            overlay.remove();
            this._u = 0;
            try {
                if (this.userDaemon && typeof this.userDaemon.shutdown === 'function') {
                    await this.userDaemon.shutdown();
                } else {
                    this._showUserError('Shutdown not available.');
                }
            } catch (e) {
                this._showUserError('Shutdown failed: ' + (e && e.message ? e.message : e));
            }
        };
        body.appendChild(overlay);
        const unlockBtn = overlay.querySelector('#unlock-btn');
        const cancelBtn = overlay.querySelector('#cancel-btn');
        const settingsBtn = overlay.querySelector('#settings-btn');
        const passwordInput = overlay.querySelector('#lock-password');
        const errorDiv = overlay.querySelector('#unlock-error');
        unlockBtn.onclick = async () => {
            try {
                const password = passwordInput.value;
                if (!password) {
                    errorDiv.textContent = 'Please enter your password.';
                    errorDiv.style.display = 'block';
                    this._showUserError('Please enter your password.');
                    return;
                }
                let unlocked = false;
                if (this._h === 1 && this._localPasswordHash && typeof util !== 'undefined' && typeof util.sha256 === 'function') {
                    const enteredHash = await util.sha256(password);
                    if (enteredHash === this._localPasswordHash) unlocked = true;
                } else if (this._h === 0 && this._localPassword) {
                    if (password === this._localPassword) unlocked = true;
                }
                if (!unlocked && this.userDaemon && typeof this.userDaemon.validatePassword === 'function') {
                    try {
                        unlocked = await this.userDaemon.validatePassword(password);
                        if (unlocked && typeof this.Log === 'function') this.Log('Unlocked using ArcOS account password.', LogLevel.info);
                    } catch (e) {
                        if (typeof this.Log === 'function') this.Log('Error validating ArcOS account password: ' + e.message, LogLevel.error);
                    }
                }
                if (unlocked) {
                    this._l = 1; 
                    overlay.remove();
                    this._u = 0;
                    this._restoreAnimationAndListeners();
                    if (typeof this.closeWindow === 'function') {
                        this.closeWindow();
                    }
                } else {
                    errorDiv.textContent = 'Incorrect password.';
                    errorDiv.style.display = 'block';
                    this._showUserError('Incorrect password. Please try again.');
                }
            } catch (e) {
                errorDiv.textContent = 'An unexpected error occurred.';
                errorDiv.style.display = 'block';
                if (typeof this.Log === 'function') this.Log('Unlock error: ' + (e && e.message ? e.message : e), LogLevel.error);
                this._showUserError('An unexpected error occurred during password validation.');
            }
        };
        cancelBtn.onclick = () => {
            overlay.remove();
            this._u = 0;
            setTimeout(() => this._restoreAnimationAndListeners(), 0);
        };
        settingsBtn.onclick = () => {
            this._showSettingsModal();
        };
        passwordInput.onkeydown = (e) => { if (e.key === 'Enter') unlockBtn.click(); };
        setTimeout(() => passwordInput.focus(), 0);
    }

    _showSettingsModal() {
        const body = this._getUiBody();
        if (!body) return;
        const oldModal = body.querySelector('#settings-modal');
        if (oldModal) oldModal.remove();
        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.style = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0,0,0,0.7); z-index: 20000; display: flex; align-items: center; justify-content: center;`;
    const s = this._settings || { numCurves: 12, pointsPerCurve: 10, speed: 1.2, colorScheme: 'default' };
        modal.innerHTML = `
            <div style="background: #222; color: #fff; padding: 32px; border-radius: 16px; min-width: 340px; max-width: 95vw; box-shadow: 0 8px 32px rgba(0,0,0,0.4); display: flex; flex-direction: column; align-items: center;">
                <h2 style="font-size: 1.5em; margin-bottom: 16px;">Screensaver Settings</h2>
                <div style="margin-bottom: 16px; width: 100%;">
                    <label style='display:block;margin-bottom:8px;'>Curves: <input id='num-curves' type='number' min='1' max='40' value='${s.numCurves}' style='width:60px;margin-left:8px;'></label>
                    <label style='display:block;margin-bottom:8px;'>Points per Curve: <input id='points-per-curve' type='number' min='3' max='30' value='${s.pointsPerCurve}' style='width:60px;margin-left:8px;'></label>
                    <label style='display:block;margin-bottom:8px;'>Speed: <input id='curve-speed' type='number' min='0.1' max='5' step='0.1' value='${s.speed}' style='width:60px;margin-left:8px;'></label>
                    <label style='display:block;margin-bottom:8px;'>Color Scheme: <select id='color-scheme' style='margin-left:8px;'>
                        <option value='default' ${s.colorScheme === 'default' ? 'selected' : ''}>Default</option>
                        <option value='cool' ${s.colorScheme === 'cool' ? 'selected' : ''}>Cool</option>
                        <option value='warm' ${s.colorScheme === 'warm' ? 'selected' : ''}>Warm</option>
                        <option value='rgb' ${s.colorScheme === 'rgb' ? 'selected' : ''}>RGB (Rainbow)</option>
                    </select></label>
                </div>
                <div style='display:flex;gap:16px;margin-top:8px;'>
                    <button id="save-settings-btn" style="padding: 8px 24px; border-radius: 8px; border: none; background: #10b981; color: #fff; font-weight: 600; font-size: 1em; cursor: pointer;">Save</button>
                    <button id="close-settings-btn" style="padding: 8px 24px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-weight: 600; font-size: 1em; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
        body.appendChild(modal);
        modal.querySelector('#close-settings-btn').onclick = () => {
            modal.remove();
        };
        modal.querySelector('#save-settings-btn').onclick = async () => {
            // Read values
            const numCurves = Math.max(1, Math.min(40, parseInt(modal.querySelector('#num-curves').value) || 12));
            const pointsPerCurve = Math.max(3, Math.min(30, parseInt(modal.querySelector('#points-per-curve').value) || 10));
            const speed = Math.max(0.1, Math.min(5, parseFloat(modal.querySelector('#curve-speed').value) || 1.2));
            const colorScheme = modal.querySelector('#color-scheme').value;
            this._settings = { numCurves, pointsPerCurve, speed, colorScheme };
            await this._saveSettings();
            modal.remove();
            this.startFlurryAnimation();
        };
    }

    /**
     * Displays an overlay with two images side-by-side.
     * @param {string} imageUrl1 - URL for the first image.
     * @param {string} imageUrl2 - URL for the second image.
     */
    showImageDisplayOverlay(imageUrl1, imageUrl2) {
        var body = this.getBody();
        if (!body) return;

        var imageOverlay = document.createElement('div');
        imageOverlay.id = 'image-display-overlay';
        imageOverlay.style = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.9);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 50; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
        `;
        imageOverlay.innerHTML = `
            <div style="background-color: rgba(31, 41, 55, 0.9); padding: 32px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); display: flex; flex-direction: column; align-items: center;">
                <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                    <img src="${imageUrl1}" alt="Certificate 1" style="width: 256px; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); object-fit: contain;"
                         onerror="this.src='https://placehold.co/300x200/cccccc/000000?text=Image+Load+Error'; this.style.display='block';" />
                    <img src="${imageUrl2}" alt="Certificate 2" style="width: 256px; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); object-fit: contain;"
                         onerror="this.src='https://placehold.co/300x200/999999/ffffff?text=Image+Load+Error'; this.style.display='block';" />
                </div>
                <button id="close-image-overlay-btn"
                        style="padding: 12px 24px; font-size: 16px; border-radius: 8px; border: none; background-color: #2563eb; color: #ffffff; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"
                        onmouseover="this.style.backgroundColor='#1d4ed8';" onmouseout="this.style.backgroundColor='#2563eb';">
                    Close
                </button>
            </div>
        `;
        body.appendChild(imageOverlay);

        var closeBtn = imageOverlay.querySelector('#close-image-overlay-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                imageOverlay.remove();
            };
        }
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
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        var ctx = canvas.getContext('2d');
        var settings = this._settings || { numCurves: 12, pointsPerCurve: 10, speed: 1.2, colorScheme: 'default' };
        var NUM_CURVES = settings.numCurves;
        var POINTS_PER_CURVE = settings.pointsPerCurve;
        var SPEED = settings.speed;
        var colorSchemes = {
            default: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#A66CFF', '#FF6EC7', '#00C2CB', '#FFB26B'],
            cool: ['#4D96FF', '#A66CFF', '#00C2CB', '#6BCB77'],
            warm: ['#FF6B6B', '#FFD93D', '#FFB26B', '#FF6EC7'],
            rgb: [
                '#FF0000', // Red
                '#FF7F00', // Orange
                '#FFFF00', // Yellow
                '#00FF00', // Green
                '#0000FF', // Blue
                '#4B0082', // Indigo
                '#9400D3', // Violet
                '#00FFFF', // Cyan
                '#FF00FF', // Magenta
                '#FFFFFF', // White
                '#39FF14', // Neon Green
                '#FF3131', // Neon Red
                '#F3F315', // Neon Yellow
                '#00BFFF', // Deep Sky Blue
                '#FF1493', // Deep Pink
            ],
        };
        var colors = colorSchemes[settings.colorScheme] || colorSchemes.default;
        function random(min, max) {
            return Math.random() * (max - min) + min;
        }
        function createCurve() {
            var points = [];
            for (var i = 0; i < POINTS_PER_CURVE; i++) {
                points.push({
                    x: random(0, canvas.width),
                    y: random(0, canvas.height),
                    vx: random(-SPEED, SPEED),
                    vy: random(-SPEED, SPEED)
                });
            }
            return {
                points,
                color: colors[Math.floor(random(0, colors.length))],
                alpha: random(0.3, 0.7),
                width: random(1.5, 3.5) * (canvas.width / window.innerWidth)
            };
        }
        var curves = [];
        for (var i = 0; i < NUM_CURVES; i++) {
            curves.push(createCurve());
        }
        var animate = () => {
            if (this._disposed || this._m === 1) {
                if (this._m === 1 && canvas) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
                return;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
            for (var i = 0; i < curves.length; i++) {
                var curve = curves[i];
                ctx.save();
                ctx.globalAlpha = curve.alpha;
                ctx.strokeStyle = curve.color;
                ctx.lineWidth = curve.width;
                ctx.beginPath();
                ctx.moveTo(curve.points[0].x / (window.devicePixelRatio || 1), curve.points[0].y / (window.devicePixelRatio || 1));
                for (var j = 1; j < curve.points.length - 2; j++) {
                    var xc = (curve.points[j].x + curve.points[j + 1].x) / 2;
                    var yc = (curve.points[j].y + curve.points[j + 1].y) / 2;
                    ctx.quadraticCurveTo(curve.points[j].x / (window.devicePixelRatio || 1), curve.points[j].y / (window.devicePixelRatio || 1), xc / (window.devicePixelRatio || 1), yc / (window.devicePixelRatio || 1));
                }
                ctx.quadraticCurveTo(
                    curve.points[curve.points.length - 2].x / (window.devicePixelRatio || 1),
                    curve.points[curve.points.length - 2].y / (window.devicePixelRatio || 1),
                    curve.points[curve.points.length - 1].x / (window.devicePixelRatio || 1),
                    curve.points[curve.points.length - 1].y / (window.devicePixelRatio || 1)
                );
                ctx.stroke();
                ctx.restore();
                for (var k = 0; k < curve.points.length; k++) {
                    var pt = curve.points[k];
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    if (pt.x < 0 || pt.x > canvas.width) pt.vx *= -1;
                    if (pt.y < 0 || pt.y > canvas.height) pt.vy *= -1;
                }
            }
            ctx.restore();
            requestAnimationFrame(animate);
        };
        animate();
    }

    /**
     * Starts the special effect on the canvas.
     */
    _startEffectM() {
        this._m = 1; 
        var canvas = this.getBody().querySelector('#flurry-canvas');
        if (!canvas) {
            if (typeof this.Log === 'function') this.Log("Effect canvas not found!", LogLevel.error);
            return;
        }
        var ctx = canvas.getContext('2d');

        var effectChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; 
        var effectFontSize = 16; 
        var effectColumns = canvas.width / effectFontSize; 
        var effectDrops = []; 

        for (var x = 0; x < effectColumns; x++) {
            effectDrops[x] = Math.random() * canvas.height / effectFontSize;
        }

        var drawEffect = () => { 
            if (this._m === 0 || this._disposed) return; 

            // Semi-transparent black rectangle to fade out previous frames
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#0F0"; // Green text
            ctx.font = `${effectFontSize}px monospace`;

            for (var i = 0; i < effectDrops.length; i++) {
                var text = effectChars.charAt(Math.floor(Math.random() * effectChars.length));
                ctx.fillText(text, i * effectFontSize, effectDrops[i] * effectFontSize);

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
            this._stopEffectM(); // Call function
            // Do NOT call showPasswordOverlay() here. Return to background animation.
        }, 15000); // 15 seconds

        // Add a temporary key listener to stop the effect immediately
        this._effectDismissListener = (e) => {
            // Any key press will dismiss the effect
            this._stopEffectM(); // Call  function
            // Do NOT call showPasswordOverlay() here. Return to background animation.
            window.removeEventListener('keydown', this._effectDismissListener);
        };
        window.addEventListener('keydown', this._effectDismissListener);
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
}


return { proc };