/* ==========================================================================
   PLUTUS FINANCE - MAIN APPLICATION CONTROLLER (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store, CURRENCIES } from './state.js';
import { auth } from './auth.js';
import { modal } from './components/modal.js';
import { toast } from './components/toast.js';

import { renderDashboard } from './views/dashboardView.js';
import { renderTransactions } from './views/transactionsView.js';
import { renderWallets } from './views/walletsView.js';
import { renderBudgets } from './views/budgetsView.js';
import { renderGoals } from './views/goalsView.js';
import { renderCommitments } from './views/commitmentsView.js';
import { renderTools } from './views/toolsView.js';

class AppController {
  constructor() {
    this.currentView = 'dashboard';
    this.contentContainer = null;
    this.started = false;
  }

  start() {
    if (this.started) {
      this.refreshSessionUI();
      this.updateCurrencyUI();
      this.updateStealthUI();
      this.updateSidebarNetWorth();
      this.switchView('dashboard');
      return;
    }
    this.started = true;
    this.init();
  }

  init() {
    this.contentContainer = document.getElementById('view-content');

    // Register View Handlers with English titles and subtitles
    this.viewHandlers = {
      dashboard: {
        title: 'Dashboard',
        subtitle: 'Safe-to-spend, cash-flow forecast, and planning alerts',
        render: renderDashboard
      },
      transactions: {
        title: 'Transactions',
        subtitle: 'Filter, categorize, and track income and expenses',
        render: renderTransactions
      },
      wallets: {
        title: 'Accounts & Wallets',
        subtitle: 'Manage cash, bank accounts, and credit limits',
        render: renderWallets
      },
      budgets: {
        title: 'Budgets & Limits',
        subtitle: 'Safe daily spending limits and overspend alerts',
        render: renderBudgets
      },
      goals: {
        title: 'Savings Goals',
        subtitle: 'Milestone targets, emergency runway, and progress',
        render: renderGoals
      },
      commitments: {
        title: 'Bills & Debt',
        subtitle: 'Recurring payments, loans, and money owed to you',
        render: renderCommitments
      },
      tools: {
        title: 'Calculators & Data',
        subtitle: 'Compound growth, loan schedules, and offline backups',
        render: renderTools
      }
    };

    this.bindEvents();
    window.addEventListener('plutus:save-error', event => {
      toast.error(event.detail || 'Vault could not be saved.');
      this.updateSaveStatus('error');
    });
    window.addEventListener('plutus:save-status', event => this.updateSaveStatus(event.detail));
    window.addEventListener('beforeunload', event => {
      if (!store.hasPendingSaves) return;
      event.preventDefault();
      event.returnValue = '';
    });
    this.refreshSessionUI();
    this.updateCurrencyUI();
    this.updateStealthUI();
    this.updateSidebarNetWorth();
    this.switchView('dashboard');

    // State change subscriber
    store.subscribe(() => {
      this.updateSidebarNetWorth();
      this.renderCurrentView();
    });
  }

  switchView(viewName) {
    if (!this.viewHandlers[viewName]) return;
    this.currentView = viewName;

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });

    // Update Topbar header & subtitle
    const info = this.viewHandlers[viewName];
    const titleEl = document.getElementById('view-heading');
    const subEl = document.getElementById('view-subheading');
    if (titleEl) titleEl.innerText = info.title;
    if (subEl) subEl.innerText = info.subtitle;

    // Close mobile sidebar if open
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Render current view
    this.renderCurrentView();
  }

  renderCurrentView() {
    if (this.contentContainer && this.viewHandlers[this.currentView]) {
      this.viewHandlers[this.currentView].render(this.contentContainer);
    }
  }

  refreshSessionUI() {
    const nameEl = document.getElementById('sidebar-user-name');
    if (nameEl) nameEl.textContent = auth.currentUser?.username || 'Locked';
    const pathEl = document.getElementById('sidebar-user-path');
    if (pathEl && auth.currentUser) {
      pathEl.textContent = `User_data/${auth.currentUser.folder}`;
    }
  }

  updateSaveStatus(status) {
    const element = document.getElementById('save-status');
    if (!element) return;
    element.classList.toggle('saving', status === 'saving');
    element.classList.toggle('error', status === 'error');
    element.textContent = status === 'saving'
      ? 'Saving…'
      : status === 'error'
        ? 'Not saved to disk'
        : 'Saved securely';
  }

  async logout() {
    await store.flush();
    store.lock();
    document.body.classList.remove('app-unlocked');
    const content = document.getElementById('view-content');
    if (content) content.innerHTML = '';
    const net = document.getElementById('sidebar-networth-val');
    if (net) net.textContent = '—';
    if (window.plutusLogin) window.plutusLogin.show();
    toast.info('Vault locked. Sign in to continue.');
  }

  updateSidebarNetWorth() {
    const el = document.getElementById('sidebar-networth-val');
    if (!el) return;

    let net = 0;
    store.state.wallets.forEach(w => {
      net += w.balance;
    });
    store.state.debts.forEach(debt => {
      if (debt.active === false) return;
      net += debt.kind === 'receivable' ? debt.balance : -debt.balance;
    });

    el.innerText = store.formatMoney(net);
  }

  updateCurrencyUI() {
    const curr = store.currentCurrency;
    const btnText = document.getElementById('current-currency-text');
    if (btnText) btnText.innerText = `${curr.code} (${curr.symbol})`;

    // Highlight active option in dropdown
    document.querySelectorAll('.currency-option').forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-curr') === curr.code);
    });
  }

  updateStealthUI() {
    const isStealth = store.stealthMode;
    document.body.classList.toggle('stealth-active', isStealth);

    const btn = document.getElementById('btn-stealth-toggle');
    if (btn) {
      btn.classList.toggle('active', isStealth);
      btn.title = isStealth ? 'Balances hidden (Click to reveal)' : 'Hide balances for privacy (Press H)';
    }
  }

  bindEvents() {
    // 1. Navigation clicks
    document.querySelectorAll('[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // 2. Currency Selector Dropdown
    const currBtn = document.getElementById('btn-currency-select');
    const currDropdown = document.getElementById('currency-dropdown');

    if (currBtn && currDropdown) {
      currBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currDropdown.classList.toggle('show');
      });

      document.querySelectorAll('.currency-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const code = opt.getAttribute('data-curr');
          store.setCurrency(code);
          this.updateCurrencyUI();
          currDropdown.classList.remove('show');
          toast.success(`Currency switched to ${code}.`);
        });
      });

      document.addEventListener('click', () => {
        currDropdown.classList.remove('show');
      });
    }

    // 3. Stealth Mode Toggle
    const stealthBtn = document.getElementById('btn-stealth-toggle');
    if (stealthBtn) {
      stealthBtn.addEventListener('click', () => {
        const active = store.toggleStealthMode();
        this.updateStealthUI();
        toast.info(active ? 'Privacy mode: balances hidden' : 'Balances visible');
      });
    }

    // 4. Quick Add Transaction Button
    const quickAddBtn = document.getElementById('btn-top-add-tx');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => {
        modal.showAddTransactionModal();
      });
    }

    // 5. Mobile Menu Toggle
    const mobileBtn = document.getElementById('btn-mobile-menu');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // 6. Sign out
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // 7. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (!document.body.classList.contains('app-unlocked')) return;
      if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        modal.showAddTransactionModal();
      }
      // Press 'H' to toggle Stealth Mode
      if ((e.key === 'h' || e.key === 'H') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        const active = store.toggleStealthMode();
        this.updateStealthUI();
      }
      // Escape to close modals and dropdowns
      if (e.key === 'Escape') {
        modal.close();
        if (currDropdown) currDropdown.classList.remove('show');
      }
    });
  }
}

// Initialize on DOM ready — login gate is handled by authView.js / login overlay
document.addEventListener('DOMContentLoaded', () => {
  window.plutusApp = new AppController();
});
