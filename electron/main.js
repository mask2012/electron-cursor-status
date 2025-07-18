const { app, BrowserWindow, ipcMain } = require("electron");
const { startStaticServer } = require("./statisServerHandler");
const path = require("path");
const { log, initializeLogger } = require("./log");
const { StatusServer } = require("./statusServer");
const { getNetworkInterfaces } = require("./util"); // 添加导入

let mainWindow;
let statusServer;

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

  // 当用户尝试关闭窗口时，隐藏窗口而不是关闭
  mainWindow.on("close", function (event) {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
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
      app.quit();
    } catch (error) {
      log.error("停止状态服务器时出错:", error);
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
