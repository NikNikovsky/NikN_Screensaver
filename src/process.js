// Assume loadHtml is a utility function that loads HTML content.
// For this example, we'll define a simple body.html content directly.
const htmlContent = `
    <div id="app-container" style="width: 100vw; height: 100vh; overflow: hidden; position: relative; font-family: 'Inter', sans-serif;">
        <canvas id="flurry-canvas" style="display: block;"></canvas>
    </div>
`;

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

        // _localPasswordHash will store the SHA256 hash if persistent storage is available
        this._localPasswordHash = null;
        // _localPassword will store the plaintext password in memory if persistent storage is not available
        this._localPassword = null;

        this._lockScreenPasswordFilePath = null; // Will be set if persistent storage is available
        this._canUsePersistentHashing = false; // Determined during constructor/render

        // Initial check for core utilities that determine persistent hashing capability
        // This is a preliminary check. Actual usage will have more specific try/catch.
        try {
            if (typeof util !== 'undefined' && !!util.sha256 &&
                typeof util.arrayToText === 'function' && typeof util.textToBlob === 'function' &&
                typeof UserPaths !== 'undefined' && typeof UserPaths.Configuration === 'string' &&
                this.fs && !!this.fs.readFile && !!this.fs.writeFile) {
                this._canUsePersistentHashing = true;
                this._lockScreenPasswordFilePath = UserPaths.Configuration + '/lockscreen.pwd.hash';
                console.log("Persistent hashing and file system operations are initially detected as available.");
            } else {
                console.warn("Initial check: Some core utilities for persistent hashing (util.sha256, fs, UserPaths.Configuration) are not fully available. Will fall back to in-memory storage.");
            }
        } catch (e) {
            console.error("Error during initial utility check for persistent hashing:", e);
            this._canUsePersistentHashing = false; // Ensure it's false on any error
        }
    }

    /**
     * Renders the initial application UI.
     * It sets up the lock screen, checks for password existence, and starts the animation.
     */
    async render() {
        const body = this.getBody();
        if (!body) return;
        body.innerHTML = htmlContent; // Load the base HTML content

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

        // Attempt to load the hashed lock screen password from file if persistent hashing is enabled
        if (this._canUsePersistentHashing && this._lockScreenPasswordFilePath) {
            try {
                // Ensure fs.readFile is callable before attempting to use it
                if (this.fs && typeof this.fs.readFile === 'function') {
                    const fileContent = await this.fs.readFile(this._lockScreenPasswordFilePath);
                    if (fileContent) {
                        // Ensure util.arrayToText is callable
                        if (typeof util !== 'undefined' && typeof util.arrayToText === 'function') {
                            this._localPasswordHash = util.arrayToText(new Uint8Array(fileContent));
                            console.log("Loaded hashed lock screen password from file.");
                        } else {
                            console.warn("util.arrayToText is not available. Cannot process loaded password hash.");
                            this._localPasswordHash = null; // Invalidate hash if utility is missing
                        }
                    }
                } else {
                    console.warn("this.fs.readFile is not available. Cannot load persistent password.");
                    this._canUsePersistentHashing = false; // Disable persistent hashing if read fails
                }
            } catch (e) {
                console.warn("Failed to read lock screen password file (expected on first run or if file corrupted, or fs error):", e);
                this._localPasswordHash = null; // Invalidate hash
                this._canUsePersistentHashing = false; // Disable persistent hashing on read error
            }
        } else if (this._canUsePersistentHashing && !this._lockScreenPasswordFilePath) {
            console.warn("UserPaths.Configuration was not available to set password file path. Disabling persistent hashing.");
            this._canUsePersistentHashing = false;
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

        // Listen for space key to show password overlay (only if not already unlocking/unlocked)
        this._showOverlayListener = (e) => {
            if (!this.unlocking && !this.unlocked && (e.code === 'Space' || e.key === ' ')) {
                this.showPasswordOverlay();
            }
        };
        window.addEventListener('keydown', this._showOverlayListener);

        // Start the Flurry-style animation
        this.startFlurryAnimation();
    }

    /**
     * Handles the application closing event.
     * Prevents closing unless the app is unlocked.
     * @returns {boolean} True if the app can close, false otherwise.
     */
    async onClose() {
        // Prevent closing unless unlocked
        if (this.unlocked) {
            // Actually close the app if unlocked
            return true;
        }
        // Always block close (including Ctrl+Q) unless unlocked
        if (!this.unlocking) {
            this.showPasswordOverlay(); // Show overlay if trying to close while locked
        }
        return false;
    }

    /**
     * Displays a dialog for the user to set their lock screen password for the first time.
     * This password is local to the lock screen app and does not affect the user's account password.
     */
    showSetPasswordDialog() {
        const body = this.getBody();
        if (!body) return;

        // Create the password setup overlay
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

            errorDiv.style.display = 'none'; // Hide previous errors

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
                    // Ensure util.sha256 and util.textToBlob are callable
                    if (typeof util !== 'undefined' && typeof util.sha256 === 'function' && typeof util.textToBlob === 'function') {
                        const hashedPassword = await util.sha256(newPassword);
                        this._localPasswordHash = hashedPassword;
                        console.log("Lock screen password hashed and stored locally.");

                        // Ensure fs.writeFile is callable
                        if (this.fs && typeof this.fs.writeFile === 'function') {
                            const blob = util.textToBlob(hashedPassword, 'text/plain');
                            await this.fs.writeFile(this._lockScreenPasswordFilePath, blob);
                            console.log("Hashed lock screen password saved to file:", this._lockScreenPasswordFilePath);
                        } else {
                            console.error("this.fs.writeFile is not available. Cannot save persistent password.");
                            this._canUsePersistentHashing = false; // Disable persistent hashing if write fails
                            this._localPassword = newPassword; // Fallback to in-memory
                        }
                    } else {
                        console.error("util.sha256 or util.textToBlob is not available. Cannot use persistent hashing.");
                        this._canUsePersistentHashing = false; // Disable persistent hashing
                        this._localPassword = newPassword; // Fallback to in-memory
                    }
                } else {
                    // Fallback: store plaintext password in memory for the current session
                    this._localPassword = newPassword;
                    console.warn("Persistent hashing not available. Lock screen password stored in memory for this session.");
                }

                setupOverlay.remove(); // Remove the setup dialog
                this.showPasswordOverlay(); // Show the normal lock screen
            } catch (e) {
                errorDiv.textContent = 'Failed to set password. An internal error occurred. Please check console.';
                errorDiv.style.display = 'block';
                console.error("Error during password setup or file write:", e);
                this._canUsePersistentHashing = false; // Ensure fallback if an error occurs during setup
                this._localPassword = newPassword; // Ensure in-memory fallback is set even on error
            }
        };

        // Allow pressing Enter to set password
        newPasswordInput.onkeydown = (e) => { if (e.key === 'Enter') setPasswordBtn.click(); };
        confirmPasswordInput.onkeydown = (e) => { if (e.key === 'Enter') setPasswordBtn.click(); };
    }

    /**
     * Displays the password entry overlay for unlocking the screen.
     */
    showPasswordOverlay() {
        if (this.unlocking) return; // Prevent multiple overlays
        this.unlocking = true;
        const body = this.getBody();
        if (!body) return;

        let overlay = body.querySelector('#lock-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'lock-overlay';
            // Tailwind CSS classes for styling
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
        const passwordInput = overlay.querySelector('#lock-password'); // Single input field
        const errorDiv = overlay.querySelector('#unlock-error');
        const shutdownBtn = overlay.querySelector('#shutdown-btn');
        const logoffBtn = overlay.querySelector('#logoff-btn');
        const restartBtn = overlay.querySelector('#restart-btn');

        if (!unlockBtn || !cancelBtn || !passwordInput || !errorDiv || !shutdownBtn || !logoffBtn || !restartBtn) return;

        // Unlock button click handler
        unlockBtn.onclick = async () => {
            const password = passwordInput.value;
            if (!password) {
                errorDiv.textContent = 'Please enter your password.';
                errorDiv.style.display = 'block';
                return;
            }

            let unlockedSuccessfully = false;

            try {
                if (this._canUsePersistentHashing && this._localPasswordHash) {
                    // Try to hash the entered password
                    if (typeof util !== 'undefined' && typeof util.sha256 === 'function') {
                        const enteredPasswordHash = await util.sha256(password);
                        if (enteredPasswordHash === this._localPasswordHash) {
                            unlockedSuccessfully = true;
                        }
                    } else {
                        console.error("util.sha256 is not available for validation. Cannot validate persistent hash.");
                        // If hashing utility is missing, cannot validate persistent hash
                        // Fallback logic will handle trying ArcOS account
                    }
                } else if (!this._canUsePersistentHashing && this._localPassword) {
                    // Fallback: validate against the in-memory plaintext password
                    if (password === this._localPassword) {
                        unlockedSuccessfully = true;
                    }
                }

                // If not unlocked yet, try validating against ArcOS account password
                if (!unlockedSuccessfully && this.userDaemon && typeof this.userDaemon.validatePassword === 'function') {
                    try {
                        unlockedSuccessfully = await this.userDaemon.validatePassword(password);
                        if (unlockedSuccessfully) {
                            console.log("Unlocked using ArcOS account password.");
                        }
                    } catch (e) {
                        console.error("Error validating ArcOS account password (userDaemon.validatePassword):", e);
                        unlockedSuccessfully = false; // Ensure it's false on error
                    }
                }

                if (unlockedSuccessfully) {
                    this.unlocked = true;
                    overlay.remove(); // Remove the lock overlay
                    this.unlocking = false;
                    // Remove keydown listener after unlock (only if it was added)
                    if (this._showOverlayListener) {
                        window.removeEventListener('keydown', this._showOverlayListener);
                    }
                    // Actually close the app after unlock (as per original logic)
                    if (typeof this.closeWindow === 'function') {
                        this.closeWindow();
                    }
                } else {
                    errorDiv.textContent = 'Incorrect password.';
                    errorDiv.style.display = 'block';
                }
            } catch (e) {
                // Catch any unexpected errors during password validation (e.g., if util.sha256 itself fails unexpectedly)
                errorDiv.textContent = 'An unexpected error occurred during password validation. Please check console for details.';
                errorDiv.style.display = 'block';
                console.error("Unhandled error during unlock attempt:", e);
            }
        };

        // Cancel button click handler
        cancelBtn.onclick = () => {
            overlay.remove(); // Simply remove the lock overlay
            this.unlocking = false; // Reset unlocking state
            // The spacebar listener remains active, so the overlay can be brought back up.
        };

        // Power options handlers - using this.userDaemon
        shutdownBtn.onclick = async () => {
            if (this.userDaemon && typeof this.userDaemon.shutdown === 'function') {
                await this.userDaemon.shutdown();
            } else {
                console.warn("Shutdown functionality not available via userDaemon.");
                // In a real app, you might show a message box here
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

        // Allow pressing Enter in the password field to trigger unlock
        passwordInput.onkeydown = (e) => {
            if (e.key === 'Enter') unlockBtn.click();
        };
    }

    /**
     * Starts the Flurry-style animation on the canvas.
     */
    startFlurryAnimation() {
        if (this._disposed) return; // Check if the app is disposed

        const canvas = this.getBody().querySelector('#flurry-canvas');
        if (!canvas) {
            console.error("Flurry canvas not found!");
            return;
        }

        // Make canvas full screen and responsive
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas(); // Initial resize

        const ctx = canvas.getContext('2d');
        const NUM_CURVES = 5;
        const POINTS_PER_CURVE = 6;
        const curves = [];
        const colors = [
            '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#A66CFF', '#FF6EC7', '#00C2CB', '#FFB26B'
        ];

        /**
         * Generates a random number within a given range.
         * @param {number} min - The minimum value.
         * @param {number} max - The maximum value.
         * @returns {number} A random number.
         */
        function random(min, max) {
            return Math.random() * (max - min) + min;
        }

        /**
         * Creates a single curve for the animation.
         * @returns {object} An object representing a curve with points, color, alpha, and width.
         */
        function createCurve() {
            const points = [];
            for (let i = 0; i < POINTS_PER_CURVE; i++) {
                points.push({
                    x: random(0, canvas.width),
                    y: random(0, canvas.height),
                    vx: random(-1, 1), // Velocity in x direction
                    vy: random(-1, 1)  // Velocity in y direction
                });
            }
            return {
                points,
                color: colors[Math.floor(random(0, colors.length))],
                alpha: random(0.3, 0.7),
                width: random(1.5, 3.5)
            };
        }

        // Initialize curves
        for (let i = 0; i < NUM_CURVES; i++) {
            curves.push(createCurve());
        }

        /**
             * The main animation loop.
             * Clears the canvas, draws and animates each curve.
             */
        const animate = () => {
            if (this._disposed) return; // Stop animation if app is disposed
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas

            for (const curve of curves) {
                ctx.save(); // Save current drawing state
                ctx.globalAlpha = curve.alpha; // Set transparency
                ctx.strokeStyle = curve.color; // Set line color
                ctx.lineWidth = curve.width;   // Set line width
                ctx.beginPath(); // Start a new path
                ctx.moveTo(curve.points[0].x, curve.points[0].y); // Move to the first point

                // Draw quadratic curves for smooth lines
                for (let i = 1; i < curve.points.length - 2; i++) {
                    const xc = (curve.points[i].x + curve.points[i + 1].x) / 2;
                    const yc = (curve.points[i].y + curve.points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(curve.points[i].x, curve.points[i].y, xc, yc);
                }
                // Draw the last segment
                ctx.quadraticCurveTo(
                    curve.points[curve.points.length - 2].x,
                    curve.points[curve.points.length - 2].y,
                    curve.points[curve.points.length - 1].x,
                    curve.points[curve.points.length - 1].y
                );
                ctx.stroke(); // Draw the path
                ctx.restore(); // Restore drawing state

                // Animate points: update position and reverse velocity if hitting boundaries
                for (const pt of curve.points) {
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    if (pt.x < 0 || pt.x > canvas.width) pt.vx *= -1;
                    if (pt.y < 0 || pt.y > canvas.height) pt.vy *= -1;
                }
            }

            requestAnimationFrame(animate); // Request next animation frame
        };

        animate(); // Start the animation
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
