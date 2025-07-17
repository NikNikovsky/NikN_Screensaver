class proc extends ThirdPartyAppProcess {
	constructor(handler, pid, parentPid, app, workingDirectory, ...args) {
		super(handler, pid, parentPid, app, workingDirectory);
		this.unlocking = false;
		this.unlocked = false;
		this.profilePicture = null;
		this.displayName = null;
		this.userDaemon = handler && handler.userDaemon ? handler.userDaemon : null;
		this.userPreferences = null;
	}


// Helper: Read JSON file using ArcOS filesystem API
async readJsonFile(path) {
	try {
		const file = await arc.fs.readFile(path);
		if (!file || !file.data) return null;
		const text = new TextDecoder('utf-8').decode(file.data);
		return JSON.parse(text);
	} catch (e) {
		return null;
	}
}

// Helper: Write JSON file using ArcOS filesystem API
async writeJsonFile(path, obj) {
	try {
		const text = JSON.stringify(obj, null, 2);
		const data = new TextEncoder().encode(text);
		await arc.fs.writeFile(path, data);
		return true;
	} catch (e) {
		return false;
	}
}

async loadUserPreferences() {
	this.userPreferences = await this.readJsonFile('src/userPreferences.json');
	if (!this.userPreferences) {
		// Initialize with default structure if missing
		this.userPreferences = {
			account: {},
			appPreferences: {}
		};
	}
	// If account info is missing, try to populate from userDaemon
	if (this.userDaemon) {
		if (!this.userPreferences.account) this.userPreferences.account = {};
		if (!this.userPreferences.account.displayName && this.userDaemon.displayName) {
			this.userPreferences.account.displayName = this.userDaemon.displayName;
		}
		if (!this.userPreferences.account.profilePicture && this.userDaemon.profilePicture) {
			this.userPreferences.account.profilePicture = this.userDaemon.profilePicture;
		}
	}
	await this.writeJsonFile('src/userPreferences.json', this.userPreferences);
}

	async render() {
		await this.loadUserPreferences();
		const html = await loadHtml("body.html");
		const body = this.getBody();
		if (!body) return;
		body.innerHTML = html;

		// Ensure flurry canvas exists
		let canvas = body.querySelector('#flurry-canvas');
		if (!canvas) {
			canvas = document.createElement('canvas');
			canvas.id = 'flurry-canvas';
			canvas.style.position = 'absolute';
			canvas.style.top = '0';
			canvas.style.left = '0';
			canvas.style.width = '100vw';
			canvas.style.height = '100vh';
			canvas.style.zIndex = '1';
			canvas.style.pointerEvents = 'none';
			body.appendChild(canvas);
		}

		try {
			const prefs = this.userPreferences;
			if (prefs && prefs.account) {
				this.displayName = prefs.account.displayName || 'User';
				this.profilePicture = prefs.account.profilePicture || null;
			} else {
				this.displayName = 'User';
				this.profilePicture = null;
			}
			let appPrefs = prefs && prefs.appPreferences && prefs.appPreferences[this.app.id] ? prefs.appPreferences[this.app.id] : {};
			this.screensaverPassword = appPrefs.screensaverPassword || null;
			this.screensaverPasswordMode = appPrefs.screensaverPasswordMode || null;

			const unlockBtn = body.querySelector('#unlock-btn');
			if (unlockBtn && this.userDaemon && this.userDaemon.accentColor) {
				unlockBtn.style.backgroundColor = this.userDaemon.accentColor;
			} else if (unlockBtn && prefs && prefs.appPreferences && prefs.appPreferences.accentColor) {
				unlockBtn.style.backgroundColor = prefs.appPreferences.accentColor;
			}
		} catch (e) {
			this.displayName = 'User';
			this.profilePicture = null;
			this.screensaverPassword = null;
			this.screensaverPasswordMode = null;
		}

	   if (!this.screensaverPassword) {
		   this.promptSetPassword();
	   }

		this._showOverlayListener = (e) => {
			if (!this.unlocking && !this.unlocked && (e.code === 'Space' || e.key === ' ')) {
				this.showPasswordOverlay();
			}
		};
		window.addEventListener('keydown', this._showOverlayListener);

		this.startFlurryAnimation();

		this.logUserDaemonProperties();
	}

	logUserDaemonProperties() {
		if (!this.userDaemon) {
			this.Log('[Screensaver] userDaemon is not available', 2);
			console.log('[Screensaver] userDaemon is not available');
			return;
		}
		const props = Object.getOwnPropertyNames(this.userDaemon).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(this.userDaemon)));
		const msg = '[Screensaver] userDaemon properties and methods: ' + props.join(', ');
		this.Log(msg, 0);
		console.log(msg);
	}

	logUserDaemon() {
		if (!this.userDaemon) {
			this.Log('[Screensaver] userDaemon is not available', 2);
			console.log('[Screensaver] userDaemon is not available');
			return;
		}
		const props = Object.getOwnPropertyNames(this.userDaemon).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(this.userDaemon)));
		const msg = '[Screensaver] userDaemon object properties: ' + props.join(', ');
		this.Log(msg, 0);
		console.log(msg);
	}

   // Removed promptPasswordModeChoice: always use custom password mode

	promptSetPassword() {
		const body = this.getBody();
		if (!body) return;
		let overlay = body.querySelector ? body.querySelector('#lock-overlay') : null;
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = 'lock-overlay';
			overlay.style.position = 'absolute';
			overlay.style.top = '0';
			overlay.style.left = '0';
			overlay.style.width = '100vw';
			overlay.style.height = '100vh';
			overlay.style.background = 'rgba(0,0,0,0.85)';
			overlay.style.display = 'flex';
			overlay.style.flexDirection = 'column';
			overlay.style.alignItems = 'center';
			overlay.style.justifyContent = 'center';
			overlay.style.zIndex = '10';
			overlay.innerHTML = `
				<div style="background:rgba(20,20,20,0.9);padding:32px 40px;border-radius:16px;box-shadow:0 4px 32px #000;display:flex;flex-direction:column;align-items:center;">
					<div style="color:#fff;font-size:1.3em;font-weight:600;margin-bottom:16px;">Set a screensaver password</div>
					<input id="set-password" type="password" placeholder="New password" style="padding:10px 16px;font-size:1em;border-radius:8px;border:none;margin-bottom:12px;width:220px;" autofocus />
					<input id="set-password-confirm" type="password" placeholder="Confirm password" style="padding:10px 16px;font-size:1em;border-radius:8px;border:none;margin-bottom:12px;width:220px;" />
					<button id="set-password-btn" style="padding:10px 24px;font-size:1em;border-radius:8px;border:none;background:#4D96FF;color:#fff;font-weight:600;cursor:pointer;">Set Password</button>
					<div id="set-password-error" style="color:#FF6B6B;margin-top:10px;display:none;"></div>
				</div>
			`;
			body.appendChild(overlay);
		}
		const setBtn = overlay.querySelector ? overlay.querySelector('#set-password-btn') : null;
		const passInput = overlay.querySelector ? overlay.querySelector('#set-password') : null;
		const passInput2 = overlay.querySelector ? overlay.querySelector('#set-password-confirm') : null;
		const errorDiv = overlay.querySelector ? overlay.querySelector('#set-password-error') : null;
		if (!setBtn || !passInput || !passInput2 || !errorDiv) return;
		setBtn.onclick = async () => {
			const pass = passInput.value;
			const pass2 = passInput2.value;
			if (!pass || !pass2) {
				errorDiv.textContent = 'Please fill in both fields.';
				errorDiv.style.display = 'block';
				return;
			}
			if (pass !== pass2) {
				errorDiv.textContent = 'Passwords do not match.';
				errorDiv.style.display = 'block';
				return;
			}
			// Save password in app preferences
			try {
				if (!this.userPreferences.appPreferences[this.app.id]) this.userPreferences.appPreferences[this.app.id] = {};
				this.userPreferences.appPreferences[this.app.id].screensaverPassword = pass;
				await this.writeJsonFile('src/userPreferences.json', this.userPreferences);
				this.screensaverPassword = pass;
				overlay.remove();
				this.unlocking = false;
			} catch (e) {
				errorDiv.textContent = 'Failed to save password.';
				errorDiv.style.display = 'block';
			}
		};
	}

	async onClose() {
		// Prevent closing unless unlocked
		if (this.unlocked) {
			// Actually close the app if unlocked
			return true;
		}
		// Always block close (including Ctrl+Q) unless unlocked
		if (!this.unlocking) {
			this.showPasswordOverlay();
		}
		return false;
	}

	async showPasswordOverlay() {
		if (this.unlocking) return;
		this.unlocking = true;
		// Always fetch latest user info and password mode before showing overlay
		let displayName = 'User';
		let profilePicture = '';
		let screensaverPassword = null;
		let screensaverPasswordMode = null;
		try {
			if (this.userDaemon && typeof this.userDaemon.getUserInfo === 'function') {
				const info = await this.userDaemon.getUserInfo();
				if (info && info.preferences && info.preferences.account) {
					displayName = info.preferences.account.displayName || 'User';
					profilePicture = info.preferences.account.profilePicture || '';
				}
				if (info && info.preferences && info.preferences.appPreferences && info.preferences.appPreferences[this.app.id]) {
					screensaverPassword = info.preferences.appPreferences[this.app.id].screensaverPassword || null;
					screensaverPasswordMode = info.preferences.appPreferences[this.app.id].screensaverPasswordMode || null;
				}
			} else {
				let prefs = this.userPreferences && typeof this.userPreferences === 'function' ? this.userPreferences() : this.userPreferences;
				if (prefs && prefs.account) {
					displayName = prefs.account.displayName || 'User';
					profilePicture = prefs.account.profilePicture || '';
				}
				if (prefs && prefs.appPreferences && prefs.appPreferences[this.app.id]) {
					screensaverPassword = prefs.appPreferences[this.app.id].screensaverPassword || null;
					screensaverPasswordMode = prefs.appPreferences[this.app.id].screensaverPasswordMode || null;
				}
			}
		} catch (e) {
			// fallback to defaults
		}
		this.screensaverPassword = screensaverPassword;
		this.screensaverPasswordMode = screensaverPasswordMode;
		const body = this.getBody();
		if (!body) return;
		let overlay = body.querySelector ? body.querySelector('#lock-overlay') : null;
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = 'lock-overlay';
			overlay.style.position = 'absolute';
			overlay.style.top = '0';
			overlay.style.left = '0';
			overlay.style.width = '100vw';
			overlay.style.height = '100vh';
			overlay.style.background = 'rgba(0,0,0,0.85)';
			overlay.style.display = 'flex';
			overlay.style.flexDirection = 'column';
			overlay.style.alignItems = 'center';
			overlay.style.justifyContent = 'center';
			overlay.style.zIndex = '10';
			overlay.innerHTML = `
				<div style="background:rgba(20,20,20,0.9);padding:32px 40px;border-radius:16px;box-shadow:0 4px 32px #000;display:flex;flex-direction:column;align-items:center;">
					<img src="${profilePicture}" alt="Profile" style="width:96px;height:96px;border-radius:50%;object-fit:cover;background:#222;margin-bottom:16px;" onerror="this.style.display='none'" />
					<div style="color:#fff;font-size:1.5em;font-weight:600;margin-bottom:16px;">${displayName}</div>
					<input id="lock-password" type="password" placeholder="Enter password" style="padding:10px 16px;font-size:1em;border-radius:8px;border:none;margin-bottom:12px;width:220px;" autofocus />
					<button id="unlock-btn" style="padding:10px 24px;font-size:1em;border-radius:8px;border:none;background:#4D96FF;color:#fff;font-weight:600;cursor:pointer;">Unlock</button>
					<div id="unlock-error" style="color:#FF6B6B;margin-top:10px;display:none;"></div>
				</div>
			`;
			body.appendChild(overlay);
		}
		const unlockBtn = overlay.querySelector ? overlay.querySelector('#unlock-btn') : null;
		const passwordInput = overlay.querySelector ? overlay.querySelector('#lock-password') : null;
		const errorDiv = overlay.querySelector ? overlay.querySelector('#unlock-error') : null;
		if (!unlockBtn || !passwordInput || !errorDiv) return;
		unlockBtn.onclick = async () => {
			const password = passwordInput.value;
			if (!password) {
				errorDiv.textContent = 'Please enter your password.';
				errorDiv.style.display = 'block';
				return;
			}
	   let valid = false;
	   if (this.screensaverPassword) {
		   valid = password === this.screensaverPassword;
	   }
			if (valid) {
				this.unlocked = true;
				overlay.remove();
				this.unlocking = false;
				if (this._showOverlayListener) {
					window.removeEventListener('keydown', this._showOverlayListener);
				}
				if (typeof this.closeWindow === 'function') {
					this.closeWindow();
				}
			} else {
				errorDiv.textContent = 'Incorrect password.';
				errorDiv.style.display = 'block';
			}
		};
		passwordInput.onkeydown = (e) => {
			if (e.key === 'Enter') unlockBtn.click();
		};

		// Add emergency exit button for testing
		const emergencyBtn = document.createElement('button');
		emergencyBtn.textContent = 'Emergency Exit';
		emergencyBtn.style.marginTop = '20px';
		emergencyBtn.style.padding = '10px 20px';
		emergencyBtn.style.borderRadius = '8px';
		emergencyBtn.style.border = 'none';
		emergencyBtn.style.backgroundColor = '#FF0000';
		emergencyBtn.style.color = '#FFFFFF';
		overlay.appendChild(emergencyBtn);

		// Add event listener for emergency button
		emergencyBtn.onclick = () => {
			// Bypass password and close app
			this.unlocked = true;
			overlay.remove();
			this.unlocking = false;
			if (this._showOverlayListener) {
				window.removeEventListener('keydown', this._showOverlayListener);
			}
			if (typeof this.closeWindow === 'function') {
				this.closeWindow();
			}
		};
	}

	startFlurryAnimation() {
		if (this._disposed) return;
		const canvas = this.getBody().querySelector('#flurry-canvas');
		if (!canvas) return;

		// Make canvas full screen
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

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

		function animate() {
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
				ctx.stroke();
				ctx.restore();

				// Animate points
				for (const pt of curve.points) {
					pt.x += pt.vx;
					pt.y += pt.vy;
					if (pt.x < 0 || pt.x > canvas.width) pt.vx *= -1;
					if (pt.y < 0 || pt.y > canvas.height) pt.vy *= -1;
				}
			}

			requestAnimationFrame(animate.bind(this));
		}

		animate.call(this);
	}
}

return { proc };