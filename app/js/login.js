/* ==========================================================================
   PLUTUS FINANCE - LOGIN GATE
   ========================================================================== */

import { auth } from './auth.js';
import { store } from './state.js';
import { toast } from './components/toast.js';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class LoginGate {
  constructor() {
    this.root = document.getElementById('login-screen');
    this.mode = 'signin';
    this.selectedUser = null;
    this.bootError = null;
  }

  async boot() {
    try {
      await auth.syncDiskRegistry();
    } catch (error) {
      this.bootError = error.message || 'Secure local server is unavailable.';
    }
    this.bind();
    this.show();
  }

  bind() {
    if (!this.root || this.root.dataset.bound === 'true') return;
    this.root.dataset.bound = 'true';
    this.root.addEventListener('click', (e) => {
      const userBtn = e.target.closest('[data-user]');
      if (userBtn) {
        this.selectedUser = userBtn.getAttribute('data-user');
        this.mode = userBtn.getAttribute('data-setup') === 'true' ? 'setup' : 'signin';
        this.render();
        return;
      }
      if (e.target.closest('#login-show-create')) {
        this.mode = 'create';
        this.selectedUser = null;
        this.render();
      }
      if (e.target.closest('#login-back')) {
        this.mode = 'signin';
        this.selectedUser = null;
        this.render();
      }
      if (e.target.closest('#login-retry')) window.location.reload();
    });
    this.root.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
  }

  show() {
    document.body.classList.remove('app-unlocked');
    this.mode = 'signin';
    this.selectedUser = null;
    this.render();
    if (this.root) this.root.hidden = false;
  }

  hide() {
    document.body.classList.add('app-unlocked');
    if (this.root) this.root.hidden = true;
  }

  render() {
    if (!this.root) return;
    const users = auth.users;
    let body = '';

    if (this.mode === 'create') {
      body = `
        <form id="login-form" class="login-form">
          <button type="button" class="login-back" id="login-back">← Back</button>
          <h2>Create profile</h2>
          <p class="login-copy">A folder will be created at <code>User_data/YourName</code>. Only this PIN can unlock that ledger.</p>
          <label class="form-label" for="login-username">Name</label>
          <input class="form-input" id="login-username" name="username" autocomplete="username" maxlength="32" placeholder="e.g. Alex" required>
          <label class="form-label" for="login-pin">PIN (6–12 digits)</label>
          <input class="form-input" id="login-pin" name="pin" type="password" inputmode="numeric" pattern="\\d{6,12}" minlength="6" maxlength="12" autocomplete="new-password" required>
          <label class="form-label" for="login-pin-confirm">Confirm PIN</label>
          <input class="form-input" id="login-pin-confirm" name="pinConfirm" type="password" inputmode="numeric" pattern="\\d{6,12}" minlength="6" maxlength="12" autocomplete="new-password" required>
          <p class="login-error" id="login-error" hidden></p>
          <button class="btn btn-primary login-submit" type="submit">Create vault</button>
        </form>
      `;
    } else if (this.selectedUser) {
      const user = auth.findUser(this.selectedUser);
      const setup = this.mode === 'setup' || user?.needsPinSetup;
      body = `
        <form id="login-form" class="login-form">
          <button type="button" class="login-back" id="login-back">← All profiles</button>
          <h2>${setup ? 'Protect this vault' : 'Welcome back'}</h2>
          <p class="login-copy">${setup
            ? `Set a PIN for <strong>${escapeHtml(this.selectedUser)}</strong>. Your existing ledger will move into <code>User_data/${escapeHtml(user?.folder || this.selectedUser)}</code>.`
            : `Enter the PIN for <strong>${escapeHtml(this.selectedUser)}</strong> to open <code>User_data/${escapeHtml(user?.folder || this.selectedUser)}</code>.`}</p>
          <label class="form-label" for="login-pin">${setup ? 'Create PIN (6–12 digits)' : 'PIN'}</label>
          <input class="form-input" id="login-pin" name="pin" type="password" inputmode="numeric" pattern="${setup ? '\\d{6,12}' : '\\d{4,12}'}" minlength="${setup ? '6' : '4'}" maxlength="12" autocomplete="${setup ? 'new-password' : 'current-password'}" required>
          ${setup ? `<label class="form-label" for="login-pin-confirm">Confirm PIN</label>
          <input class="form-input" id="login-pin-confirm" name="pinConfirm" type="password" inputmode="numeric" pattern="\\d{6,12}" minlength="6" maxlength="12" autocomplete="new-password" required>` : ''}
          <p class="login-error" id="login-error" hidden></p>
          <button class="btn btn-primary login-submit" type="submit">${setup ? 'Save PIN & migrate data' : 'Unlock'}</button>
        </form>
      `;
    } else {
      const cards = users.length
        ? users.map(u => {
            const setup = u.needsPinSetup;
            return `
              <button type="button" class="login-user-card" data-user="${escapeHtml(u.username)}" data-setup="${setup ? 'true' : 'false'}">
                <span class="login-user-avatar">${escapeHtml(u.username.slice(0, 1).toUpperCase())}</span>
                <span class="login-user-meta">
                  <strong>${escapeHtml(u.username)}</strong>
                  <small>${setup ? 'PIN not set · data will migrate here' : 'User_data/' + escapeHtml(u.folder)}</small>
                </span>
              </button>
            `;
          }).join('')
        : this.bootError
          ? `<p class="login-error">${escapeHtml(this.bootError)}</p><button type="button" class="btn btn-secondary login-submit" id="login-retry">Retry connection</button>`
          : `<p class="login-copy">No profiles yet. Create one to start a private vault.</p>`;

      body = `
        <div class="login-form">
          <h2>Select a profile</h2>
          <p class="login-copy">Plutus never opens a ledger until you unlock the matching user folder.</p>
          <div class="login-user-list">${cards}</div>
          <button type="button" class="btn btn-secondary login-submit" id="login-show-create">+ Create another profile</button>
        </div>
      `;
    }

    this.root.innerHTML = `
      <div class="login-card">
        <div class="login-brand">
          <span class="brand-logo-letter">P</span>
          <div>
            <strong>PLUTUS</strong>
            <span>Private vault login</span>
          </div>
        </div>
        ${body}
      </div>
    `;

    const pin = this.root.querySelector('#login-pin');
    if (pin) pin.focus();
  }

  setError(message) {
    const el = this.root.querySelector('#login-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  async submit() {
    const usernameInput = this.root.querySelector('#login-username');
    const pinInput = this.root.querySelector('#login-pin');
    const confirmInput = this.root.querySelector('#login-pin-confirm');
    const pin = pinInput ? pinInput.value.trim() : '';
    const confirm = confirmInput ? confirmInput.value.trim() : '';

    try {
      this.setError('');
      let session;
      if (this.mode === 'create') {
        const name = usernameInput ? usernameInput.value.trim() : '';
        if (pin !== confirm) throw new Error('PINs do not match.');
        session = await auth.createUser(name, pin);
      } else if (this.mode === 'setup' || (this.selectedUser && auth.findUser(this.selectedUser)?.needsPinSetup)) {
        if (pin !== confirm) throw new Error('PINs do not match.');
        session = await auth.setupPin(this.selectedUser, pin);
      } else {
        session = await auth.unlock(this.selectedUser, pin);
      }

      await store.attachSession(session.profile, session.key, session.dataset);
      this.hide();
      if (window.plutusApp) window.plutusApp.start();
      toast.success(`Vault open: User_data/${session.profile.folder}`);
    } catch (err) {
      this.setError(err.message || 'Could not unlock vault.');
    }
  }
}

export const loginGate = new LoginGate();

document.addEventListener('DOMContentLoaded', () => {
  window.plutusLogin = loginGate;
  loginGate.boot();
});
