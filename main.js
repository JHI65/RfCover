const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 7359;
let win;
let server;

function startLocalServer() {
  const htmlPath = path.join(__dirname, 'index.html');
  const html = fs.readFileSync(htmlPath);

  server = http.createServer((req, res) => {
    // Serve index.html for all routes so the OAuth redirect hash lands correctly
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  return new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve);
    server.on('error', reject);
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' }
      ]
    },
    {
      label: 'Vista',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    }
  ];

  // DevTools only in development
  if (!app.isPackaged) {
    template[2].submenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }
    );
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  await startLocalServer();

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'RF Coverage Planner',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Allow the OAuth redirect to load back from localhost
      additionalArguments: [],
    }
  });

  buildMenu();

  win.loadURL(`http://localhost:${PORT}`);

  // Keep OAuth flow inside the app window (Supabase implicit flow redirects back
  // to http://localhost:7359 with the access_token hash — no external handler needed)
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Open any pop-up links (e.g. external docs) in the system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!win) createWindow();
});
