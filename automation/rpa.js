/**
 * automation/rpa.js
 * ─────────────────────────────────────────────────────────
 * Playwright + Electron RPA 完整示例
 *
 * 演示功能：
 *   1. 启动 Electron 应用
 *   2. 自动填写表单字段
 *   3. 拦截文件选择弹窗，自动注入指定文件（无需人工操作）
 *   4. 提交表单，断言结果
 *   5. 截图存档
 *
 * 运行方式：
 *   node automation/rpa.js
 * ─────────────────────────────────────────────────────────
 */

const { _electron: electron } = require("playwright");
const path = require("path");
const os   = require("os");
const fs   = require("fs");

// ── 配置 ─────────────────────────────────────────────────
const CONFIG = {
  // Electron 入口
  electronMain: path.join(__dirname, "../src/main.js"),

  // 要自动上传的文件（改成你自己的路径）
  uploadFile: path.join(os.homedir(), "Downloads", "baidu_rpa", "baidu_logo.png"),

  // 截图输出目录
  screenshotDir: path.join(os.homedir(), "Downloads", "rpa_screenshots"),

  // 表单内容
  formData: {
    name:   "张三",
    email:  "zhangsan@example.com",
    remark: "由 RPA 自动填写 " + new Date().toLocaleString("zh-CN"),
  },
};

// ── 工具：彩色日志 ───────────────────────────────────────
const log = {
  info:    (msg) => console.log(`\x1b[36m[INFO]\x1b[0m  ${msg}`),
  success: (msg) => console.log(`\x1b[32m[OK]\x1b[0m    ${msg}`),
  warn:    (msg) => console.log(`\x1b[33m[WARN]\x1b[0m  ${msg}`),
  error:   (msg) => console.log(`\x1b[31m[ERR]\x1b[0m   ${msg}`),
  step:    (n, msg) => console.log(`\n\x1b[35m── 步骤 ${n}：${msg}\x1b[0m`),
};

// ── 工具：截图 ───────────────────────────────────────────
async function screenshot(page, name) {
  fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
  const filePath = path.join(CONFIG.screenshotDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  log.info(`截图已保存：${filePath}`);
  return filePath;
}

// ── 工具：等待元素可见并高亮（调试用）─────────────────────
async function waitAndHighlight(page, selector, color = "#ff0") {
  const el = await page.waitForSelector(selector, { state: "visible" });
  await page.evaluate(
    ([sel, c]) => {
      const el = document.querySelector(sel);
      if (el) el.style.outline = `3px solid ${c}`;
    },
    [selector, color]
  );
  return el;
}

// ══════════════════════════════════════════════════════════
//  主流程
// ══════════════════════════════════════════════════════════

async function main() {
  console.log("═".repeat(52));
  console.log("  Playwright + Electron RPA 示例");
  console.log("═".repeat(52));

  // 检查上传文件是否存在
  if (!fs.existsSync(CONFIG.uploadFile)) {
    log.warn(`上传文件不存在：${CONFIG.uploadFile}`);
    log.warn("将创建一个临时测试文件代替...");
    // 创建一个临时 PNG 用于演示
    CONFIG.uploadFile = await createDummyFile();
  }

  let electronApp;

  try {
    // ────────────────────────────────────────────────────
    log.step(1, "启动 Electron 应用");
    // ────────────────────────────────────────────────────

    electronApp = await electron.launch({
      args: [CONFIG.electronMain],

      // 环境变量（传给 Electron 主进程）
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    });

    log.success("Electron 启动成功");

    // 获取主窗口（等待第一个窗口出现）
    const page = await electronApp.firstWindow();
    log.success(`获取到主窗口：${await page.title()}`);

    // 监听页面错误（调试用）
    page.on("pageerror", (err) => log.error(`页面错误：${err.message}`));
    page.on("console",   (msg) => {
      if (msg.type() === "error") log.warn(`控制台错误：${msg.text()}`);
    });

    // 等待页面完全加载
    await page.waitForLoadState("domcontentloaded");
    await screenshot(page, "01_launched");

    // ────────────────────────────────────────────────────
    log.step(2, "填写表单字段");
    // ────────────────────────────────────────────────────

    // 填写姓名
    await waitAndHighlight(page, "#nameInput");
    await page.fill("#nameInput", CONFIG.formData.name);
    log.success(`姓名已填写：${CONFIG.formData.name}`);
    // await page.waitForTimeout(300);

    // 填写邮箱
    await waitAndHighlight(page, "#emailInput");
    await page.fill("#emailInput", CONFIG.formData.email);
    log.success(`邮箱已填写：${CONFIG.formData.email}`);
    // await page.waitForTimeout(300);

    // 填写备注
    await waitAndHighlight(page, "#remarkInput");
    await page.fill("#remarkInput", CONFIG.formData.remark);
    log.success(`备注已填写：${CONFIG.formData.remark}`);
    // await page.waitForTimeout(300);

    await screenshot(page, "02_form_filled");

    // ────────────────────────────────────────────────────
    log.step(3, "自动处理文件上传");
    // ────────────────────────────────────────────────────

    // ✅ 关键：先注册 filechooser 监听器，再触发点击
    // Playwright 会拦截系统文件选择弹窗，直接注入指定文件
    const fileChooserPromise = page.waitForEvent("filechooser");

    // 点击上传区域（会触发隐藏的 input[type=file]）
    await page.click("#uploadZone");
    log.info("已点击上传区域，等待文件选择弹窗...");

    // 等待并处理文件选择弹窗
    const fileChooser = await fileChooserPromise;
    log.info(`文件选择弹窗已拦截，类型：${fileChooser.isMultiple() ? "多选" : "单选"}`);

    // 注入文件（这里就是 Playwright 的魔法，完全不弹系统窗口）
    await fileChooser.setFiles(CONFIG.uploadFile);
    log.success(`文件已自动注入：${path.basename(CONFIG.uploadFile)}`);

    // 等待页面更新文件名显示
    await page.waitForFunction(() => {
      const el = document.getElementById("fileName");
      return el && el.textContent.includes("✓");
    });
    log.success("页面已确认文件选择");

    await page.waitForTimeout(500);
    await screenshot(page, "03_file_selected");

    // ────────────────────────────────────────────────────
    log.step(4, "提交表单");
    // ────────────────────────────────────────────────────

    await waitAndHighlight(page, "#submitBtn", "#4a90e2");
    await page.click("#submitBtn");
    log.info("已点击提交按钮");

    // 等待结果出现
    await page.waitForSelector("#result", { state: "visible" });
    const resultText = await page.textContent("#result");
    log.success(`表单提交结果：${resultText}`);

    await screenshot(page, "04_submitted");

    // ────────────────────────────────────────────────────
    log.step(5, "断言验证");
    // ────────────────────────────────────────────────────

    // 验证结果中包含姓名和邮箱
    if (!resultText.includes(CONFIG.formData.name)) {
      throw new Error(`结果中未找到姓名：${CONFIG.formData.name}`);
    }
    if (!resultText.includes(CONFIG.formData.email)) {
      throw new Error(`结果中未找到邮箱：${CONFIG.formData.email}`);
    }
    if (!resultText.includes(path.basename(CONFIG.uploadFile))) {
      throw new Error(`结果中未找到文件名`);
    }
    log.success("所有断言通过 ✓");

    // ────────────────────────────────────────────────────
    log.step(6, "演示：通过 IPC 调用主进程 API");
    // ────────────────────────────────────────────────────

    // Playwright 可以直接调用 Electron 主进程的方法
    const paths = await electronApp.evaluate(async ({ app, ipcMain }) => {
      // 这段代码在 Electron 主进程中运行！
      return {
        version:  app.getVersion(),           // ✅ electron 对象
        platform: process.platform,           // ✅ 全局 process
        home:     process.env.USERPROFILE,    // ✅ 环境变量
      };
    });

    log.success(`主进程信息：`);
    console.log("         应用名称：", paths.appName);
    console.log("         应用版本：", paths.version);
    console.log("         运行平台：", paths.platform);
    console.log("         Home 目录：", paths.home);

    // 最终截图
    await screenshot(page, "05_final");

    // ────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(52));
    console.log("  ✅ 所有步骤执行完毕！");
    console.log(`  📁 截图目录：${CONFIG.screenshotDir}`);
    console.log("═".repeat(52) + "\n");

    // 保持窗口 2 秒供人工查看
    await page.waitForTimeout(2000);

  } catch (err) {
    log.error(`RPA 执行失败：${err.message}`);
    console.error(err);
    process.exit(1);

  } finally {
    // if (electronApp) {
    //   await electronApp.close();
    //   log.info("Electron 已关闭");
    // }
  }
}

// ── 工具：创建临时测试文件 ───────────────────────────────
async function createDummyFile() {
  const tmpPath = path.join(os.tmpdir(), "rpa_test_upload.txt");
  fs.writeFileSync(tmpPath, "这是 RPA 自动化测试用的临时文件\n创建时间：" + new Date().toISOString());
  log.info(`已创建临时测试文件：${tmpPath}`);
  return tmpPath;
}

// ── 启动 ─────────────────────────────────────────────────
main();
