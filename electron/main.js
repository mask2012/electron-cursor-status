const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const { startStaticServer } = require("./statisServerHandler");
const path = require("path");
const { log, initializeLogger } = require("./log");
const { StatusServer } = require("./statusServer");
const { getNetworkInterfaces } = require("./util"); // 添加导入

let mainWindow;
let statusServer;
let tray; // 系统托盘实例
let windowState = {
  // 窗口状态记录
  isVisible: true,
  bounds: null,
};

// 创建系统托盘
function createTray() {
  try {
    // 获取正确的图标路径，兼容开发和生产环境
    let iconPath;
    const env = __dirname.split(path.sep).indexOf("app.asar") >= 0 ? "production" : "development";

    if (env === "production") {
      // 生产环境：图标应该在resources目录下
      iconPath = path.join(process.resourcesPath, "favicon.ico");
      // 如果上面的路径不存在，尝试备用路径
      const fs = require("fs");
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(process.resourcesPath, "app.asar.unpacked", "public", "favicon.ico");
        if (!fs.existsSync(iconPath)) {
          // 最后备用：使用内置的默认图标
          iconPath = path.join(__dirname, "../public/favicon.ico");
        }
      }
    } else {
      // 开发环境
      iconPath = path.join(__dirname, "../public/favicon.ico");
    }

    log.info("托盘图标路径:", iconPath);
    log.info("当前环境:", env);

    // 检查图标文件是否存在
    const fs = require("fs");
    if (!fs.existsSync(iconPath)) {
      log.error("托盘图标文件不存在:", iconPath);
      // 尝试使用windows默认图标路径
      if (process.platform === "win32") {
        iconPath = path.join(__dirname, "../public/favicon.ico");
        if (!fs.existsSync(iconPath)) {
          throw new Error("找不到合适的托盘图标文件");
        }
      }
    }

    tray = new Tray(iconPath);
    log.info("系统托盘图标创建成功");

    // 设置托盘提示文字
    tray.setToolTip("Cursor Status");

    // 创建托盘右键菜单
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "显示窗口",
        click: () => {
          showWindow();
        },
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    // 设置托盘右键菜单
    tray.setContextMenu(contextMenu);

    // 托盘左键单击事件 - 切换窗口显示/隐藏
    tray.on("click", () => {
      if (windowState.isVisible) {
        hideWindow();
      } else {
        showWindow();
      }
    });

    log.info("系统托盘已创建");
  } catch (error) {
    log.error("创建系统托盘失败:", error);
    log.error("错误详情:", error.message);

    // 托盘创建失败时，确保窗口仍然可以显示
    log.info("托盘创建失败，但应用将继续运行");
  }
}

// 显示窗口
function showWindow() {
  if (mainWindow) {
    if (windowState.bounds) {
      // 恢复到之前的位置和大小
      mainWindow.setBounds(windowState.bounds);
    }
    mainWindow.show();
    mainWindow.focus();
    windowState.isVisible = true;
    log.info("窗口已显示");
  }
}

// 隐藏窗口
function hideWindow() {
  if (mainWindow) {
    // 保存当前窗口位置和大小
    windowState.bounds = mainWindow.getBounds();
    mainWindow.hide();
    windowState.isVisible = false;
    log.info("窗口已隐藏到系统托盘");
  }
}

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // 隐藏菜单栏
  mainWindow.setMenu(null);

  // 加载应用的 index.html
  let localLink;
  log.info("__dirname");
  log.info(__dirname);
  const env = __dirname.split(path.sep).indexOf("app.asar") >= 0 ? "production" : "development";
  if (env === "development") {
    localLink = "http://localhost:2321/";
  } else {
    localLink = "http://localhost:2322/";
  }
  mainWindow.loadURL(localLink);

  if (env === "development") {
    mainWindow.webContents.openDevTools();
  }

  // 当窗口关闭时触发
  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  // 当窗口最小化时，隐藏到系统托盘
  mainWindow.on("minimize", function (event) {
    event.preventDefault();
    hideWindow();
  });

  // 当用户尝试关闭窗口时，隐藏窗口而不是关闭
  mainWindow.on("close", function (event) {
    if (!app.isQuitting) {
      event.preventDefault();
      hideWindow();
      return false;
    }
  });
}

// IPC通信处理程序
// 在这里添加您的自定义IPC处理器

// 添加获取网络接口信息的IPC处理器
ipcMain.handle("get-network-interfaces", async () => {
  try {
    const networkInfo = getNetworkInterfaces();
    log.info("获取网络接口信息:", networkInfo);
    return networkInfo;
  } catch (error) {
    log.error("获取网络接口信息失败:", error);
    return { mac: null, ipv4: null, error: error.message };
  }
});

// 添加获取当前端口信息的IPC处理器
ipcMain.handle("get-port-info", async () => {
  try {
    const env = __dirname.split(path.sep).indexOf("app.asar") >= 0 ? "production" : "development";
    const port = env === "development" ? 2321 : 2322;
    log.info("获取端口信息:", { env, port });
    return { env, port };
  } catch (error) {
    log.error("获取端口信息失败:", error);
    return { env: "unknown", port: 2321, error: error.message };
  }
});

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(async () => {
  // 初始化日志模块
  initializeLogger();

  //开启静态页面服务器
  startStaticServer();

  // 启动状态服务器
  statusServer = new StatusServer();
  statusServer.start();
  log.info("状态服务器已启动");

  // 创建系统托盘
  createTray();

  createWindow();
});

// 当所有窗口关闭时退出应用
app.on("window-all-closed", () => {
  // 在macOS上，除非用户使用Cmd + Q明确退出，
  // 否则保持应用程序和菜单栏活跃
  if (process.platform !== "darwin") {
    // 不要在这里直接退出应用
    // app.quit();
  }
});

// 应用退出前清理
app.on("before-quit", async (event) => {
  if (statusServer) {
    event.preventDefault();
    try {
      await statusServer.stop();
      log.info("状态服务器已停止");

      // 清理系统托盘
      if (tray) {
        tray.destroy();
        tray = null;
        log.info("系统托盘已清理");
      }

      app.quit();
    } catch (error) {
      log.error("停止状态服务器时出错:", error);

      // 即使出错也要清理托盘
      if (tray) {
        tray.destroy();
        tray = null;
      }

      app.quit();
    }
  }
});

app.on("activate", function () {
  if (mainWindow === null) createWindow();
});

// IPC通信处理
ipcMain.on("send-message", (event, message) => {
  mainWindow.webContents.send("message-to-webviews", message);
});
