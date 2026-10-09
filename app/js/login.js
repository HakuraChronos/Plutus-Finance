/* ==========================================================================
   PLUTUS FINANCE - PRIVATE LOGIN GATE
   ========================================================================== */

import { auth } from './auth.js';
import { store } from './state.js';
import { toast } from './components/toast.js';

class LoginGate {
  constructor() {
    this.root = document.getElementById('login-screen');
    this.mode = 'signin';
    this.selectedUser = null;
    this.bootError = null;
    this.hasAnimated = false;
    this.revealTimer = null;
  }

  async boot() {
    this.bind();
    this.show(true);
    try {
      await auth.syncDiskRegistry();
    } catch (error) {
      this.bootError = error.message || 'Secure local server is unavailable.';
      this.render();
    }
  }

  bind() {
    if (!this.root || this.root.dataset.bound === 'true') return;
    this.root.dataset.bound = 'true';
    this.root.addEventListener('click', event => {
      if (event.target.closest('#login-show-create')) {
        this.mode = 'create';
        this.selectedUser = null;
        this.render();
      }
      if (event.target.closest('#login-back')) {
        this.mode = 'signin';
        this.selectedUser = null;
        this.render();
      }
      if (event.target.closest('#login-retry')) window.location.reload();
    });
    this.root.addEventListener('submit', event => {
      event.preventDefault();
      this.submit();
    });
  }

  show(animate = false) {
    document.body.classList.remove('app-unlocked');
    this.mode = 'signin';
    this.selectedUser = null;
    if (!this.root) return;

    clearTimeout(this.revealTimer);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (animate && !this.hasAnimated && !reduceMotion) {
      this.root.classList.remove('login-ready');
      this.root.classList.add('login-intro');
      this.render();
      this.root.hidden = false;
      this.revealTimer = setTimeout(() => {
        this.root.classList.remove('login-intro');
        this.root.classList.add('login-ready');
        this.hasAnimated = true;
        this.focusPrimaryField();
      }, 2050);
    } else {
      this.root.classList.remove('login-intro');
      this.root.classList.add('login-ready');
      this.render();
      this.root.hidden = false;
      this.hasAnimated = true;
      requestAnimationFrame(() => this.focusPrimaryField());
    }
  }

  hide() {
    clearTimeout(this.revealTimer);
    document.body.classList.add('app-unlocked');
    if (this.root) this.root.hidden = true;
  }

  focusPrimaryField() {
    this.root?.querySelector('#login-username, #login-pin')?.focus();
  }

  render() {
    if (!this.root) return;
    let body;

    if (this.bootError) {
      body = `
        <div class="login-form login-status-panel">
          <span class="login-eyebrow">Connection required</span>
          <h2>Plutus could not start securely</h2>
          <p class="login-copy">The private local service is unavailable. Your vault has not been opened.</p>
          <p class="login-error">${this.escape(this.bootError)}</p>
          <button type="button" class="btn btn-secondary login-submit" id="login-retry">Retry connection</button>
        </div>`;
    } else if (this.mode === 'create') {
      body = `
        <form id="login-form" class="login-form" novalidate>
          <button type="button" class="login-back" id="login-back">← Back to sign in</button>
          <span class="login-eyebrow">New private vault</span>
          <h2>Create your profile</h2>
          <p class="login-copy">Choose a username and a PIN only you know. Financial data remains encrypted on this computer.</p>
          <label class="form-label" for="login-username">Username</label>
          <input class="form-input" id="login-username" name="username" autocomplete="username" maxlength="32" placeholder="Enter a username" required>
          <label class="form-label" for="login-pin">PIN (6–12 digits)</label>
          <input class="form-input" id="login-pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6,12}" minlength="6" maxlength="12" autocomplete="new-password" placeholder="Create a secure PIN" required>
          <label class="form-label" for="login-pin-confirm">Confirm PIN</label>
          <input class="form-input" id="login-pin-confirm" name="pinConfirm" type="password" inputmode="numeric" pattern="\\d{6,12}" minlength="6" maxlength="12" autocomplete="new-password" placeholder="Repeat your PIN" required>
          <p class="login-error" id="login-error" hidden></p>
          <button class="btn btn-primary login-submit" type="submit">Create encrypted vault</button>
        </form>`;
    } else if (this.mode === 'setup') {
      body = `
        <form id="login-form" class="login-form" novalidate>
          <button type="button" class="login-back" id="login-back">← Back to sign in</button>
          <span class="login-eyebrow">Security upgrade</span>
          <h2>Protect this vault</h2>
          <p class="login-copy">Create a new PIN to finish securing this existing local vault.</p>
          <label class="form-label" for="login-pin">New PIN (6–12 digits)</label>
          <input class="form-input" id="login-pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6,12}" minlength="6" maxlength="12" autocomplete="new-password" placeholder="Create a secure PIN" required>
          <label class="form-label" for="login-pin-confirm">Confirm PIN</label>
          <input class="form-input" id="login-pin-confirm" name="pinConfirm" type="password" inputmode="numeric" pattern="\\d{6,12}" minlength="6" maxlength="12" autocomplete="new-password" placeholder="Repeat your PIN" required>
          <p class="login-error" id="login-error" hidden></p>
          <button class="btn btn-primary login-submit" type="submit">Secure and open vault</button>
        </form>`;
    } else {
      body = `
        <form id="login-form" class="login-form" novalidate>
          <span class="login-eyebrow">Private vault access</span>
          <h2>Welcome back</h2>
          <p class="login-copy">Enter your credentials to unlock your encrypted financial workspace.</p>
          <label class="form-label" for="login-username">Username</label>
          <input class="form-input" id="login-username" name="username" autocomplete="username" maxlength="32" placeholder="Enter your username" required>
          <label class="form-label" for="login-pin">PIN</label>
          <input class="form-input" id="login-pin" name="pin" type="password" inputmode="numeric" pattern="\\d{4,12}" minlength="4" maxlength="12" autocomplete="current-password" placeholder="Enter your PIN" required>
          <p class="login-error" id="login-error" hidden></p>
          <button class="btn btn-primary login-submit" type="submit">Unlock Plutus</button>
          <div class="login-divider"><span>New to Plutus?</span></div>
          <button type="button" class="login-create-link" id="login-show-create">Create a private vault</button>
        </form>`;
    }

    this.root.innerHTML = `
      <div class="login-shell">
        <section class="login-identity" aria-label="Plutus">
          <div class="login-logo-mark" aria-hidden="true"><span>P</span></div>
          <div class="login-wordmark">
            <strong>PLUTUS</strong>
            <span>Private finance, clearly yours.</span>
          </div>
        </section>
        <section class="login-panel" aria-label="Sign in">
          ${body}
          <div class="login-security-note"><span aria-hidden="true">●</span> Encrypted locally · Nothing opens before authentication</div>
        </section>
      </div>`;

    if (this.root.classList.contains('login-ready')) requestAnimationFrame(() => this.focusPrimaryField());
  }

  escape(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  setError(message) {
    const element = this.root.querySelector('#login-error');
    if (!element) return;
    element.hidden = !message;
    element.textContent = message || '';
  }

  async submit() {
    const usernameInput = this.root.querySelector('#login-username');
    const pinInput = this.root.querySelector('#login-pin');
    const confirmInput = this.root.querySelector('#login-pin-confirm');
    const username = usernameInput?.value.trim() || this.selectedUser || '';
    const pin = pinInput?.value.trim() || '';
    const confirmation = confirmInput?.value.trim() || '';

    try {
      this.setError('');
      let session;
      if (this.mode === 'create') {
        if (pin !== confirmation) throw new Error('PINs do not match.');
        session = await auth.createUser(username, pin);
      } else if (this.mode === 'setup') {
        if (pin !== confirmation) throw new Error('PINs do not match.');
        session = await auth.setupPin(this.selectedUser, pin);
      } else {
        const profile = auth.findUser(username);
        if (profile?.needsPinSetup) {
          this.selectedUser = profile.username;
          this.mode = 'setup';
          this.render();
          return;
        }
        session = await auth.unlock(username, pin);
      }

      await store.attachSession(session.profile, session.key, session.dataset);
      this.hide();
      if (window.plutusApp) window.plutusApp.start();
      toast.success('Vault unlocked securely.');
    } catch (error) {
      const message = this.mode === 'signin' ? 'Incorrect username or PIN.' : (error.message || 'Could not open the vault.');
      this.setError(message);
      if (pinInput) { pinInput.value = ''; pinInput.focus(); }
    }
  }
}

export const loginGate = new LoginGate();

document.addEventListener('DOMContentLoaded', () => {
  window.plutusLogin = loginGate;
  loginGate.boot();
});
