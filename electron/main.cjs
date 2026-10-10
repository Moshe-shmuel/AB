const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

// Keep a consistent userData directory so localStorage persists across portable .exe launches
app.setPath('userData', path.join(app.getPath('appData'), 'BudgetMaaserPro'));

function createWindow() {
  const iconPath = path.join(
    __dirname,
    process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  );

  const mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: 'כלכלת הבית ומעשרות Pro',
    icon: iconPath,
    backgroundColor: '#F8FAFC',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
