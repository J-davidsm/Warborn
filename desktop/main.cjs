const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');

const isDev = process.argv.includes('--dev');

let mainWindow;
app.setName('Acadania');
// Reuse the original profile so renaming the app keeps all saved scenarios.
app.setPath('userData', require('./profile.cjs').profilePath(app.getPath('appData')));
// Startup checks must never read or alter a player's real saves.
if (process.argv.includes('--smoke-test')) {
  app.setPath('userData', require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'acadania-smoke-')));
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, '..', 'assets', 'app', 'warborn-icon.png'),
    show: false, // Don't show until ready-to-show
    titleBarStyle: 'default',
    title: 'Acadania'
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  if (process.argv.includes('--smoke-test')) {
    const deadline = setTimeout(() => { console.error('Desktop smoke test timed out'); app.exit(1); }, 60000);
    mainWindow.webContents.on('did-finish-load', async () => {
      try {
        const ok = await mainWindow.webContents.executeJavaScript("!!document.getElementById('menuOnlineBtn') && typeof OnlineMatch !== 'undefined' && typeof BattleGenerator !== 'undefined' && typeof UnitPresentation !== 'undefined'");
        clearTimeout(deadline); console.log('Desktop smoke test:', ok ? 'PASS' : 'FAIL'); app.exit(ok ? 0 : 1);
      } catch (e) { console.error(e); app.exit(1); }
    });
    mainWindow.webContents.on('did-fail-load', () => app.exit(1));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (!process.argv.includes('--smoke-test')) mainWindow.show();
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}



function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Game',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.executeJavaScript('restartGame();');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Acadania',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Acadania',
              message: `Acadania v${app.getVersion()}`,
              detail: 'A turn-based strategy game built with p5.js and Electron.'
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Window menu
    template[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'local-network-access') {
      callback(true);
      return;
    }
    callback(false);
  });
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // Re-create window on macOS when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
