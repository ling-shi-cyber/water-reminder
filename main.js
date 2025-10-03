const { app, BrowserWindow, ipcMain, Notification, dialog, Tray, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const fs = require('fs');

const store = new Store();

let mainWindow;
let tray = null;
let reminderTimer = null;
let currentReminderIndex = 0; // 轮流提醒用的索引

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
    enabled: false,
    reminderTime: '09:00',
    voiceEnabled: true,
    volume: 0.8,
    startMinimized: false,
    autoStart: false
  });
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
  
  return true;
});

ipcMain.handle('get-students', () => {
  return store.get('students', []);
});

ipcMain.handle('save-students', (event, students) => {
  store.set('students', students);
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
  return true;
});

ipcMain.handle('get-water-count', () => {
  return store.get('waterCount', 0);
});

ipcMain.handle('increment-water-count', (event, amount = 1) => {
  const currentCount = store.get('waterCount', 0);
  const newCount = currentCount + amount;
  store.set('waterCount', newCount);
  return newCount;
});

ipcMain.handle('reset-water-count', () => {
  store.set('waterCount', 0);
  return 0;
});

ipcMain.handle('set-water-count', (event, newCount) => {
  const count = parseInt(newCount);
  if (isNaN(count) || count < 0) {
    return { success: false, error: '请输入有效的数字' };
  }
  
  store.set('waterCount', count);
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
