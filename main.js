const { app, BrowserWindow, ipcMain, Notification, dialog, Tray, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const store = new Store();

let mainWindow;
let tray = null;
let reminderTimer = null;
let currentReminderIndex = 0; // 轮流提醒用的索引

// 默认配置文件内容
const defaultConfig = {
  version: "1.0.1",
  settings: {
    enabled: true,
    reminderTime: "09:00",
    voiceEnabled: true,
    volume: 1.0,
    startMinimized: false,
    autoStart: false,
    autoCheckUpdate: true
  },
  students: [],
  waterCount: 0,
  reminderIndex: 0,
  firstRun: true
};

// 初始化配置文件
function initializeConfig() {
  // 使用用户数据目录而不是应用目录
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'config.json');
  
  try {
    // 确保用户数据目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
      console.log('首次运行，创建默认配置文件...');
      console.log('配置文件位置:', configPath);
      
      // 创建默认配置文件
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      console.log('默认配置文件已创建:', configPath);
      
      // 将默认配置写入electron-store
      store.set('settings', defaultConfig.settings);
      store.set('students', defaultConfig.students);
      store.set('waterCount', defaultConfig.waterCount);
      store.set('reminderIndex', defaultConfig.reminderIndex);
      store.set('firstRun', defaultConfig.firstRun);
      
      console.log('默认配置已写入存储');
    } else {
      console.log('配置文件已存在，加载现有配置...');
      
      // 读取现有配置文件
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // 检查是否需要更新配置结构
      let configUpdated = false;
      
      // 如果配置文件中没有某些字段，添加默认值
      if (!config.settings) {
        config.settings = defaultConfig.settings;
        configUpdated = true;
      }
      
      if (!config.students) {
        config.students = defaultConfig.students;
        configUpdated = true;
      }
      
      if (config.waterCount === undefined) {
        config.waterCount = defaultConfig.waterCount;
        configUpdated = true;
      }
      
      if (config.reminderIndex === undefined) {
        config.reminderIndex = defaultConfig.reminderIndex;
        configUpdated = true;
      }
      
      if (config.firstRun === undefined) {
        config.firstRun = false;
        configUpdated = true;
      }
      
      // 更新版本号
      if (config.version !== defaultConfig.version) {
        config.version = defaultConfig.version;
        configUpdated = true;
      }
      
      // 如果配置有更新，保存文件
      if (configUpdated) {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('配置文件已更新');
      }
      
      // 将配置加载到electron-store
      store.set('settings', config.settings);
      store.set('students', config.students);
      store.set('waterCount', config.waterCount);
      store.set('reminderIndex', config.reminderIndex);
      store.set('firstRun', config.firstRun);
      
      console.log('现有配置已加载');
    }
    
    return true;
  } catch (error) {
    console.error('初始化配置文件失败:', error);
    return false;
  }
}

// 更新配置文件
function updateConfigFile() {
  // 使用用户数据目录而不是应用目录
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'config.json');
  
  try {
    const config = {
      version: defaultConfig.version,
      settings: store.get('settings', defaultConfig.settings),
      students: store.get('students', defaultConfig.students),
      waterCount: store.get('waterCount', defaultConfig.waterCount),
      reminderIndex: store.get('reminderIndex', defaultConfig.reminderIndex),
      firstRun: store.get('firstRun', defaultConfig.firstRun)
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('配置文件已同步更新');
    return true;
  } catch (error) {
    console.error('更新配置文件失败:', error);
    return false;
  }
}

// 防止重复启动
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 已经有实例在运行了
  console.log('应用已在运行，退出当前实例');
  app.quit();
} else {
  // 第二个实例启动时显示窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('检测到第二个实例启动，显示主窗口');
    
    // 弹个通知
    if (Notification.isSupported()) {
      new Notification({
        title: '每日抬水提醒',
        body: '应用已在运行，正在显示主窗口',
        icon: path.join(__dirname, 'assets/icon.png')
      }).show();
    }
    
    if (mainWindow) {
      // 恢复最小化的窗口
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      
      // 显示隐藏的窗口
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      
      // 置顶1秒后取消
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        mainWindow.setAlwaysOnTop(false);
      }, 1000);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 无边框
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false
  });

  mainWindow.loadFile('index.html');

  // 等窗口准备好再显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 监听最大化状态
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
  });

  // 开发模式开调试工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // 关闭时隐藏而不是退出
  mainWindow.on('close', (event) => {
    if (app.isQuitting) {
      return;
    }
    
    // Windows/Linux 隐藏窗口
    if (process.platform !== 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  try {
    console.log('创建托盘图标...');
    
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    console.log('托盘图标路径:', iconPath);
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示窗口',
        click: () => {
          console.log('点击显示窗口');
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: '隐藏窗口',
        click: () => {
          console.log('点击隐藏窗口');
          if (mainWindow) {
            mainWindow.hide();
          }
        }
      },
      { type: 'separator' },
      {
        label: '测试提醒',
        click: () => {
          console.log('点击测试提醒');
          triggerReminder();
        }
      },
      { type: 'separator' },
      {
        label: '退出应用',
        click: () => {
          console.log('点击退出应用');
          app.isQuitting = true;
          if (tray) {
            tray.destroy();
            tray = null;
          }
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('每日抬水提醒');
    
    // 双击切换显示/隐藏
    tray.on('double-click', () => {
      console.log('双击托盘图标');
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    
    console.log('托盘创建成功');
  } catch (error) {
    console.error('创建托盘失败:', error);
  }
}

app.whenReady().then(() => {
  console.log('应用启动中...');
  
  // 首先初始化配置文件
  console.log('正在初始化配置文件...');
  if (!initializeConfig()) {
    console.error('配置文件初始化失败，应用将退出');
    app.quit();
    return;
  }
  console.log('配置文件初始化完成');
  
  const settings = store.get('settings', {});
  
  createWindow();
  console.log('窗口创建完成');
  
  createTray();
  console.log('托盘创建完成');
  
  initializeReminder();
  console.log('提醒功能初始化完成');
  
  // 启动时最小化
  if (settings.startMinimized) {
    console.log('启动时最小化到托盘');
    mainWindow.hide();
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  console.log('应用启动完成');
  
  // 应用启动完成后再检查更新，延迟2秒确保所有初始化完成
  setTimeout(() => {
    checkForUpdates();
    console.log('更新检查已启动');
  }, 2000);
});

// macOS 窗口关闭时退出
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  console.log('应用即将退出...');
  app.isQuitting = true;
  
  // 清理资源
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

function initializeReminder() {
  const settings = store.get('settings', {});
  currentReminderIndex = store.get('reminderIndex', 0);
  
  if (settings.enabled && settings.reminderTime) {
    scheduleReminder(settings.reminderTime);
  }
}

function scheduleReminder(timeString) {
  if (reminderTimer) {
    clearInterval(reminderTimer);
  }

  const [hours, minutes] = timeString.split(':').map(Number);
  const now = new Date();
  let reminderTime = new Date();
  reminderTime.setHours(hours, minutes, 0, 0);

  // 时间过了就明天
  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  // 周日不抬水，跳到周一
  while (reminderTime.getDay() === 0) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  const timeUntilReminder = reminderTime.getTime() - now.getTime();
  
  setTimeout(() => {
    triggerReminder();
    // 每天重复，但周日跳过
    reminderTimer = setInterval(() => {
      const currentDate = new Date();
      if (currentDate.getDay() !== 0) {
        triggerReminder();
      }
    }, 24 * 60 * 60 * 1000);
  }, timeUntilReminder);
}

function triggerReminder() {
  // 周日不提醒
  const currentDate = new Date();
  if (currentDate.getDay() === 0) {
    console.log('今天是周日，跳过抬水提醒');
    return;
  }

  const settings = store.get('settings', {});
  const students = store.get('students', []);
  
  if (students.length === 0) {
    // 没学生就用默认消息
    const defaultMessage = '请及时前往艺体馆抬水';
    
    if (Notification.isSupported()) {
      new Notification({
        title: '每日抬水提醒',
        body: defaultMessage,
        icon: path.join(__dirname, 'assets/icon.png')
      }).show();
    }

    if (settings.voiceEnabled) {
      speakText(defaultMessage);
    }

    // 默认加3桶
    const currentCount = store.get('waterCount', 0);
    const newCount = currentCount + 3;
    store.set('waterCount', newCount);

    if (mainWindow) {
      mainWindow.webContents.send('reminder-triggered', {
        students: [{ name: '系统' }],
        timestamp: new Date().toLocaleString(),
        waterCount: newCount
      });
    }
    return;
  }

  // 轮流选3个学生
  const selectedStudents = [];
  const studentsPerGroup = 3;
  
  for (let i = 0; i < studentsPerGroup && i < students.length; i++) {
    const studentIndex = (currentReminderIndex + i) % students.length;
    selectedStudents.push(students[studentIndex]);
  }
  
  // 更新索引
  currentReminderIndex = (currentReminderIndex + studentsPerGroup) % students.length;
  store.set('reminderIndex', currentReminderIndex);
  let message;
  if (selectedStudents.length === 1) {
    message = `请${selectedStudents[0].name}同学及时前往艺体馆抬水`;
  } else if (selectedStudents.length === 2) {
    message = `请${selectedStudents[0].name}和${selectedStudents[1].name}同学及时前往艺体馆抬水`;
  } else {
    message = `请${selectedStudents[0].name}、${selectedStudents[1].name}和${selectedStudents[2].name}同学及时前往艺体馆抬水`;
  }
  
  if (Notification.isSupported()) {
    new Notification({
      title: '每日抬水提醒',
      body: message,
      icon: path.join(__dirname, 'assets/icon.png')
    }).show();
  }

  if (settings.voiceEnabled) {
    speakText(message);
  }

  // 每次加3桶
  const currentCount = store.get('waterCount', 0);
  const newCount = currentCount + 3;
  store.set('waterCount', newCount);

  if (mainWindow) {
    mainWindow.webContents.send('reminder-triggered', {
      students: selectedStudents,
      timestamp: new Date().toLocaleString(),
      reminderIndex: currentReminderIndex,
      waterCount: newCount
    });
  }
}

function setAutoStart(enabled) {
  const platform = process.platform;
  
  if (platform === 'win32') {
    const appPath = process.execPath;
    const appName = '每日抬水提醒';
    
    if (enabled) {
      const regCommand = `reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /t REG_SZ /d "${appPath}" /f`;
      exec(regCommand, (error) => {
        if (error) {
          console.error('设置开机自启失败:', error);
        } else {
          console.log('开机自启设置成功');
        }
      });
    } else {
      const regCommand = `reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /f`;
      exec(regCommand, (error) => {
        if (error) {
          console.error('取消开机自启失败:', error);
        } else {
          console.log('开机自启已取消');
        }
      });
    }
  } else if (platform === 'darwin') {
    // macOS LaunchAgents
    const appPath = process.execPath;
    const plistPath = path.join(process.env.HOME, 'Library', 'LaunchAgents', 'com.waterreminder.app.plist');
    
    if (enabled) {
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.waterreminder.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>${appPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>`;
      
      require('fs').writeFileSync(plistPath, plistContent);
      exec(`launchctl load ${plistPath}`);
    } else {
      exec(`launchctl unload ${plistPath}`);
      if (require('fs').existsSync(plistPath)) {
        require('fs').unlinkSync(plistPath);
      }
    }
  } else if (platform === 'linux') {
    // Linux .desktop 文件
    const desktopPath = path.join(process.env.HOME, '.config', 'autostart', 'water-reminder.desktop');
    const appPath = process.execPath;
    
    if (enabled) {
      const desktopContent = `[Desktop Entry]
Type=Application
Name=每日抬水提醒
Exec=${appPath}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true`;
      
      require('fs').writeFileSync(desktopPath, desktopContent);
    } else {
      if (require('fs').existsSync(desktopPath)) {
        require('fs').unlinkSync(desktopPath);
      }
    }
  }
}

function speakText(text) {
  const platform = process.platform;
  
  if (platform === 'win32') {
    // PowerShell 语音
    const psCommand = `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("${text}")`;
    spawn('powershell', ['-Command', psCommand]);
  } else if (platform === 'darwin') {
    // macOS say 命令
    spawn('say', [text]);
  } else if (platform === 'linux') {
    // Linux espeak
    spawn('espeak', [text]);
  }
}

ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    enabled: true,
    reminderTime: '09:00',
    voiceEnabled: true,
    volume: 1.0,
    startMinimized: false,
    autoStart: false,
    autoCheckUpdate: true
  });
});

ipcMain.handle('get-first-run', () => {
  return store.get('firstRun', true);
});

ipcMain.handle('set-first-run-complete', () => {
  store.set('firstRun', false);
  // 同步到config.json
  updateConfigFile();
  return true;
});

ipcMain.handle('save-settings', (event, settings) => {
  const oldSettings = store.get('settings', {});
  
  store.set('settings', settings);
  
  if (settings.enabled && settings.reminderTime) {
    scheduleReminder(settings.reminderTime);
  } else if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  
  if (settings.autoStart !== oldSettings.autoStart) {
    setAutoStart(settings.autoStart);
  }
  
  // 同步到config.json
  updateConfigFile();
  
  return true;
});

ipcMain.handle('get-students', () => {
  return store.get('students', []);
});

ipcMain.handle('save-students', (event, students) => {
  store.set('students', students);
  // 同步到config.json
  updateConfigFile();
  return true;
});

ipcMain.handle('test-voice', (event, text) => {
  speakText(text || '测试语音播报');
  return true;
});

ipcMain.handle('trigger-reminder-now', () => {
  triggerReminder();
  return true;
});

ipcMain.handle('get-reminder-index', () => {
  return currentReminderIndex;
});

ipcMain.handle('reset-reminder-index', () => {
  currentReminderIndex = 0;
  store.set('reminderIndex', 0);
  // 同步到config.json
  updateConfigFile();
  return true;
});

ipcMain.handle('get-water-count', () => {
  return store.get('waterCount', 0);
});

ipcMain.handle('increment-water-count', (event, amount = 1) => {
  const currentCount = store.get('waterCount', 0);
  const newCount = currentCount + amount;
  store.set('waterCount', newCount);
  // 同步到config.json
  updateConfigFile();
  return newCount;
});

ipcMain.handle('reset-water-count', () => {
  store.set('waterCount', 0);
  // 同步到config.json
  updateConfigFile();
  return 0;
});

ipcMain.handle('set-water-count', (event, newCount) => {
  const count = parseInt(newCount);
  if (isNaN(count) || count < 0) {
    return { success: false, error: '请输入有效的数字' };
  }
  
  store.set('waterCount', count);
  // 同步到config.json
  updateConfigFile();
  return { success: true, count: count };
});

ipcMain.handle('test-sequential-reminder', () => {
  const students = store.get('students', []);
  if (students.length === 0) {
    return { message: '没有学生数据，无法测试' };
  }
  
  // 模拟5天轮流情况
  const results = [];
  const originalIndex = currentReminderIndex;
  
  for (let day = 0; day < 5; day++) {
    const selectedStudents = [];
    const studentsPerGroup = 3;
    
    for (let i = 0; i < studentsPerGroup && i < students.length; i++) {
      const studentIndex = (currentReminderIndex + i) % students.length;
      selectedStudents.push(students[studentIndex]);
    }
    
    results.push({
      day: day + 1,
      students: selectedStudents.map(s => s.name),
      index: currentReminderIndex
    });
    
    currentReminderIndex = (currentReminderIndex + studentsPerGroup) % students.length;
  }
  
  currentReminderIndex = originalIndex;
  
  return { results };
});

ipcMain.handle('export-students', async (event, students) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出学生名单',
      defaultPath: '学生名单.txt',
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: 'CSV文件', extensions: ['csv'] },
        { name: 'JSON文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!filePath) {
      return { success: false, error: '用户取消导出' };
    }
    
    const ext = path.extname(filePath).toLowerCase();
    let content = '';
    
    if (ext === '.json') {
      content = JSON.stringify(students, null, 2);
    } else if (ext === '.csv') {
      content = '姓名,添加时间\n';
      content += students.map(s => `"${s.name}","${s.addedAt}"`).join('\n');
    } else {
      // 默认txt
      content = students.map(s => s.name).join('\n');
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    
    return { success: true, filePath: filePath };
  } catch (error) {
    console.error('导出学生名单失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-students-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    
    let names = [];
    
    if (ext === '.json') {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        names = data.map(item => typeof item === 'string' ? item : item.name || item);
      } else {
        throw new Error('JSON文件格式不正确');
      }
    } else if (ext === '.csv') {
      const lines = content.split('\n').filter(line => line.trim());
      // 跳过标题
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          // 简单CSV解析
          const match = line.match(/^"([^"]*)"|^([^,]*)/);
          if (match) {
            const name = match[1] || match[2];
            if (name && name !== '姓名') {
              names.push(name);
            }
          }
        }
      }
    } else {
      // 按行分割
      names = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }
    
    return { success: true, names: names };
  } catch (error) {
    console.error('读取导入文件失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// 自动更新功能
function checkForUpdates() {
  // 检查用户设置
  const settings = store.get('settings', {});
  if (!settings.autoCheckUpdate) {
    console.log('用户已禁用自动检查更新');
    return;
  }

  // 开发环境也允许检查更新，但使用不同的策略
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    console.log('开发环境，使用GitHub API检查更新');
    checkForUpdatesInDev();
    return;
  }

  // 生产环境正常检查更新
  console.log('生产环境，开始检查更新...');
  autoUpdater.checkForUpdatesAndNotify();
}

// 开发环境更新检查
async function checkForUpdatesInDev() {
  console.log('开发环境更新检查...');
  
  try {
    // 检查GitHub releases
    const https = require('https');
    const currentVersion = require('./package.json').version;
    
    console.log(`当前版本: ${currentVersion}`);
    
    const options = {
      hostname: 'api.github.com',
      path: '/repos/ling-shi-cyber/water-reminder/releases/latest',
      headers: {
        'User-Agent': 'Water-Reminder-App'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const latestVersion = release.tag_name.replace('v', '');
          
          console.log(`GitHub最新版本: ${latestVersion}`);
          
          if (compareVersions(latestVersion, currentVersion) > 0) {
            console.log('发现新版本:', latestVersion);
            if (mainWindow) {
              mainWindow.webContents.send('update-available', {
                version: latestVersion,
                releaseNotes: release.body,
                releaseUrl: release.html_url
              });
            }
          } else {
            console.log('当前已是最新版本');
            if (mainWindow) {
              mainWindow.webContents.send('update-not-available', {
                version: currentVersion,
                message: '开发环境：当前已是最新版本'
              });
            }
          }
        } catch (error) {
          console.error('解析GitHub API响应失败:', error);
          if (mainWindow) {
            mainWindow.webContents.send('update-error', {
              message: '解析更新信息失败',
              code: 'PARSE_ERROR'
            });
          }
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('GitHub API请求失败:', error);
      if (mainWindow) {
        mainWindow.webContents.send('update-error', {
          message: '无法连接到更新服务器',
          code: 'NETWORK_ERROR'
        });
      }
    });
    
    req.setTimeout(10000, () => {
      console.error('GitHub API请求超时');
      req.destroy();
      if (mainWindow) {
        mainWindow.webContents.send('update-error', {
          message: '更新检查超时',
          code: 'TIMEOUT_ERROR'
        });
      }
    });
    
    req.end();
    
  } catch (error) {
    console.error('开发环境更新检查失败:', error);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', {
        message: '更新检查失败',
        code: 'UNKNOWN_ERROR'
      });
    }
  }
}

// 版本比较函数
function compareVersions(version1, version2) {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  
  return 0;
}

// 更新事件监听
autoUpdater.on('checking-for-update', () => {
  console.log('正在检查更新...');
  if (mainWindow) {
    mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('发现新版本:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('当前已是最新版本');
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available', info);
  }
});

autoUpdater.on('error', (err) => {
  console.error('更新检查失败:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', {
      message: err.message || '更新检查失败',
      code: err.code || 'UNKNOWN_ERROR'
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('下载进度:', Math.round(progressObj.percent) + '%');
  // 只在下载开始时发送一次通知，不频繁更新
  if (progressObj.percent === 0 || progressObj.percent < 5) {
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('更新下载完成，准备安装...');
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// IPC处理更新相关请求
ipcMain.handle('check-for-updates', () => {
  checkForUpdates();
  return true;
});

ipcMain.handle('download-update', () => {
  // 在生产环境中，autoUpdater会自动处理下载
  // 在开发环境中，我们只是模拟下载过程
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    console.log('开发环境：模拟开始下载更新...');
    
    // 只显示一次下载开始提示
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        percent: 0,
        bytesPerSecond: 0,
        total: 0,
        transferred: 0
      });
    }
    
    // 模拟下载过程，但不频繁发送进度更新
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', {
          version: '1.0.2',
          releaseNotes: '开发环境模拟更新'
        });
      }
    }, 3000); // 3秒后完成下载
  } else {
    // 生产环境使用autoUpdater
    console.log('生产环境：使用electron-updater下载更新');
    autoUpdater.checkForUpdatesAndNotify();
  }
  return true;
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
  return true;
});

// 开发环境测试更新功能
ipcMain.handle('test-update', () => {
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    console.log('开发环境：模拟发现新版本...');
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: '1.0.2',
        releaseNotes: '这是一个测试更新，包含以下改进：\n- 修复了已知问题\n- 提升了性能\n- 新增了功能',
        releaseUrl: 'https://github.com/ling-shi-cyber/water-reminder/releases/tag/v1.0.2'
      });
    }
    return true;
  }
  return false;
});
