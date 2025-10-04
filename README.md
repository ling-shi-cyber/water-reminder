# 每日抬水提醒

一个简单的桌面应用，用来提醒学生按时抬水。基于Electron开发

## 主要功能

- 定时提醒(默认跳过周日)
- 轮流选择学生
- 语音播报
- 学生名单管理
- 抬水统计
- 主题切换
- 开机自启和静默启动
- 自动更新(提供Gitee和Github下载源)

## 下载安装

去 [Releases](https://github.com/ling-shi-cyber/water-reminder/releases) 页面下载最新的安装包

## 开发运行

```bash
# 克隆项目
git clone https://github.com/ling-shi-cyber/water-reminder.git
cd water-reminder

# 安装依赖
npm install

# 运行应用（windows用户可以直接运行start.bat）
npm start

# 打包应用
npm run build
```

## 使用说明

1. 在设置页面启用提醒功能
2. 设置提醒时间(默认早上9点)
3. 添加学生名单
4. 系统会自动轮流选择学生进行提醒

## 技术栈

- Electron
- HTML/CSS/JavaScript

## 联系方式

- 开发者：Snacks
- GitHub：[@ling-shi-cyber](https://github.com/ling-shi-cyber)
- 邮箱：snacks.bug9220@gmail.com
