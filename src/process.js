// Assume loadHtml is a utility function that loads HTML content.
// For this example, we'll define a simple body.html content directly.
const htmlContent = `
    <div id="app-container" style="width: 100vw; height: 100vh; overflow: hidden; position: relative; font-family: 'Inter', sans-serif;">
        <canvas id="flurry-canvas" style="display: block;"></canvas>
    </div>
`;

// Pre-computed SHA256 hashes for the secret easter egg codes.
const HARDCODED_SECRET_CODE_HASHES = [
    "51639d4e138c201734f4d2f1f0a2e5d9c2a8f8e7f1b2c3d4e5f6a7b8c9d0e1f2",
    "851080b4352b2b1a1c31d6d4a2d8e9f0c1b2a3e4d5f6a7b8c9d0e1f2a3b4c5d6"  
];

// This class extends ThirdPartyAppProcess, which is assumed to provide
// methods like getBody(), userPreferences(), userDaemon, handler, closeWindow.
class proc extends ThirdPartyAppProcess {
    constructor(handler, pid, parentPid, app, workingDirectory, ...args) {
        super(handler, pid, parentPid, app, workingDirectory);
        this.unlocking = false; // Flag to indicate if the password overlay is active
        this.unlocked = false;  // Flag to indicate if the app is unlocked
        this.profilePicture = null; // User's profile picture URL
        this.displayName = null;    // User's display name
        this._showOverlayListener = null; // Listener for space key

        this._localPasswordHash = null; // Stores SHA256 hash if persistent storage is used for main password
        this._localPassword = null;     // Stores plaintext password in-memory if persistent storage fails for main password

        this._secretCodeOverlayActive = false; // Flag for secret code input overlay state

        // Define file path for the main lock screen password within the app's working directory
        this._lockScreenPasswordFilePath = this.workingDirectory + '/lockscreen.pwd.hash';
        console.log("Lock screen password file path set to:", this._lockScreenPasswordFilePath);

        this._canUsePersistentHashing = false; // Determined during constructor/render

        // --- Initial Feature Detection for Persistent Hashing ---
        try {
            if (typeof util !== 'undefined' && typeof util.sha256 === 'function' &&
                typeof convert !== 'undefined' && typeof convert.arrayToText === 'function' && typeof convert.textToBlob === 'function' &&
                this.fs && typeof this.fs.readFile === 'function' && typeof this.fs.writeFile === 'function') {

                this._canUsePersistentHashing = true;
                console.log("Persistent hashing and file system operations are initially detected as available.");
            } else {
                console.warn("Initial check: Some core utilities for persistent hashing are not fully available. Will fall back to in-memory password storage.");
                if (typeof util === 'undefined' || typeof util.sha256 !== 'function') console.warn("  - util.sha256 missing or not a function.");
                if (typeof convert === 'undefined' || typeof convert.arrayToText !== 'function' || typeof convert.textToBlob !== 'function') console.warn("  - convert.arrayToText or convert.textToBlob missing or not a function.");
                if (!this.fs || typeof this.fs.readFile !== 'function' || typeof this.fs.writeFile !== 'function') console.warn("  - this.fs or its readFile/writeFile methods missing or not functions.");
            }
        } catch (e) {
            console.error("Error during initial utility check for persistent hashing:", e);
            this._canUsePersistentHashing = false;
        }
    }

    /**
     * Renders the initial application UI.
     * It sets up the lock screen, checks for password existence, and starts the animation.
     */
    async render() {
        const body = this.getBody();
        if (!body) return;
        body.innerHTML = htmlContent;

        // Try to get user info (profile picture and display name)
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
            console.error("Error fetching user preferences:", e);
            this.displayName = 'User';
            this.profilePicture = null;
        }

        // Attempt to load the hashed lock screen password from file
        if (this._canUsePersistentHashing && this._lockScreenPasswordFilePath) {
            try {
                const fileContent = await this.fs.readFile(this._lockScreenPasswordFilePath);
                if (fileContent) {
                    this._localPasswordHash = convert.arrayToText(new Uint8Array(fileContent));
                    console.log("Loaded hashed lock screen password from file.");
                }
            } catch (e) {
                console.warn("Failed to read lock screen password file (expected on first run or if file corrupted, or fs error):", e);
                this._localPasswordHash = null;
            }
        }

        // Determine if a password already exists (either hashed or in-memory)
        const passwordExists = this._canUsePersistentHashing ? !!this._localPasswordHash : !!this._localPassword;

        if (!passwordExists) {
            // If no lock screen password is set, show the setup dialog
            this.showSetPasswordDialog();
        } else {
            // Otherwise, show the normal password overlay
            this.showPasswordOverlay();
        }

        // Listen for space key to show password overlay
        this._showOverlayListener = (e) => {
            if (!this.unlocking && !this.unlocked && (e.code === 'Space' || e.key === ' ')) {
                this.showPasswordOverlay();
            }
        };
        window.addEventListener('keydown', this._showOverlayListener);

        // Listen for Alt + I for secret code input
        this._secretCodeKeyListener = (e) => {
            // Only trigger if not already unlocking or unlocked, and Alt+I is pressed
            if (!this.unlocking && !this.unlocked && e.altKey && e.key === 'i') {
                e.preventDefault(); // Prevent default browser action for Alt+I
                this.showSecretCodeInputOverlay(); // Always show input for hardcoded codes
            }
        };
        window.addEventListener('keydown', this._secretCodeKeyListener);

        // Start the Flurry-style animation
        this.startFlurryAnimation();
    }

    /**
     * Handles the application closing event.
     * Prevents closing unless the app is unlocked.
     * @returns {boolean} True if the app can close, false otherwise.
     */
    async onClose() {
        if (this.unlocked) {
            return true;
        }
        // Ensure we don't show multiple overlays if one is already active
        if (!this.unlocking && !this._secretCodeOverlayActive) {
            this.showPasswordOverlay();
        }
        return false;
    }

    /**
     * Displays a dialog for the user to set their lock screen password for the first time.
     */
    showSetPasswordDialog() {
        const body = this.getBody();
        if (!body) return;

        let setupOverlay = document.createElement('div');
        setupOverlay.id = 'set-password-overlay';
        setupOverlay.className = 'fixed inset-0 bg-black bg-opacity-85 flex flex-col items-center justify-center z-50 font-inter';
        setupOverlay.innerHTML = `
            <div class="bg-gray-800 bg-opacity-90 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                <div class="text-white text-2xl font-semibold mb-6">Set Your Lock Screen Password</div>
                <div class="text-gray-300 text-sm mb-4 text-center">
                    Please set a new password for this lock screen. It must be at least 4 characters long and contain no spaces.
                    This password is separate from your account password.
                </div>
                <input id="new-password-input" type="password" placeholder="New Password"
                       class="p-3 text-base rounded-lg border-none mb-3 w-64 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" autofocus />
                <input id="confirm-password-input" type="password" placeholder="Confirm Password"
                       class="p-3 text-base rounded-lg border-none mb-4 w-64 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button id="set-password-btn"
                        class="px-6 py-3 text-base rounded-lg border-none bg-blue-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-blue-700 shadow-md">
                    Set Password
                </button>
                <div id="set-password-error" class="text-red-400 mt-3 text-sm hidden"></div>
            </div>
        `;
        body.appendChild(setupOverlay);

        const newPasswordInput = setupOverlay.querySelector('#new-password-input');
        const confirmPasswordInput = setupOverlay.querySelector('#confirm-password-input');
        const setPasswordBtn = setupOverlay.querySelector('#set-password-btn');
        const errorDiv = setupOverlay.querySelector('#set-password-error');

        if (!newPasswordInput || !confirmPasswordInput || !setPasswordBtn || !errorDiv) return;

        setPasswordBtn.onclick = async () => {
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

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
                        const hashedPassword = await util.sha256(newPassword);
                        this._localPasswordHash = hashedPassword;
                        console.log("Lock screen password hashed and stored locally.");

                        const blob = convert.textToBlob(hashedPassword, 'text/plain');
                        await this.fs.writeFile(this._lockScreenPasswordFilePath, blob);
                        console.log("Hashed lock screen password saved to file:", this._lockScreenPasswordFilePath);
                    } catch (e) {
                        console.error("Error during persistent password setup (hashing or file write):", e);
                        this._canUsePersistentHashing = false;
                        this._localPassword = newPassword;
                    }
                } else {
                    this._localPassword = newPassword;
                    console.warn("Persistent hashing not available. Lock screen password stored in memory for this session.");
                }

                setupOverlay.remove();
                this.showPasswordOverlay();
            } catch (e) {
                errorDiv.textContent = 'Failed to set password. An unexpected error occurred. Please check console.';
                errorDiv.style.display = 'block';
                console.error("General error during password setup:", e);
            }
        };

        newPasswordInput.onkeydown = (e) => { if (e.key === 'Enter') setPasswordBtn.click(); };
        confirmPasswordInput.onkeydown = (e) => { if (e.key === 'Enter') setPasswordBtn.click(); };
    }

    /**
     * Displays an overlay for the user to input a secret code to unlock.
     * Triggered by Alt+I. This validates against hardcoded secret codes.
     */
    showSecretCodeInputOverlay() {
        if (this._secretCodeOverlayActive) return;
        this._secretCodeOverlayActive = true;
        const body = this.getBody();
        if (!body) return;

        // If the main password overlay is active, remove it before showing secret code overlay
        const mainOverlay = body.querySelector('#lock-overlay');
        if (mainOverlay) {
            mainOverlay.remove();
            this.unlocking = false; // Reset main overlay flag
        }

        let inputOverlay = document.createElement('div');
        inputOverlay.id = 'secret-code-input-overlay';
        inputOverlay.className = 'fixed inset-0 bg-black bg-opacity-85 flex flex-col items-center justify-center z-50 font-inter';
        inputOverlay.innerHTML = `
            <div class="bg-gray-800 bg-opacity-90 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                <div class="text-white text-2xl font-semibold mb-6">Enter Secret Code</div>
                <input id="secret-code-unlock-input" type="password" placeholder="Secret Code"
                       class="p-3 text-base rounded-lg border-none mb-3 w-64 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" autofocus />
                <div class="flex space-x-3 mb-4">
                    <button id="unlock-secret-code-btn"
                            class="px-6 py-3 text-base rounded-lg border-none bg-blue-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-blue-700 shadow-md">
                        Unlock
                    </button>
                    <button id="cancel-secret-code-unlock-btn"
                            class="px-6 py-3 text-base rounded-lg border-none bg-gray-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-gray-700 shadow-md">
                        Cancel
                    </button>
                </div>
                <div id="secret-code-unlock-error" class="text-red-400 mt-3 text-sm hidden"></div>
            </div>
        `;
        body.appendChild(inputOverlay);

        const secretCodeInput = inputOverlay.querySelector('#secret-code-unlock-input');
        const unlockSecretCodeBtn = inputOverlay.querySelector('#unlock-secret-code-btn');
        const cancelBtn = inputOverlay.querySelector('#cancel-secret-code-unlock-btn');
        const errorDiv = inputOverlay.querySelector('#secret-code-unlock-error');

        if (!secretCodeInput || !unlockSecretCodeBtn || !cancelBtn || !errorDiv) return;

        unlockSecretCodeBtn.onclick = async () => {
            const code = secretCodeInput.value;
            errorDiv.style.display = 'none';

            if (code.length === 0) {
                errorDiv.textContent = 'Please enter a secret code.';
                errorDiv.style.display = 'block';
                return;
            }

            let unlockedBySecretCode = false;
            try {
                if (typeof util !== 'undefined' && typeof util.sha256 === 'function') {
                    const enteredCodeHash = await util.sha256(code);
                    if (HARDCODED_SECRET_CODE_HASHES.includes(enteredCodeHash)) {
                        unlockedBySecretCode = true;
                    }
                } else {
                    // Fallback for demo if hashing utility is missing (not secure for real secret codes)
                    console.warn("util.sha256 not available. Secret code validation is not secure.");
                    // For hardcoded easter eggs, if hashing isn't available, we can't validate securely.
                    // In a real scenario, you might disable this feature or indicate it's unavailable.
                    // For now, we'll just fail validation if hashing isn't there.
                }
            } catch (e) {
                console.error("Error hashing secret code for validation:", e);
                errorDiv.textContent = 'An error occurred during validation.';
                errorDiv.style.display = 'block';
                return;
            }

            if (unlockedBySecretCode) {
                this.unlocked = true;
                inputOverlay.remove();
                this._secretCodeOverlayActive = false;
                this.unlocking = false; // Ensure main overlay flag is also reset
                if (this._showOverlayListener) {
                    window.removeEventListener('keydown', this._showOverlayListener);
                }
                if (this._secretCodeKeyListener) {
                    window.removeEventListener('keydown', this._secretCodeKeyListener);
                }
                if (typeof this.closeWindow === 'function') {
                    this.closeWindow();
                }
            } else {
                errorDiv.textContent = 'Incorrect secret code.';
                errorDiv.style.display = 'block';
            }
        };

        cancelBtn.onclick = () => {
            inputOverlay.remove();
            this._secretCodeOverlayActive = false;
            this.showPasswordOverlay(); // Return to main lock screen
        };

        secretCodeInput.onkeydown = (e) => { if (e.key === 'Enter') unlockSecretCodeBtn.click(); };
    }


    /**
     * Displays the password entry overlay for unlocking the screen.
     */
    showPasswordOverlay() {
        if (this.unlocking) return; // Prevent multiple overlays
        this.unlocking = true;
        const body = this.getBody();
        if (!body) return;

        // If secret code overlay is active, remove it before showing main password overlay
        const secretCodeOverlay = body.querySelector('#secret-code-input-overlay');
        if (secretCodeOverlay) {
            secretCodeOverlay.remove();
            this._secretCodeOverlayActive = false; // Reset secret code overlay flag
        }

        let overlay = body.querySelector('#lock-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'lock-overlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-85 flex flex-col items-center justify-center z-10 font-inter';
            overlay.innerHTML = `
                <div class="bg-gray-800 bg-opacity-90 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                    <img src="${this.profilePicture || 'https://placehold.co/96x96/222222/ffffff?text=User'}" alt="Profile"
                         class="w-24 h-24 rounded-full object-cover bg-gray-700 mb-4"
                         onerror="this.src='https://placehold.co/96x96/222222/ffffff?text=User'; this.style.display='block';" />
                    <div class="text-white text-2xl font-semibold mb-4">${this.displayName || 'User'}</div>
                    
                    <!-- Single Password Field -->
                    <input id="lock-password" type="password" placeholder="Enter password"
                           class="p-3 text-base rounded-lg border-none mb-3 w-64 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" autofocus />
                    
                    <div class="flex space-x-3 mb-4">
                        <button id="unlock-btn"
                                class="px-6 py-3 text-base rounded-lg border-none bg-blue-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-blue-700 shadow-md">
                            Unlock
                        </button>
                        <button id="cancel-btn"
                                class="px-6 py-3 text-base rounded-lg border-none bg-gray-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-gray-700 shadow-md">
                            Cancel
                        </button>
                    </div>
                    <div id="unlock-error" class="text-red-400 mt-2 text-sm hidden"></div>

                    <!-- Power Options -->
                    <div class="absolute bottom-8 right-8 flex flex-col space-y-2">
                        <button id="shutdown-btn"
                                class="px-4 py-2 text-sm rounded-lg border-none bg-red-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-red-700 shadow-md">
                            Shutdown
                        </button>
                        <button id="logoff-btn"
                                class="px-4 py-2 text-sm rounded-lg border-none bg-yellow-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-yellow-700 shadow-md">
                            Logoff
                        </button>
                        <button id="restart-btn"
                                class="px-4 py-2 text-sm rounded-lg border-none bg-green-600 text-white font-semibold cursor-pointer transition duration-200 hover:bg-green-700 shadow-md">
                            Restart
                        </button>
                    </div>
                </div>
            `;
            body.appendChild(overlay);
        }

        const unlockBtn = overlay.querySelector('#unlock-btn');
        const cancelBtn = overlay.querySelector('#cancel-btn');
        const passwordInput = overlay.querySelector('#lock-password');
        const errorDiv = overlay.querySelector('#unlock-error');
        const shutdownBtn = overlay.querySelector('#shutdown-btn');
        const logoffBtn = overlay.querySelector('#logoff-btn');
        const restartBtn = overlay.querySelector('#restart-btn');

        if (!unlockBtn || !cancelBtn || !passwordInput || !errorDiv || !shutdownBtn || !logoffBtn || !restartBtn) return;

        unlockBtn.onclick = async () => {
            const password = passwordInput.value;
            if (!password) {
                errorDiv.textContent = 'Please enter your password.';
                errorDiv.style.display = 'block';
                return;
            }

            let unlockedSuccessfully = false;

            try {
                // 1. Validate against the local lock screen password (if set)
                if (this._canUsePersistentHashing && this._localPasswordHash) {
                    if (typeof util !== 'undefined' && typeof util.sha256 === 'function') {
                        const enteredPasswordHash = await util.sha256(password);
                        if (enteredPasswordHash === this._localPasswordHash) {
                            unlockedSuccessfully = true;
                        }
                    } else {
                        console.error("util.sha256 is not available for validation. Cannot validate persistent hash.");
                    }
                } else if (!this._canUsePersistentHashing && this._localPassword) {
                    if (password === this._localPassword) {
                        unlockedSuccessfully = true;
                    }
                }

                // 2. If not unlocked yet, try validating against ArcOS account password
                if (!unlockedSuccessfully && this.userDaemon && typeof this.userDaemon.validatePassword === 'function') {
                    try {
                        unlockedSuccessfully = await this.userDaemon.validatePassword(password);
                        if (unlockedSuccessfully) {
                            console.log("Unlocked using ArcOS account password.");
                        }
                    } catch (e) {
                        console.error("Error validating ArcOS account password (userDaemon.validatePassword):", e);
                        unlockedSuccessfully = false;
                    }
                }

                if (unlockedSuccessfully) {
                    this.unlocked = true;
                    overlay.remove();
                    this.unlocking = false;
                    if (this._showOverlayListener) {
                        window.removeEventListener('keydown', this._showOverlayListener);
                    }
                    if (this._secretCodeKeyListener) { // Remove secret code listener too
                        window.removeEventListener('keydown', this._secretCodeKeyListener);
                    }
                    if (typeof this.closeWindow === 'function') {
                        this.closeWindow();
                    }
                } else {
                    errorDiv.textContent = 'Incorrect password.';
                    errorDiv.style.display = 'block';
                }
            } catch (e) {
                errorDiv.textContent = 'An unexpected error occurred during password validation. Please check console for details.';
                errorDiv.style.display = 'block';
                console.error("Unhandled error during unlock attempt:", e);
            }
        };

        cancelBtn.onclick = () => {
            overlay.remove();
            this.unlocking = false;
        };

        shutdownBtn.onclick = async () => {
            if (this.userDaemon && typeof this.userDaemon.shutdown === 'function') {
                await this.userDaemon.shutdown();
            } else {
                console.warn("Shutdown functionality not available via userDaemon.");
            }
        };

        logoffBtn.onclick = async () => {
            if (this.userDaemon && typeof this.userDaemon.logoff === 'function') {
                await this.userDaemon.logoff();
            } else {
                console.warn("Logoff functionality not available via userDaemon.");
            }
        };

        restartBtn.onclick = async () => {
            if (this.userDaemon && typeof this.userDaemon.restart === 'function') {
                await this.userDaemon.restart();
            } else {
                console.warn("Restart functionality not available via userDaemon.");
            }
        };

        passwordInput.onkeydown = (e) => {
            if (e.key === 'Enter') unlockBtn.click();
        };
    }

    /**
     * Starts the Flurry-style animation on the canvas.
     */
    startFlurryAnimation() {
        if (this._disposed) return;

        const canvas = this.getBody().querySelector('#flurry-canvas');
        if (!canvas) {
            console.error("Flurry canvas not found!");
            return;
        }

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const ctx = canvas.getContext('2d');
        const NUM_CURVES = 5;
        const POINTS_PER_CURVE = 6;
        const curves = [];
        const colors = [
            '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#A66CFF', '#FF6EC7', '#00C2CB', '#FFB26B'
        ];

        function random(min, max) {
            return Math.random() * (max - min) + min;
        }

        function createCurve() {
            const points = [];
            for (let i = 0; i < POINTS_PER_CURVE; i++) {
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
                width: random(1.5, 3.5)
            };
        }

        for (let i = 0; i < NUM_CURVES; i++) {
            curves.push(createCurve());
        }

        const animate = () => {
            if (this._disposed) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const curve of curves) {
                ctx.save();
                ctx.globalAlpha = curve.alpha;
                ctx.strokeStyle = curve.color;
                ctx.lineWidth = curve.width;
                ctx.beginPath();
                ctx.moveTo(curve.points[0].x, curve.points[0].y);
                for (let i = 1; i < curve.points.length - 2; i++) {
                    const xc = (curve.points[i].x + curve.points[i + 1].x) / 2;
                    const yc = (curve.points[i].y + curve.points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(curve.points[i].x, curve.points[i].y, xc, yc);
                }
                ctx.quadraticCurveTo(
                    curve.points[curve.points.length - 2].x,
                    curve.points[curve.points.length - 2].y,
                    curve.points[curve.points.length - 1].x,
                    curve.points[curve.points.length - 1].y
                );
                ctx.stroke();
                ctx.restore();

                for (const pt of curve.points) {
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    if (pt.x < 0 || pt.x > canvas.width) pt.vx *= -1;
                    if (pt.y < 0 || pt.y > canvas.height) pt.vy *= -1;
                }
            }

            requestAnimationFrame(animate);
        };

        animate();
    }
}

// Ensure Tailwind CSS is loaded for styling
const tailwindScript = document.createElement('script');
tailwindScript.src = 'https://cdn.tailwindcss.com';
document.head.appendChild(tailwindScript);

// Set Inter font globally
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// Export the proc class
return { proc };
