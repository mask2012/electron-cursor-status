const express = require("express");
const path = require("path");

const server = express();
const distPath = path.join(__dirname, "../dist");

// 存储服务器实例
let staticServerInstance = null;

// 静态文件服务
server.use(express.static(distPath));

// SPA路由回退 - 所有未匹配的路由都返回index.html
server.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

function startStaticServer() {
  try {
    // 根据环境判断端口，与main.js保持一致
    const env = __dirname.split(path.sep).indexOf("app.asar") >= 0 ? "production" : "development";
    const port = env === "development" ? 2321 : 2322;

    // 检查dist目录是否存在
    const fs = require("fs");
    if (!fs.existsSync(distPath)) {
      console.error(`错误: dist目录不存在: ${distPath}`);
      console.error("请先运行 'npm run build' 构建Vue项目");
      return null;
    }

    staticServerInstance = server.listen(port, (err) => {
      if (err) {
        console.error(`静态服务器启动失败:`, err);
        return;
      }
      console.log(`✅ Express服务器已启动:`);
      console.log(`   - 端口: ${port}`);
      console.log(`   - 环境: ${env}`);
      console.log(`   - 静态文件目录: ${distPath}`);
      console.log(`   - 访问地址: http://localhost:${port}`);
    });

    // 错误处理
    staticServerInstance.on("error", (err) => {
      console.error("静态服务器错误:", err);
    });

    return staticServerInstance;
  } catch (error) {
    console.error("启动静态服务器时出错:", error);
    return null;
  }
}

function stopStaticServer() {
  return new Promise((resolve) => {
    if (staticServerInstance) {
      console.log("正在关闭静态服务器...");
      staticServerInstance.close((error) => {
        if (error) {
          console.error("关闭静态服务器时出错:", error);
        } else {
          console.log("静态服务器已关闭");
        }
        staticServerInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  startStaticServer,
  stopStaticServer,
};
