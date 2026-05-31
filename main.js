const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ---- Data store: a plain JSON file in the user's app-data folder ----
const DATA_DIR = app.getPath('userData');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const EMPTY = { servers: [], connections: [] };

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        servers: Array.isArray(parsed.servers) ? parsed.servers : [],
        connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      };
    }
  } catch (e) {
    console.error('Failed to read data file:', e);
  }
  return { ...EMPTY };
}

function writeData(data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // atomic-ish write: write to temp then rename
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    return { ok: true };
  } catch (e) {
    console.error('Failed to write data file:', e);
    return { ok: false, error: String(e) };
  }
}

// ---- IPC handlers (called from the renderer via preload bridge) ----
ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:save', (_evt, data) => writeData(data));
ipcMain.handle('data:path', () => DATA_FILE);

ipcMain.handle('data:export', async (_evt, data) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export servers backup',
    defaultPath: 'servers-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('data:import', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import servers backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.servers)) throw new Error('Not a valid backup file');
    return {
      ok: true,
      data: {
        servers: parsed.servers,
        connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      },
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ---- Launch VS Code Remote-SSH for a server ----
function findCodeExecutables() {
  const out = [];
  const L = process.env.LOCALAPPDATA, P = process.env.ProgramFiles, P86 = process.env['ProgramFiles(x86)'];
  // Common install locations (stable + insiders)
  const dirs = [];
  if (L) dirs.push(path.join(L, 'Programs', 'Microsoft VS Code'), path.join(L, 'Programs', 'Microsoft VS Code Insiders'));
  if (P) dirs.push(path.join(P, 'Microsoft VS Code'), path.join(P, 'Microsoft VS Code Insiders'));
  if (P86) dirs.push(path.join(P86, 'Microsoft VS Code'));
  for (const d of dirs) {
    for (const bin of ['code.cmd', 'code-insiders.cmd']) {
      const p = path.join(d, 'bin', bin);
      try { if (fs.existsSync(p)) out.push(p); } catch (e) {}
    }
  }
  return out;
}

function spawnCode(cmd, args, useShell) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell: useShell });
      child.on('error', (err) => resolve({ ok: false, error: String(err) }));
      child.unref();
      setTimeout(() => resolve({ ok: true, via: 'cli' }), 350);
    } catch (err) {
      resolve({ ok: false, error: String(err) });
    }
  });
}

ipcMain.handle('vscode:connect', async (_evt, info) => {
  const { host, user, remotePath } = info || {};
  if (!host) return { ok: false, error: 'This server has no host/IP set.' };
  const authority = 'ssh-remote+' + (user ? user + '@' : '') + host;
  const args = ['--remote', authority];
  const folder = (remotePath || '').trim();
  if (folder) args.push(folder);

  // 1) Try an explicit code executable, then 'code' on PATH.
  for (const exe of findCodeExecutables()) {
    const res = await spawnCode(exe, args, false);
    if (res.ok) return res;
  }
  const pathRes = await spawnCode('code', args, true); // resolves code.cmd via PATH
  if (pathRes.ok) return pathRes;

  // 2) Fallback: the vscode:// URI handler (registered by any VS Code install).
  const uriFolder = folder ? (folder.startsWith('/') ? folder : '/' + folder) : '/';
  const uri = `vscode://vscode-remote/${authority}${uriFolder}`;
  try {
    await shell.openExternal(uri);
    return { ok: true, via: 'uri' };
  } catch (err) {
    return { ok: false, error: 'Could not launch VS Code. Make sure it is installed with the Remote-SSH extension.' };
  }
});

// ---- Window ----
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#0e1116',
    title: 'Server Manager',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
