
const { app, BrowserWindow, ipcMain, dialog, protocol, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const jsmediatags = require('jsmediatags');
const NodeID3 = require('node-id3');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Borderless for custom UI
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Security: keep false
      contextIsolation: true, // Security: keep true
      webSecurity: false // Allow loading local files via file:// protocol
    },
    icon: path.join(__dirname, 'public/icon.png')
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'build/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Set initial Taskbar Buttons (Windows Only)
  if (process.platform === 'win32') {
      updateThumbarButtons(false);
  }
}

// Helper to update Windows Taskbar Buttons
const updateThumbarButtons = (isPlaying) => {
    if (!mainWindow) return;
    try {
        mainWindow.setThumbarButtons([
            {
                tooltip: 'Previous',
                icon: path.join(__dirname, 'public', 'prev.png'), // Placeholder path
                click: () => mainWindow.webContents.send('media:prev'),
                flags: ['nobackground']
            },
            {
                tooltip: isPlaying ? 'Pause' : 'Play',
                icon: isPlaying 
                    ? path.join(__dirname, 'public', 'pause.png') 
                    : path.join(__dirname, 'public', 'play.png'),
                click: () => mainWindow.webContents.send('media:playpause'),
                flags: ['nobackground']
            },
            {
                tooltip: 'Next',
                icon: path.join(__dirname, 'public', 'next.png'),
                click: () => mainWindow.webContents.send('media:next'),
                flags: ['nobackground']
            }
        ]);
    } catch (e) {
        // Silently fail if icons are missing or platform not supported
    }
};

// --- NATIVE HANDLERS ---

// 1. Recursively scan directory for files
const walkDir = (dir, extensions, files = []) => {
  try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        try {
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                walkDir(filePath, extensions, files);
            } else {
                const ext = path.extname(file).toLowerCase();
                if (extensions.includes(ext)) {
                    files.push(filePath);
                }
            }
        } catch (e) {
            // Ignore access errors
        }
      }
  } catch (e) {
      // Ignore directory access errors
  }
  return files;
};

// 2. Parse Metadata using Node.js version of jsmediatags
const parseFileMetadata = (filePath) => {
  return new Promise((resolve) => {
    const fileName = path.basename(filePath, path.extname(filePath));
    const defaultData = {
       path: filePath,
       title: fileName,
       artist: "Unknown Artist",
       album: "Unknown Album",
       coverUrl: undefined
    };

    new jsmediatags.Reader(filePath)
      .read({
        onSuccess: (tag) => {
           const tags = tag.tags;
           let coverUrl = undefined;
           
           if (tags.picture) {
              const { data, format } = tags.picture;
              const base64String = Buffer.from(data).toString('base64');
              coverUrl = `data:${format};base64,${base64String}`;
           }

           const getText = (field) => {
               if (!field) return null;
               if (Array.isArray(field)) return getText(field[0]);
               if (typeof field === 'string') return field.trim();
               if (typeof field === 'object' && field.data) return field.data.trim();
               return null;
           };

           const getTxxxValue = (validDescriptions) => {
                if (!tags.TXXX) return null;
                const frames = Array.isArray(tags.TXXX) ? tags.TXXX : [tags.TXXX];
                for (const f of frames) {
                    const description = f.description || f.user_description;
                    if (description && typeof description === 'string') {
                        if (validDescriptions.includes(description.toLowerCase().trim())) {
                             return getText(f);
                        }
                    }
                }
                return null;
           };

           const detectedArtist = 
               getTxxxValue(['album artist', 'albumartist', 'album_artist']) ||
               getText(tags.TPE2) ||           
               getText(tags.TP2) ||            
               getText(tags.aART) ||           
               getText(tags.band) ||           
               getText(tags.performerInfo) ||  
               getText(tags.albumArtist) ||    
               getText(tags.ALBUMARTIST) ||    
               getText(tags['Album Artist']) || 
               getTxxxValue(['band', 'orchestra', 'accompaniment']) || 
               getText(tags.TPE1) ||           
               getText(tags.artist);           

           resolve({
              ...defaultData,
              title: tags.title || fileName,
              artist: detectedArtist || "Unknown Artist",
              album: tags.album || "Unknown Album",
              year: tags.year,
              genre: tags.genre,
              coverUrl
           });
        },
        onError: () => {
           resolve(defaultData);
        }
    });
  });
};

// 3. Core Logic for Scanning a Directory (Reusable)
const scanDirectoryLogic = async (rootPath) => {
    const audioExts = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
    const audioFiles = walkDir(rootPath, audioExts);
    
    const songs = [];
    for (const file of audioFiles) {
        const data = await parseFileMetadata(file);
        songs.push(data);
    }
    return songs;
};

app.whenReady().then(() => {
  // IPC: Update Taskbar when React App changes state
  ipcMain.on('media:status-change', (event, isPlaying) => {
      if (process.platform === 'win32') {
          updateThumbarButtons(isPlaying);
      }
  });

  // Handler: Open Audio Dialog (Manual Selection)
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (canceled) return { rootPath: null, songs: [] };

    const rootPath = filePaths[0];
    const songs = await scanDirectoryLogic(rootPath);
    return { rootPath, songs };
  });

  // Handler: Background Scan (Auto Selection from Saved Path)
  ipcMain.handle('media:scanDirectory', async (event, rootPath) => {
      if (!rootPath || !fs.existsSync(rootPath)) return [];
      try {
          return await scanDirectoryLogic(rootPath);
      } catch (e) {
          console.error("Auto-scan failed:", e);
          return [];
      }
  });

  // Handler: Open Image Dialog
  ipcMain.handle('dialog:openImageDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      message: 'Select folder containing visuals/wallpapers'
    });
    
    if (canceled) return [];

    const rootPath = filePaths[0];
    const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
    // Fast walk, return raw paths
    return walkDir(rootPath, imgExts);
  });

  // Handler: Write Metadata (ID3)
  ipcMain.handle('media:writeMetadata', async (event, filePath, metadata) => {
      try {
          if (!fs.existsSync(filePath)) return false;

          const tags = {
              title: metadata.title,
              artist: metadata.artist,
              album: metadata.album,
              year: metadata.year,
              genre: metadata.genre,
          };

          // Handle Image writing if present (Base64 -> Buffer)
          if (metadata.coverUrl && metadata.coverUrl.startsWith('data:image')) {
              try {
                  const base64Data = metadata.coverUrl.split(';base64,').pop();
                  const imageBuffer = Buffer.from(base64Data, 'base64');
                  
                  tags.image = {
                      mime: 'image/jpeg',
                      type: {
                          id: 3,
                          name: 'front cover'
                      },
                      description: 'Cover',
                      imageBuffer: imageBuffer
                  };
              } catch (e) {
                  console.error("Failed to process image for tagging", e);
              }
          }

          // Node-ID3 synchronous write
          const success = NodeID3.write(tags, filePath);
          return !!success;
      } catch (e) {
          console.error("Error writing metadata:", e);
          return false;
      }
  });

  createWindow();

  // --- GLOBAL SHORTCUTS ---
  globalShortcut.register('CommandOrControl+Shift+P', () => {
      if (mainWindow) mainWindow.webContents.send('media:playpause');
  });

  globalShortcut.register('CommandOrControl+Shift+N', () => {
      if (mainWindow) mainWindow.webContents.send('media:next');
  });

  globalShortcut.register('CommandOrControl+Shift+A', () => {
      if (mainWindow) mainWindow.webContents.send('media:prev');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
