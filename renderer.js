const { ipcRenderer } = require('electron');

// 变量定义
let currentSettings = {};
let students = [];
let reminderHistory = [];
let timeUpdateTimer = null;
let waterCount = 0;
// 页面元素
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const currentTime = document.getElementById('currentTime');
const daysUntilReminder = document.getElementById('daysUntilReminder');
const voiceStatus = document.getElementById('voiceStatus');
const recentReminders = document.getElementById('recentReminders');
const waterCountElement = document.getElementById('waterCount');
const resetWaterCountBtn = document.getElementById('resetWaterCount');
const editWaterCountBtn = document.getElementById('editWaterCount');
const editWaterCountModal = document.getElementById('editWaterCountModal');
const newWaterCountInput = document.getElementById('newWaterCount');
const currentWaterCountSpan = document.getElementById('currentWaterCount');
const confirmEditWaterCountBtn = document.getElementById('confirmEditWaterCount');
const cancelEditWaterCountBtn = document.getElementById('cancelEditWaterCount');
const enableReminder = document.getElementById('enableReminder');
const reminderTime = document.getElementById('reminderTime');
const enableVoice = document.getElementById('enableVoice');
const voiceVolume = document.getElementById('voiceVolume');
const volumeValue = document.getElementById('volumeValue');
const startMinimized = document.getElementById('startMinimized');
const autoStart = document.getElementById('autoStart');
const giteeSource = document.getElementById('giteeSource');
const githubSource = document.getElementById('githubSource');
const lightMode = document.getElementById('lightMode');
const darkMode = document.getElementById('darkMode');
const systemMode = document.getElementById('systemMode');
const themeColorOptions = document.querySelectorAll('.theme-color-option');
const logoPreview = document.getElementById('logoPreview');
const logoImageInput = document.getElementById('logoImageInput');
const selectLogoBtn = document.getElementById('selectLogoBtn');
const resetLogoBtn = document.getElementById('resetLogoBtn');
const logoTitle = document.getElementById('logoTitle');
const logoMotto = document.getElementById('logoMotto');
const saveLogoSettingsBtn = document.getElementById('saveLogoSettings');
const studentsList = document.getElementById('studentsList');
const addStudentModal = document.getElementById('addStudentModal');
const studentNameInput = document.getElementById('studentName');
const importStudentsModal = document.getElementById('importStudentsModal');
const importFile = document.getElementById('importFile');
const importText = document.getElementById('importText');
const importReplace = document.getElementById('importReplace');
const testNotificationBtn = document.getElementById('testNotification');
const testVoiceBtn = document.getElementById('testVoice');
const addStudentBtn = document.getElementById('addStudent');
const confirmAddBtn = document.getElementById('confirmAdd');
const cancelAddBtn = document.getElementById('cancelAdd');
const clearHistoryBtn = document.getElementById('clearHistory');
const exportStudentsBtn = document.getElementById('exportStudents');
const importStudentsBtn = document.getElementById('importStudents');
const confirmImportBtn = document.getElementById('confirmImport');
const cancelImportBtn = document.getElementById('cancelImport');
// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    const minimizeBtn = document.getElementById('minimizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            ipcRenderer.invoke('window-minimize');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            ipcRenderer.invoke('window-close');
        });
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    updateUI();
    
    // 检查更新提醒
    checkUpdateReminder();
});
// 读取数据
async function loadData() {
    try {
        currentSettings = await ipcRenderer.invoke('get-settings');
        students = await ipcRenderer.invoke('get-students');
        reminderHistory = JSON.parse(localStorage.getItem('reminderHistory') || '[]');
        waterCount = await ipcRenderer.invoke('get-water-count');
        
        
        loadThemeSettings();
        initLogoSettings();
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}
// 绑定事件
function setupEventListeners() {
    // 导航切换
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page;
            switchPage(pageId);
        });
    });
    // 设置项
    enableReminder.addEventListener('change', saveSettings);
    reminderTime.addEventListener('change', saveSettings);
    enableVoice.addEventListener('change', saveSettings);
    voiceVolume.addEventListener('input', updateVolumeDisplay);
    voiceVolume.addEventListener('change', saveSettings);
    startMinimized.addEventListener('change', saveSettings);
    autoStart.addEventListener('change', saveSettings);
    
    // 自动检查更新开关
    const autoCheckUpdate = document.getElementById('autoCheckUpdate');
    if (autoCheckUpdate) {
        autoCheckUpdate.addEventListener('change', saveSettings);
    }
    
    // 自动下载更新开关
    const autoDownloadUpdate = document.getElementById('autoDownloadUpdate');
    if (autoDownloadUpdate) {
        autoDownloadUpdate.addEventListener('change', saveSettings);
    }
    
    // 下载源选择
    if (giteeSource) {
        giteeSource.addEventListener('change', saveSettings);
    }
    if (githubSource) {
        githubSource.addEventListener('change', saveSettings);
    }
    
    // 更新检查功能
    const checkUpdateBtn = document.getElementById('checkUpdateBtn');
    
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', async () => {
            showNotification('正在检查更新...', 'info');
            await ipcRenderer.invoke('check-for-updates');
        });
    }
    
    // 测试更新功能
    const testUpdateBtn = document.getElementById('testUpdateBtn');
    if (testUpdateBtn) {
        testUpdateBtn.addEventListener('click', async () => {
            const result = await ipcRenderer.invoke('test-update');
            if (result) {
                showNotification('开发环境：模拟发现新版本', 'info');
            } else {
                showNotification('此功能仅在开发环境中可用', 'error');
            }
        });
    }
    
    // 主题切换
    lightMode.addEventListener('change', handleThemeModeChange);
    darkMode.addEventListener('change', handleThemeModeChange);
    systemMode.addEventListener('change', handleThemeModeChange);
    
    themeColorOptions.forEach(option => {
        option.addEventListener('click', handleThemeColorChange);
    });
    // 测试按钮
    testNotificationBtn.addEventListener('click', testNotification);
    testVoiceBtn.addEventListener('click', testVoice);
    
    // 学生管理
    addStudentBtn.addEventListener('click', showAddStudentModal);
    confirmAddBtn.addEventListener('click', addStudent);
    cancelAddBtn.addEventListener('click', hideAddStudentModal);
    
    // 历史记录
    clearHistoryBtn.addEventListener('click', clearHistory);
    
    // 导入导出
    exportStudentsBtn.addEventListener('click', exportStudents);
    importStudentsBtn.addEventListener('click', showImportStudentsModal);
    confirmImportBtn.addEventListener('click', importStudents);
    cancelImportBtn.addEventListener('click', hideImportStudentsModal);
    
    // 抬水计数
    resetWaterCountBtn.addEventListener('click', resetWaterCount);
    editWaterCountBtn.addEventListener('click', showEditWaterCountModal);
    confirmEditWaterCountBtn.addEventListener('click', editWaterCount);
    cancelEditWaterCountBtn.addEventListener('click', hideEditWaterCountModal);
    // 复制按钮
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const textToCopy = e.currentTarget.dataset.copy;
            copyToClipboard(textToCopy);
        });
    });
    
    // 外部链接
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const { shell } = require('electron');
            shell.openExternal(link.href);
        });
    });
    // 弹窗关闭
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            if (e.target.closest('#addStudentModal')) {
                hideAddStudentModal();
            } else if (e.target.closest('#importStudentsModal')) {
                hideImportStudentsModal();
            } else if (e.target.closest('#editWaterCountModal')) {
                hideEditWaterCountModal();
            }
        });
    });
    
    // 点击背景关闭弹窗
    addStudentModal.addEventListener('click', (e) => {
        if (e.target === addStudentModal) {
            hideAddStudentModal();
        }
    });
    
    importStudentsModal.addEventListener('click', (e) => {
        if (e.target === importStudentsModal) {
            hideImportStudentsModal();
        }
    });
    
    editWaterCountModal.addEventListener('click', (e) => {
        if (e.target === editWaterCountModal) {
            hideEditWaterCountModal();
        }
    });
    // 导入方式切换
    document.querySelectorAll('input[name="importType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const fileGroup = document.getElementById('fileImportGroup');
            const textGroup = document.getElementById('textImportGroup');
            
            if (e.target.value === 'file') {
                fileGroup.style.display = 'block';
                textGroup.style.display = 'none';
            } else {
                fileGroup.style.display = 'none';
                textGroup.style.display = 'block';
            }
        });
    });
    // 提醒触发
    ipcRenderer.on('reminder-triggered', async (event, data) => {
        addReminderToHistory(data);
        updateRecentReminders();
        if (data.waterCount !== undefined) {
            waterCount = data.waterCount;
            updateWaterCountDisplay();
        }
        daysUntilReminder.textContent = await calculateTimeUntilReminder();
    });
    
    // 监听更新事件
    ipcRenderer.on('update-available', (event, info) => {
        console.log('发现新版本:', info);
        
        // 检查用户设置，如果启用了自动下载，则直接开始下载
        if (currentSettings.autoDownloadUpdate) {
            console.log('用户设置了自动下载，开始下载更新...');
            ipcRenderer.invoke('download-update');
        } else {
            // 显示选择界面
            showUpdateNotification(info);
        }
    });
    
    ipcRenderer.on('update-not-available', (event, info) => {
        console.log('当前已是最新版本:', info);
        showNotification('当前已是最新版本', 'success');
    });
    
    ipcRenderer.on('update-downloaded', (event, info) => {
        console.log('更新下载完成:', info);
        showUpdateReadyNotification(info);
    });
    
    ipcRenderer.on('download-progress', (event, progress) => {
        console.log('下载进度:', Math.round(progress.percent) + '%');
        showNotification('正在下载更新...', 'info');
    });
    
    ipcRenderer.on('update-checking', () => {
        console.log('正在检查更新...');
        showNotification('正在检查更新...', 'info');
    });
    
    ipcRenderer.on('update-error', (event, error) => {
        console.error('更新检查失败:', error);
        showNotification(`更新检查失败: ${error.message}`, 'error');
    });
}
// 切换页面
function switchPage(pageId) {
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });

    pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === pageId) {
            page.classList.add('active');
        }
    });

    // 页面特定逻辑
    if (pageId === 'students') {
        updateStudentsList();
    } else if (pageId === 'history') {
        updateHistoryList();
    } else if (pageId === 'dashboard') {
        if (currentSettings.enabled && students.length > 0) {
            calculateTimeUntilReminder().then(time => {
                daysUntilReminder.textContent = time;
            });
        }
    }
}

// 计算提醒时间
async function calculateTimeUntilReminder() {
    try {
        const totalStudents = students.length;
        
        if (totalStudents === 0) {
            return '无学生数据';
        }
        
        if (!currentSettings.enabled || !currentSettings.reminderTime) {
            return '提醒未启用';
        }
        
        const [hours, minutes] = currentSettings.reminderTime.split(':').map(Number);
        
        const now = new Date();
        let nextReminderTime = new Date();
        nextReminderTime.setHours(hours, minutes, 0, 0);
        
        // 时间过了就明天
        if (nextReminderTime <= now) {
            nextReminderTime.setDate(nextReminderTime.getDate() + 1);
        }
        
        // 周日不抬水，跳到周一
        while (nextReminderTime.getDay() === 0) {
            nextReminderTime.setDate(nextReminderTime.getDate() + 1);
        }
        
        const timeDiff = nextReminderTime.getTime() - now.getTime();
        const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesDiff = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        // 周日不提醒
        if (now.getDay() === 0) {
            return '今天是周日，放假不抬水';
        }
        
        if (daysDiff > 0) {
            if (daysDiff === 1) {
                return `明天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            } else {
                return `${daysDiff}天后 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
        } else if (hoursDiff === 0 && minutesDiff === 0) {
            return '即将提醒';
        } else if (hoursDiff === 0) {
            return `还有${minutesDiff}分钟`;
        } else if (minutesDiff === 0) {
            return `还有${hoursDiff}小时`;
        } else {
            return `还有${hoursDiff}小时${minutesDiff}分钟`;
        }
    } catch (error) {
        console.error('计算提醒时间失败:', error);
        return '计算失败';
    }
}

// 开始定时器
function startTimeUpdateTimer() {
    if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer);
    }
    
    // 每分钟更新一次
    timeUpdateTimer = setInterval(async () => {
        if (currentSettings.enabled && students.length > 0) {
            daysUntilReminder.textContent = await calculateTimeUntilReminder();
        }
    }, 60000);
}

// 结束定时器
function stopTimeUpdateTimer() {
    if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer);
        timeUpdateTimer = null;
    }
}

// 刷新界面
async function updateUI() {
    // 状态指示器
    if (currentSettings.enabled) {
        statusDot.classList.add('active');
        statusText.textContent = '已启用';
    } else {
        statusDot.classList.remove('active');
        statusText.textContent = '未启用';
    }

    // 主页信息
    currentTime.textContent = currentSettings.reminderTime || '未设置';
    daysUntilReminder.textContent = await calculateTimeUntilReminder();
    voiceStatus.textContent = currentSettings.voiceEnabled ? '已启用' : '未启用';

    // 设置表单
    enableReminder.checked = currentSettings.enabled || false;
    reminderTime.value = currentSettings.reminderTime || '09:00';
    enableVoice.checked = currentSettings.voiceEnabled || false;
    voiceVolume.value = currentSettings.volume || 0.8;
    startMinimized.checked = currentSettings.startMinimized || false;
    autoStart.checked = currentSettings.autoStart || false;
    
    // 自动检查更新设置
    const autoCheckUpdate = document.getElementById('autoCheckUpdate');
    if (autoCheckUpdate) {
        autoCheckUpdate.checked = currentSettings.autoCheckUpdate !== false; // 默认为true
    }
    
    // 自动下载更新设置
    const autoDownloadUpdate = document.getElementById('autoDownloadUpdate');
    if (autoDownloadUpdate) {
        autoDownloadUpdate.checked = currentSettings.autoDownloadUpdate || false;
    }
    
    // 下载源设置
    const downloadSource = currentSettings.downloadSource || 'gitee'; // 默认使用Gitee
    if (giteeSource && githubSource) {
        if (downloadSource === 'gitee') {
            giteeSource.checked = true;
            githubSource.checked = false;
        } else {
            giteeSource.checked = false;
            githubSource.checked = true;
        }
    }
    
    updateThemeUI();
    updateVolumeDisplay();
    updateRecentReminders();
    updateWaterCountDisplay();
    
    // 定时器控制
    if (currentSettings.enabled && students.length > 0) {
        startTimeUpdateTimer();
    } else {
        stopTimeUpdateTimer();
    }
}

// 刷新音量
function updateVolumeDisplay() {
    const volume = Math.round(voiceVolume.value * 100);
    volumeValue.textContent = `${volume}%`;
}
// 主题相关
const themeManager = {
    defaultSettings: {
        mode: 'system',
        color: 'blue'
    },
    
    getSettings() {
        const saved = localStorage.getItem('themeSettings');
        return saved ? JSON.parse(saved) : this.defaultSettings;
    },
    
    saveSettings(settings) {
        localStorage.setItem('themeSettings', JSON.stringify(settings));
    },
    
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    },
    
    applyTheme(mode, color) {
        const body = document.body;
        
        body.classList.remove('dark-mode', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
        
        let actualMode = mode;
        if (mode === 'system') {
            actualMode = this.getSystemTheme();
        }
        
        if (actualMode === 'dark') {
            body.classList.add('dark-mode');
        }
        
        if (color !== 'blue') {
            body.classList.add(`theme-${color}`);
        }
    }
};

// 读取主题
function loadThemeSettings() {
    const settings = themeManager.getSettings();
    themeManager.applyTheme(settings.mode, settings.color);
    
    // 监听系统主题变化
    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addListener(() => {
            const currentSettings = themeManager.getSettings();
            if (currentSettings.mode === 'system') {
                themeManager.applyTheme('system', currentSettings.color);
            }
        });
    }
}

// 刷新主题UI
function updateThemeUI() {
    const settings = themeManager.getSettings();
    
    lightMode.checked = settings.mode === 'light';
    darkMode.checked = settings.mode === 'dark';
    systemMode.checked = settings.mode === 'system';
    
    themeColorOptions.forEach(option => {
        const theme = option.dataset.theme;
        if (theme === settings.color) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// 主题切换
function handleThemeModeChange(event) {
    if (!event.target.checked) return;
    
    const settings = themeManager.getSettings();
    settings.mode = event.target.value;
    
    themeManager.saveSettings(settings);
    themeManager.applyTheme(settings.mode, settings.color);
    
    const modeNames = {
        light: '浅色模式',
        dark: '深色模式',
        system: '跟随系统'
    };
    
    showNotification(`已切换到${modeNames[settings.mode]}`, 'success');
}

// 颜色切换
function handleThemeColorChange(event) {
    const option = event.currentTarget;
    const newColor = option.dataset.theme;
    
    const settings = themeManager.getSettings();
    settings.color = newColor;
    
    themeManager.saveSettings(settings);
    themeManager.applyTheme(settings.mode, settings.color);
    
    themeColorOptions.forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');
    
    const colorNames = {
        blue: '海洋蓝',
        green: '森林绿',
        purple: '优雅紫',
        orange: '温暖橙'
    };
    
    showNotification(`已切换到${colorNames[newColor]}主题`, 'success');
}

// 保存配置
async function saveSettings() {
    const autoCheckUpdate = document.getElementById('autoCheckUpdate');
    const autoDownloadUpdate = document.getElementById('autoDownloadUpdate');
    
    // 获取下载源选择
    const downloadSource = giteeSource && giteeSource.checked ? 'gitee' : 'github';
    
    const newSettings = {
        enabled: enableReminder.checked,
        reminderTime: reminderTime.value,
        voiceEnabled: enableVoice.checked,
        volume: parseFloat(voiceVolume.value),
        startMinimized: startMinimized.checked,
        autoStart: autoStart.checked,
        autoCheckUpdate: autoCheckUpdate ? autoCheckUpdate.checked : true,
        autoDownloadUpdate: autoDownloadUpdate ? autoDownloadUpdate.checked : false,
        downloadSource: downloadSource
    };

    try {
        await ipcRenderer.invoke('save-settings', newSettings);
        currentSettings = newSettings;
        await updateUI();
        showNotification('设置已保存', 'success');
    } catch (error) {
        console.error('保存设置失败:', error);
        showNotification('保存设置失败', 'error');
    }
}

// 测试消息
async function testNotification() {
    // 检查是否为开发环境
    const isDev = await ipcRenderer.invoke('is-development');
    if (!isDev) {
        showNotification('此功能仅在开发环境中可用', 'error');
        return;
    }
    
    try {
        console.log('开始测试通知...');
        
        await ipcRenderer.invoke('trigger-reminder-now');
        
        showNotification('测试通知已发送（包含弹窗和语音）', 'success');
        console.log('测试通知完成');
    } catch (error) {
        console.error('测试通知失败:', error);
        showNotification('测试通知失败', 'error');
    }
}

// 测试语音
async function testVoice() {
    // 检查是否为开发环境
    const isDev = await ipcRenderer.invoke('is-development');
    if (!isDev) {
        showNotification('此功能仅在开发环境中可用', 'error');
        return;
    }
    
    try {
        await ipcRenderer.invoke('test-voice', '测试语音播报功能');
        showNotification('语音测试已发送', 'success');
    } catch (error) {
        console.error('测试语音失败:', error);
        showNotification('测试语音失败', 'error');
    }
}

function showAddStudentModal() {
    addStudentModal.classList.add('active');
    studentNameInput.value = '';
    studentNameInput.focus();
}

function hideAddStudentModal() {
    addStudentModal.classList.remove('active');
}

function showImportStudentsModal() {
    importStudentsModal.classList.add('active');
    importFile.value = '';
    importText.value = '';
    importReplace.checked = false;
    // 默认选文件导入
    document.querySelector('input[name="importType"][value="file"]').checked = true;
    document.getElementById('fileImportGroup').style.display = 'block';
    document.getElementById('textImportGroup').style.display = 'none';
}

function hideImportStudentsModal() {
    importStudentsModal.classList.remove('active');
}

async function addStudent() {
    const name = studentNameInput.value.trim();
    if (!name) {
        showNotification('请输入学生姓名', 'error');
        return;
    }

    if (students.some(student => student.name === name)) {
        showNotification('该学生已存在', 'error');
        return;
    }

    const newStudent = {
        id: Date.now(),
        name: name,
        addedAt: new Date().toISOString()
    };

    students.push(newStudent);

    try {
        await ipcRenderer.invoke('save-students', students);
        hideAddStudentModal();
        updateStudentsList();
        await updateUI();
        showNotification('学生添加成功', 'success');
    } catch (error) {
        console.error('添加学生失败:', error);
        showNotification('添加学生失败', 'error');
    }
}

async function exportStudents() {
    try {
        if (students.length === 0) {
            showNotification('没有学生数据可导出', 'error');
            return;
        }
        
        const result = await ipcRenderer.invoke('export-students', students);
        
        if (result.success) {
            showNotification(`学生名单已导出到: ${result.filePath}`, 'success');
        } else {
            showNotification('导出失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('导出学生名单失败:', error);
        showNotification('导出失败', 'error');
    }
}

async function importStudents() {
    try {
        const importType = document.querySelector('input[name="importType"]:checked').value;
        const replace = importReplace.checked;
        
        let studentNames = [];
        
        if (importType === 'file') {
            const file = importFile.files[0];
            if (!file) {
                showNotification('请选择要导入的文件', 'error');
                return;
            }
            
            const result = await ipcRenderer.invoke('import-students-file', file.path);
            if (!result.success) {
                showNotification('文件读取失败: ' + result.error, 'error');
                return;
            }
            studentNames = result.names;
        } else {
            const text = importText.value.trim();
            if (!text) {
                showNotification('请输入学生名单', 'error');
                return;
            }
            
            studentNames = text.split('\n')
                .map(name => name.trim())
                .filter(name => name.length > 0);
        }
        
        if (studentNames.length === 0) {
            showNotification('没有找到有效的学生姓名', 'error');
            return;
        }
        
        let newStudents = [];
        let duplicateCount = 0;
        
        if (replace) {
            // 直接替换
            newStudents = studentNames.map(name => ({
                id: Date.now() + Math.random() + Math.random(),
                name: name,
                addedAt: new Date().toISOString()
            }));
            students = newStudents;
        } else {
            // 只添加不重复的
            for (const name of studentNames) {
                if (students.some(student => student.name === name)) {
                    duplicateCount++;
                    continue;
                }
                
                newStudents.push({
                    id: Date.now() + Math.random(),
                    name: name,
                    addedAt: new Date().toISOString()
                });
            }
            students = [...students, ...newStudents];
        }
        
        await ipcRenderer.invoke('save-students', students);
        
        updateStudentsList();
        await updateUI();
        hideImportStudentsModal();
        let message;
        if (replace) {
            message = `成功替换学生名单，共 ${students.length} 名学生`;
        } else {
            message = `成功导入 ${newStudents.length} 名学生`;
            if (duplicateCount > 0) {
                message += `，跳过 ${duplicateCount} 名重复学生`;
            }
        }
        showNotification(message, 'success');
        
    } catch (error) {
        console.error('导入学生名单失败:', error);
        showNotification('导入失败', 'error');
    }
}

async function deleteStudent(studentId) {
    if (confirm('确定要删除这个学生吗？')) {
        students = students.filter(student => student.id !== studentId);
        
        try {
            await ipcRenderer.invoke('save-students', students);
            updateStudentsList();
            await updateUI();
            showNotification('学生删除成功', 'success');
        } catch (error) {
            console.error('删除学生失败:', error);
            showNotification('删除学生失败', 'error');
        }
    }
}

function updateStudentsList() {
    if (students.length === 0) {
        studentsList.innerHTML = '<div class="no-data">暂无学生信息</div>';
        return;
    }

    studentsList.innerHTML = students.map(student => `
        <div class="student-item">
            <div class="student-name">${student.name}</div>
            <div class="student-actions">
                <button class="btn btn-danger" onclick="deleteStudent(${student.id})">
                    <i class="fas fa-trash"></i>
                    删除
                </button>
            </div>
        </div>
    `).join('');
}

function addReminderToHistory(data) {
    const historyItem = {
        id: Date.now(),
        students: data.students || [data.student],
        timestamp: data.timestamp,
        date: new Date().toISOString()
    };
    
    reminderHistory.unshift(historyItem);
    
    // 最多保留50条
    if (reminderHistory.length > 50) {
        reminderHistory = reminderHistory.slice(0, 50);
    }
    
    localStorage.setItem('reminderHistory', JSON.stringify(reminderHistory));
}

function updateRecentReminders() {
    const recent = reminderHistory.slice(0, 5);
    
    if (recent.length === 0) {
        recentReminders.innerHTML = '<div class="no-data">暂无提醒记录</div>';
        return;
    }

    recentReminders.innerHTML = recent.map(item => {
        const students = item.students || [item.student];
        const studentNames = students.map(s => s.name).join('、');
        
        return `
            <div class="history-item">
                <div class="history-info">
                    <div class="history-student">${studentNames}</div>
                    <div class="history-time">${item.timestamp}</div>
                </div>
            </div>
        `;
    }).join('');
}

function updateHistoryList() {
    const historyList = document.getElementById('historyList');
    
    if (reminderHistory.length === 0) {
        historyList.innerHTML = '<div class="no-data">暂无历史记录</div>';
        return;
    }

    historyList.innerHTML = reminderHistory.map(item => {
        const students = item.students || [item.student];
        const studentNames = students.map(s => s.name).join('、');
        
        return `
            <div class="history-item">
                <div class="history-info">
                    <div class="history-student">${studentNames}</div>
                    <div class="history-time">${item.timestamp}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function clearHistory() {
    const confirmed = confirm('确定要清除所有历史记录吗？此操作不可恢复！');
    
    if (confirmed) {
        try {
            reminderHistory = [];
            localStorage.setItem('reminderHistory', JSON.stringify(reminderHistory));
            
            updateHistoryList();
            updateRecentReminders();
            
            showNotification('历史记录已清除', 'success');
        } catch (error) {
            console.error('清除历史记录失败:', error);
            showNotification('清除历史记录失败', 'error');
        }
    }
}

function updateWaterCountDisplay() {
    if (waterCountElement) {
        waterCountElement.textContent = `${waterCount} 桶`;
    }
    if (currentWaterCountSpan) {
        currentWaterCountSpan.textContent = waterCount;
    }
}

function showEditWaterCountModal() {
    editWaterCountModal.classList.add('active');
    newWaterCountInput.value = waterCount;
    updateWaterCountDisplay();
    newWaterCountInput.focus();
    newWaterCountInput.select();
}

function hideEditWaterCountModal() {
    editWaterCountModal.classList.remove('active');
}

async function editWaterCount() {
    const newCount = newWaterCountInput.value.trim();
    
    if (!newCount) {
        showNotification('请输入桶数', 'error');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('set-water-count', newCount);
        
        if (result.success) {
            waterCount = result.count;
            updateWaterCountDisplay();
            hideEditWaterCountModal();
            showNotification(`抬水计数已修改为 ${result.count} 桶`, 'success');
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('修改抬水计数失败:', error);
        showNotification('修改失败', 'error');
    }
}

async function resetWaterCount() {
    const confirmed = confirm('确定要清零抬水计数吗？此操作不可恢复！');
    
    if (confirmed) {
        try {
            waterCount = await ipcRenderer.invoke('reset-water-count');
            updateWaterCountDisplay();
            showNotification('抬水计数已清零', 'success');
        } catch (error) {
            console.error('清零抬水计数失败:', error);
            showNotification('清零失败', 'error');
        }
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
        notification.style.background = '#10b981';
    } else if (type === 'error') {
        notification.style.background = '#ef4444';
    } else {
        notification.style.background = '#3b82f6';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%) scale(0.95);
            opacity: 0;
        }
        to {
            transform: translateX(0) scale(1);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0) scale(1);
            opacity: 1;
        }
        to {
            transform: translateX(100%) scale(0.95);
            opacity: 0;
        }
    }
    
    .update-notification.show {
        animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .update-notification.hide {
        animation: slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .update-notification, .update-ready-notification, .update-progress-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.95);
        color: #333;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001;
        max-width: 400px;
        animation: slideIn 0.3s ease;
        border: 1px solid rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(10px);
    }
    
    .update-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
    }
    
    .update-title {
        font-size: 16px;
        font-weight: 500;
        color: #2d3748;
    }
    
    .update-header i {
        color: #4299e1;
        font-size: 16px;
    }
    
    .update-info {
        margin-bottom: 16px;
    }
    
    .version-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-size: 14px;
    }
    
    .current-version {
        color: #718096;
        font-size: 13px;
    }
    
    .new-version {
        color: #38a169;
        font-weight: 600;
        background: #f0fff4;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 13px;
    }
    
    .release-notes {
        background: #f7fafc;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.5;
        color: #4a5568;
        max-height: 100px;
        overflow-y: auto;
        border-left: 3px solid #4299e1;
    }
    
    .update-progress-notification {
        background: rgba(255, 255, 255, 0.95);
        border-left: 4px solid #4299e1;
    }
    
    .update-ready-notification {
        background: rgba(255, 255, 255, 0.95);
        border-left: 4px solid #38a169;
    }
    
    .update-ready-notification .update-header i {
        color: #38a169;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .notification-content i {
        font-size: 18px;
    }
    
    .notification-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
        flex-wrap: wrap;
    }
    
    .notification-actions .btn {
        padding: 8px 16px;
        font-size: 13px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .notification-actions .btn-primary {
        background: #4299e1;
        color: white;
        box-shadow: 0 2px 4px rgba(66, 153, 225, 0.3);
    }
    
    .notification-actions .btn-primary:hover {
        background: #3182ce;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(66, 153, 225, 0.4);
    }
    
    .notification-actions .btn-secondary {
        background: #f7fafc;
        color: #4a5568;
        border: 1px solid #e2e8f0;
    }
    
    .notification-actions .btn-secondary:hover {
        background: #edf2f7;
        color: #2d3748;
        transform: translateY(-1px);
    }
    
    .progress-bar {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;
    }
    
    .progress-fill {
        height: 100%;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 2px;
        transition: width 0.3s ease;
    }
    
    .button-group {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
    }
    
    .button-group .btn {
        flex: 1;
        min-width: 120px;
    }
`;
document.head.appendChild(style);

function copyToClipboard(text) {
    try {
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        
        showNotification(`已复制到剪贴板: ${text}`, 'success');
    } catch (error) {
        console.error('复制失败:', error);
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification(`已复制到剪贴板: ${text}`, 'success');
            }).catch(err => {
                console.error('复制失败:', err);
                showNotification('复制失败，请手动复制', 'error');
            });
        } else {
            // 最后的降级方案
            const tempInput = document.createElement('input');
            tempInput.value = text;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            showNotification(`已复制到剪贴板: ${text}`, 'success');
        }
    }
}

function initLogoSettings() {
    loadLogoSettings();
    
    selectLogoBtn.addEventListener('click', () => {
        logoImageInput.click();
    });
    
    logoImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleLogoImageUpload(file);
        }
    });
    
    resetLogoBtn.addEventListener('click', () => {
        resetLogoToDefault();
    });
    
    saveLogoSettingsBtn.addEventListener('click', () => {
        saveLogoSettings();
    });
    
    logoTitle.addEventListener('input', updateLogoPreview);
    logoMotto.addEventListener('input', updateLogoPreview);
}

async function handleLogoImageUpload(file) {
    try {
        if (!file.type.startsWith('image/')) {
            showNotification('请选择图片文件', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            showNotification('图片文件大小不能超过5MB', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            logoPreview.src = imageData;
            
            const logoSettings = getLogoSettings();
            logoSettings.image = imageData;
            localStorage.setItem('logoSettings', JSON.stringify(logoSettings));
            
            showNotification('Logo图片已更新', 'success');
        };
        
        reader.onerror = () => {
            showNotification('图片读取失败', 'error');
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('处理Logo图片失败:', error);
        showNotification('图片处理失败', 'error');
    }
}

function resetLogoToDefault() {
    const confirmed = confirm('确定要重置标题设置为默认值吗？');
    
    if (confirmed) {
        logoPreview.src = 'assets/19.jpg';
        logoTitle.value = '逐梦者19班';
        logoMotto.value = '我们不生产水，我们只是大自然的搬运工';
        
        localStorage.removeItem('logoSettings');
        
        updateLogoDisplay();
        
        showNotification('标题设置已重置为默认值', 'success');
    }
}

function saveLogoSettings() {
    try {
        const logoSettings = {
            image: logoPreview.src,
            title: logoTitle.value.trim(),
            motto: logoMotto.value.trim()
        };
        
        if (!logoSettings.title) {
            showNotification('请输入Logo标题', 'error');
            logoTitle.focus();
            return;
        }
        
        if (!logoSettings.motto) {
            showNotification('请输入Logo座右铭', 'error');
            logoMotto.focus();
            return;
        }
        
        localStorage.setItem('logoSettings', JSON.stringify(logoSettings));
        
        updateLogoDisplay();
        
        showNotification('标题设置已保存', 'success');
    } catch (error) {
        console.error('保存标题设置失败:', error);
        showNotification('保存失败', 'error');
    }
}

function loadLogoSettings() {
    try {
        const savedSettings = localStorage.getItem('logoSettings');
        if (savedSettings) {
            const logoSettings = JSON.parse(savedSettings);
            
            if (logoSettings.image) {
                logoPreview.src = logoSettings.image;
            }
            if (logoSettings.title) {
                logoTitle.value = logoSettings.title;
            }
            if (logoSettings.motto) {
                logoMotto.value = logoSettings.motto;
            }
            
            updateLogoDisplay();
        }
    } catch (error) {
        console.error('加载标题设置失败:', error);
    }
}

function getLogoSettings() {
    try {
        const savedSettings = localStorage.getItem('logoSettings');
        if (savedSettings) {
            return JSON.parse(savedSettings);
        }
    } catch (error) {
        console.error('获取标题设置失败:', error);
    }
    
    return {
        image: 'assets/19.jpg',
        title: '逐梦者19班',
        motto: '我们不生产水，我们只是大自然的搬运工'
    };
}

// 显示更新提示
function showUpdateNotification(info) {
    const releaseNotes = info.releaseNotes ? info.releaseNotes.substring(0, 300) + '...' : '';
    const releaseUrl = info.releaseUrl || '#';
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'update-modal-overlay';
    
    // 创建弹窗内容
    const modal = document.createElement('div');
    modal.className = 'update-modal';
    modal.innerHTML = `
        <div class="update-modal-header">
            <i class="fas fa-sync-alt"></i>
            <h3 class="update-modal-title">发现新版本</h3>
        </div>
        <div class="update-modal-body">
            <div class="update-version-info">
                <span class="current-version-text">当前版本: v1.0.3</span>
                <span class="new-version-badge">v${info.version}</span>
            </div>
            ${releaseNotes ? `<div class="update-release-notes">${releaseNotes}</div>` : ''}
        </div>
        <div class="update-modal-footer">
            <button class="update-modal-btn update-modal-btn-secondary" id="dismissUpdate">
                <i class="fas fa-clock"></i>
                稍后提醒
            </button>
            <button class="update-modal-btn update-modal-btn-secondary" id="viewRelease">
                <i class="fas fa-external-link-alt"></i>
                查看详情
            </button>
            <button class="update-modal-btn update-modal-btn-primary" id="downloadUpdate">
                <i class="fas fa-download"></i>
                立即下载
            </button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 关闭弹窗函数
    const closeModal = () => {
        modal.style.animation = 'scaleOut 0.3s ease';
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    };
    
    // 绑定按钮事件
    document.getElementById('downloadUpdate').addEventListener('click', () => {
        // 开始下载更新
        ipcRenderer.invoke('download-update');
        closeModal();
    });
    
    document.getElementById('viewRelease').addEventListener('click', () => {
        // 打开GitHub发布页面
        const { shell } = require('electron');
        shell.openExternal(releaseUrl);
        closeModal();
    });
    
    document.getElementById('dismissUpdate').addEventListener('click', () => {
        // 稍后提醒（24小时后）
        setUpdateReminder();
        closeModal();
    });
    
    // 点击遮罩层关闭弹窗
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

// 设置提醒
function setUpdateReminder() {
    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + 24); // 24小时后提醒
    
    localStorage.setItem('updateReminderTime', reminderTime.toISOString());
    showNotification('已设置24小时后提醒更新', 'info');
}

// 检查提醒
function checkUpdateReminder() {
    const reminderTime = localStorage.getItem('updateReminderTime');
    if (reminderTime) {
        const reminder = new Date(reminderTime);
        const now = new Date();
        
        if (now >= reminder) {
            localStorage.removeItem('updateReminderTime');
            // 重新检查更新
            ipcRenderer.invoke('check-for-updates');
        }
    }
}

// 显示下载进度
function showUpdateProgressNotification(progress) {
    // 这个函数现在不再使用，因为我们只显示简单的通知
    // 保留函数以防其他地方调用
    console.log('下载进度:', Math.round(progress.percent) + '%');
}

// 显示更新完成
function showUpdateReadyNotification(info) {
    // 移除进度通知
    const existingProgress = document.querySelector('.update-progress-notification');
    if (existingProgress) {
        existingProgress.remove();
    }
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'update-modal-overlay';
    
    // 创建弹窗内容
    const modal = document.createElement('div');
    modal.className = 'update-modal';
    modal.innerHTML = `
        <div class="update-modal-header">
            <i class="fas fa-check-circle"></i>
            <h3 class="update-modal-title">更新准备就绪</h3>
        </div>
        <div class="update-modal-body">
            <div class="update-version-info">
                <span class="current-version-text">新版本: v${info.version}</span>
                <span class="new-version-badge">准备安装</span>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                更新文件已下载完成，是否立即安装新版本？安装后应用将自动重启
            </p>
        </div>
        <div class="update-modal-footer">
            <button class="update-modal-btn update-modal-btn-secondary" id="dismissInstall">
                <i class="fas fa-clock"></i>
                稍后安装
            </button>
            <button class="update-modal-btn update-modal-btn-primary" id="installUpdate">
                <i class="fas fa-rocket"></i>
                立即安装
            </button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 关闭弹窗函数
    const closeModal = () => {
        modal.style.animation = 'scaleOut 0.3s ease';
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    };
    
    // 绑定按钮事件
    document.getElementById('installUpdate').addEventListener('click', () => {
        ipcRenderer.invoke('install-update');
        closeModal();
    });
    
    document.getElementById('dismissInstall').addEventListener('click', () => {
        closeModal();
    });
    
    // 点击遮罩层关闭弹窗
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
}

function updateLogoDisplay() {
    const logoSettings = getLogoSettings();
    
    const logoImage = document.querySelector('.logo-image');
    const logoTitleElement = document.querySelector('.logo-title');
    const logoMottoElement = document.querySelector('.logo-motto');
    
    if (logoImage && logoSettings.image) {
        logoImage.src = logoSettings.image;
    }
    
    if (logoTitleElement && logoSettings.title) {
        logoTitleElement.textContent = logoSettings.title;
    }
    
    if (logoMottoElement && logoSettings.motto) {
        logoMottoElement.textContent = `"${logoSettings.motto}"`;
    }
}

function updateLogoPreview() {
    // 实时预览功能，暂时不用
}
