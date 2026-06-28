/** Header / browser chrome colors — keep in sync with --color-elev in app.css */
export const THEME_ELEV = {
  dark: '#161b22',
  light: '#f6f8fa'
};

/** @param {'light' | 'dark'} theme */
export function applyThemeChrome(theme) {
  const color = THEME_ELEV[theme] ?? THEME_ELEV.dark;

  let themeColor = document.querySelector('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.appendChild(themeColor);
  }
  themeColor.content = color;

  let statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (!statusBar) {
    statusBar = document.createElement('meta');
    statusBar.name = 'apple-mobile-web-app-status-bar-style';
    document.head.appendChild(statusBar);
  }
  statusBar.content = theme === 'light' ? 'default' : 'black';
}
