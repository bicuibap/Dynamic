// Quick Actions and Theme Switcher
class QuickActions {
  constructor() {
    this.init();
  }

  init() {
    const actionTiles = document.querySelectorAll('.action-tile');
    actionTiles.forEach(tile => {
      tile.addEventListener('click', (e) => {
        const action = tile.dataset.action;
        if (action && window.electronAPI) {
          window.electronAPI.triggerQuickAction(action);
        }
      });
    });

    // Theme selector
    const themeSelect = document.getElementById('theme-selector');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        document.body.dataset.theme = e.target.value;
      });
    }
  }
}

window.QuickActions = QuickActions;
