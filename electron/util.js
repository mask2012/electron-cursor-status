const os = require("os"); // 导入os模块用于获取网卡信息
const { log } = require("./log");

// 获取并打印网卡信息
function getNetworkInterfaces() {
  const networkInterfaces = os.networkInterfaces();

  // 定义结果对象
  let result = { mac: null, ipv4: null };

  // 按优先级排序的网卡候选列表
  const candidates = [];

  // 遍历所有网卡
  for (const name in networkInterfaces) {
    const interfaces = networkInterfaces[name];

    // 查找每个网卡中的IPv4接口
    const ipv4Interface = interfaces.find((iface) => iface.family === "IPv4" && !iface.internal);

    if (ipv4Interface) {
      let priority = 0;

      // 根据网卡名称和特征确定优先级
      if (name.toLowerCase().includes("以太网") || name.toLowerCase() === "以太网适配器 以太网") {
        priority = 100; // 最高优先级
      } else if (name.toLowerCase().includes("ethernet")) {
        priority = 90;
      } else if (
        !name.toLowerCase().includes("virtual") &&
        !name.toLowerCase().includes("vmware") &&
        !name.toLowerCase().includes("wsl") &&
        !name.toLowerCase().includes("蓝牙") &&
        !name.toLowerCase().includes("bluetooth") &&
        !name.toLowerCase().includes("无线") &&
        !name.toLowerCase().includes("wireless") &&
        !name.toLowerCase().includes("wi-fi") &&
        !name.toLowerCase().includes("loopback") &&
        !ipv4Interface.address.startsWith("127.") &&
        !ipv4Interface.address.startsWith("169.254.")
      ) {
        priority = 80; // 可能是有线连接但名称不典型
      } else if (
        ipv4Interface.address.startsWith("192.168.") ||
        ipv4Interface.address.startsWith("10.") ||
        ipv4Interface.address.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
      ) {
        priority = 50; // 私有IP地址范围
      }

      // 筛选掉明确的虚拟适配器
      if (
        !name.toLowerCase().includes("clash") &&
        !name.toLowerCase().includes("tap") &&
        !name.toLowerCase().includes("tunneling") &&
        !name.toLowerCase().includes("vpn")
      ) {
        candidates.push({
          name,
          ipv4: ipv4Interface.address,
          mac: ipv4Interface.mac,
          priority,
        });
      }
    }
  }

  // 按优先级排序
  candidates.sort((a, b) => b.priority - a.priority);

  // 输出所有候选网卡（用于调试）
  // log.debug("网卡候选列表:");
  // candidates.forEach((candidate) => {
  //   log.debug(`名称: ${candidate.name}, IP: ${candidate.ipv4}, MAC: ${candidate.mac}, 优先级: ${candidate.priority}`);
  // });

  // 选择优先级最高的网卡
  if (candidates.length > 0) {
    result.mac = candidates[0].mac;
    result.ipv4 = candidates[0].ipv4;
    // log.info(`已选择网卡: ${candidates[0].name}`);
    log.info(`IPv4 地址: ${result.ipv4}`);
  } else {
    log.warn("============未找到有效的网络连接============");
  }

  return result;
}

//从command中获取参数
function getCommandLineArgValue(argv, argName) {
  const filteredArgs = argv.filter((arg) => arg.startsWith("--"));
  for (let i = 0; i < filteredArgs.length; i++) {
    const arg = filteredArgs[i].substring(2); // 去除 "--" 前缀
    if (arg.startsWith(argName + "=")) {
      return arg.split("=")[1];
    }
  }
  return undefined;
}

function sleep(seconds) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, seconds);
  });
}

module.exports = {
  getCommandLineArgValue,
  sleep,
  getNetworkInterfaces,
};
