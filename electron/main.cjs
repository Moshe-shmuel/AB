const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require('electron');
const path = require('node:path');

// Keep a consistent userData directory so localStorage persists across portable, zip, and installed .exe launches
app.setPath('userData', path.join(app.getPath('appData'), 'BudgetMaaserPro'));

// Hardware acceleration & V8 cache flags for faster startup
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  function getIconPath() {
    return path.join(
      __dirname,
      process.platform === 'win32' ? 'icon.ico' : 'icon.png'
    );
  }

  function createSplashWindow() {
    splashWindow = new BrowserWindow({
      width: 360,
      height: 220,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      skipTaskbar: false,
      center: true,
      icon: getIconPath(),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const splashHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    overflow: hidden;
  }
  .card {
    width: 340px;
    height: 200px;
    background: linear-gradient(145deg, #0f172a 0%, #1e3a8a 100%);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 20px 45px rgba(2, 6, 23, 0.45);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    text-align: center;
    padding: 24px;
  }
  .badge {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    font-weight: 800;
    color: #fbbf24;
    margin-bottom: 14px;
  }
  .title {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.2px;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 12px;
    color: #93c5fd;
    margin-bottom: 16px;
  }
  .loader {
    width: 120px;
    height: 4px;
    background: rgba(255,255,255,0.15);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }
  .bar {
    width: 45%;
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #fbbf24);
    border-radius: 999px;
    animation: slide 1s infinite ease-in-out;
  }
  @keyframes slide {
    0% { transform: translateX(110%); }
    50% { transform: translateX(-110%); }
    100% { transform: translateX(110%); }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">₪</div>
    <div class="title">כלכלת הבית ומעשרות Pro</div>
    <div class="subtitle">פותח את סביבת העבודה שלך...</div>
    <div class="loader"><div class="bar"></div></div>
  </div>
</body>
</html>`;

    splashWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`
    );
  }

  function createTray() {
    if (tray) return;
    try {
      const icon = nativeImage.createFromPath(getIconPath());
      tray = new Tray(icon);
      tray.setToolTip('כלכלת הבית ומעשרות Pro (פועל ברקע לפתיחה מיידית)');

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'פתיחת כלכלת הבית ומעשרות Pro',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'יציאה מלאה מהתוכנה',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);

      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    } catch {
      // Ignore tray errors on environments without system tray support
    }
  }

  function createMainWindow() {
    mainWindow = new BrowserWindow({
      width: 1380,
      height: 880,
      minWidth: 960,
      minHeight: 640,
      title: 'כלכלת הבית ומעשרות Pro',
      icon: getIconPath(),
      backgroundColor: '#F8FAFC',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        v8CacheOptions: 'code',
      },
    });

    mainWindow.setMenuBarVisibility(false);

    mainWindow.once('ready-to-show', () => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    });

    // Minimize to tray on close so reopening is instant (0.1s)
    mainWindow.on('close', (event) => {
      if (!isQuitting && tray) {
        event.preventDefault();
        mainWindow.hide();
      }
    });

    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  }

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.whenReady().then(() => {
    createSplashWindow();
    createTray();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !tray) {
      app.quit();
    }
  });
}
