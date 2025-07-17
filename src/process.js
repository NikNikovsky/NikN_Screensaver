const html = await loadHtml("body.html");


class proc extends ThirdPartyAppProcess {
	constructor(handler, pid, parentPid, app, workingDirectory, ...args) {
		super(handler, pid, parentPid, app, workingDirectory);
		this.unlocking = false;
		this.unlocked = false;
		this.profilePicture = null;
		this.displayName = null;
	}

	async render() {
		const body = this.getBody();
		body.innerHTML = html;

		// Try to get user info (profile picture and display name)
		try {
			if (this.userDaemon && this.userDaemon.userPreferences) {
				const prefs = this.userDaemon.userPreferences;
				if (prefs.account) {
					this.profilePicture = prefs.account.profilePicture;
					this.displayName = prefs.account.displayName || "User";
				}
			}
		} catch (e) {
			this.profilePicture = null;
			this.displayName = "User";
		}

		// Add password overlay
		this.showPasswordOverlay();

		// Start the Flurry-style animation
		this.startFlurryAnimation();
	}

	async onClose() {
		// Prevent closing unless unlocked
		if (this.unlocked) return true;
		if (!this.unlocking) {
			this.showPasswordOverlay();
		}
		return false;
	}

	showPasswordOverlay() {
		if (this.unlocking) return;
		this.unlocking = true;
		const body = this.getBody();
		let overlay = body.querySelector('#lock-overlay');
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
					<img src="${this.profilePicture ? this.profilePicture : ''}" alt="Profile" style="width:96px;height:96px;border-radius:50%;object-fit:cover;background:#222;margin-bottom:16px;" onerror="this.style.display='none'" />
					<div style="color:#fff;font-size:1.5em;font-weight:600;margin-bottom:16px;">${this.displayName ? this.displayName : 'User'}</div>
					<input id="lock-password" type="password" placeholder="Enter password" style="padding:10px 16px;font-size:1em;border-radius:8px;border:none;margin-bottom:12px;width:220px;" autofocus />
					<button id="unlock-btn" style="padding:10px 24px;font-size:1em;border-radius:8px;border:none;background:#4D96FF;color:#fff;font-weight:600;cursor:pointer;">Unlock</button>
					<div id="unlock-error" style="color:#FF6B6B;margin-top:10px;display:none;"></div>
				</div>
			`;
			body.appendChild(overlay);
		}
		const unlockBtn = overlay.querySelector('#unlock-btn');
		const passwordInput = overlay.querySelector('#lock-password');
		const errorDiv = overlay.querySelector('#unlock-error');
		unlockBtn.onclick = async () => {
			const password = passwordInput.value;
			if (!password) {
				errorDiv.textContent = 'Please enter your password.';
				errorDiv.style.display = 'block';
				return;
			}
			// Validate password (replace with real validation if available)
			let valid = false;
			try {
				if (this.userDaemon && typeof this.userDaemon.validatePassword === 'function') {
					valid = await this.userDaemon.validatePassword(password);
				} else {
					// Fallback: accept any non-empty password for demo
					valid = password.length > 0;
				}
			} catch (e) {
				valid = false;
			}
			if (valid) {
				this.unlocked = true;
				overlay.remove();
				this.unlocking = false;
			} else {
				errorDiv.textContent = 'Incorrect password.';
				errorDiv.style.display = 'block';
			}
		};
		passwordInput.onkeydown = (e) => {
			if (e.key === 'Enter') unlockBtn.click();
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