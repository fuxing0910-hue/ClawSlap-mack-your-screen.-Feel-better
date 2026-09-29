# 🦀 Clabie — 学习/办公心烦？没关系 扇你的电脑
> *Stressed from studying or work? Smack your computer.*
> 它不干正事。它只会在你敲键盘/甩鼠标的时候，往你屏幕上扇巴掌。
> *It does nothing productive. It just slaps your screen when you mash your keyboard or shake your mouse.*

## 凭什么？
> *Why?*

你是不是也经常写作业写到崩溃想扇屏幕？代码报错只想给编辑器一个大嘴巴子？Vibecoding的时候AI总是出错？……你也想扇点什么对不对？

> *Ever wanted to slap your screen when your homework makes no sense? Smack your editor when the code won't compile? Punch something when the AI keeps getting it wrong during vibecoding? Yeah... you want to hit something.*

总之——ClawSlap 就是干这个的。

> *Anyway — ClawSlap is here for exactly that.*

## 怎么扇
> *How to Slap*

| 操作 | 效果 |
|---|---|
| ⌨️ 扇键盘 | 触发 SLAP！👋 + 冲击波 + 屏幕闪白 + 音效 |
| 🖱️ 握着鼠标疯狂甩动 | 同上，特效在你光标附近炸开 |
| 🖱️ 快速右键三连击 | 👋 直接在你光标脸上蹦出来 |

> | *Action* | *Effect* |
> |---|---|
> | ⌨️ *Mash adjacent keys* | *Triggers SLAP! 👋 + shockwave + screen flash + sound* |
> | 🖱️ *Shake mouse violently* | *Same — effects burst near your cursor* |
> | 🖱️ *Right-click ×3 rapidly* | *👋 Pops right on your cursor's face* |

（温馨提示：善待电脑）
> *（Friendly reminder: be gentle with your computer）*

## 不只是扇巴掌
> *More Than Just Slaps*

右下角还住着一只螃蟹 🦀 **Clabie**：

> *A crab named 🦀 **Clabie** lives in the bottom-right corner:*

- 扇一两下 → 它肿了，委屈巴巴
- 连着扇 → 它气炸了，脸都红了
- 鼠标在它身上画圈摸摸 → 它被安抚，露出 `>v<` 表情，吹出 "purrr~" 气泡
- 不理它 → 它会自己慢慢消气，或者打瞌睡 `zzz...`
- 扇多了它脸上还会贴创可贴 🩹

> - *Slap once or twice → it swells up, looking wronged*
> - *Keep slapping → it gets furious, face turns red*
> - *Circle your mouse over it → it gets soothed, makes a `>v<` face, and pops a "purrr~" bubble*
> - *Ignore it → it calms down on its own, or yawns `zzz...`*
> - *Too many slaps → a band-aid appears on its cheek 🩹*

## 还有统计
> *Also: Stats*

右键螃蟹 → 打开 30 天统计面板。你会知道：

> *Right-click the crab → opens a 30-day stats panel. You'll discover:*

- 你哪天解气的次数最多（柱状图 + Y轴刻度）
- 哪个应用/程序挨了你最多的巴掌（横向条形图）
- 你的安抚次数对比（Slaps vs Soothes，按程序分组）

> - *Which day you vented the most (bar chart with Y-axis)*
> - *Which app took the most hits (horizontal bar chart)*
> - *Slaps vs Soothes per app*

## 运行
> *Getting Started*

需要 Windows、Node.js 和 npm。首次安装依赖需要联网；当前仓库未发布可直接下载的安装包。

> *Requires Windows, Node.js, and npm. Installing dependencies needs an internet connection. No downloadable release package is currently published.*

```bash
git clone https://github.com/fuxing0910-hue/ClawSlap-mack-your-screen.-Feel-better.git
cd ClawSlap-mack-your-screen.-Feel-better
npm install
npm start
```

系统托盘会出现一只螃蟹。左键显示或隐藏特效窗口和宠物；右键打开菜单。隐藏窗口不会停止输入检测或统计记录，暂停检测请取消勾选菜单中的 `Enable ClawSlap`；完全退出请选择 `Quit`。

> *A crab appears in your system tray. Left-click shows or hides the overlay and pet; right-click opens the menu. Hiding the windows does not stop input detection or event recording. Uncheck `Enable ClawSlap` to pause detection, or choose `Quit` to exit.*

再次右键螃蟹，或再次选择托盘菜单中的 `Stats (30 days)`，可关闭统计面板。

> *Right-click the crab again, or choose `Stats (30 days)` again, to close the stats panel.*

## 本地数据
> *Local Data*

统计事件会保存在 Electron 用户数据目录下的 `clawslap-stats.json`，内容包括事件时间、应用名称，以及从前台窗口标题提取的页面或文档标题。当前应用代码未实现上传这些统计数据的功能。

> *Events are saved to `clawslap-stats.json` in Electron's user-data directory. Records include event times, application names, and page or document titles extracted from the foreground window title. The current application code does not implement uploading these statistics.*

面板展示最近 30 天；本地文件最多保留 30 个有事件的日期，因此不等同于自动删除所有超过 30 天的数据。源码运行时，控制台还会输出触发事件的按键组合，或鼠标位置、速度等调试信息；分享终端日志前请先检查内容。

> *The panel displays the last 30 days. The local file retains up to 30 dates with recorded events, which is not the same as deleting every record older than 30 days. When running from source, console logs also include key combinations that triggered an event, or mouse position and speed debug information. Review terminal logs before sharing them.*

如需清空统计，请先退出应用，再删除该数据文件。

> *To clear statistics, quit the app first, then delete that data file.*

## 怎么做到的
> *How It Works*

Electron 透明悬浮窗方案：

> *Electron transparent overlay approach:*

```js
new BrowserWindow({
  transparent: true,     // 全透明 / fully transparent
  frame: false,          // 没边框 / no frame
  alwaysOnTop: true,     // 骑在所有窗口头上 / always on top
  focusable: false,      // 不抢焦点 / doesn't steal focus
  skipTaskbar: true,     // 任务栏不显示 / hidden from taskbar
})
```

然后 `koffi` 调 Win32 API 轮询键盘鼠标状态——监听但不拦截，你的输入该怎么着还怎么着。

> *Then `koffi` calls Win32 APIs to poll keyboard and mouse state — listens without intercepting, your input works normally.*

## 文件
> *Files*

```
clawslap/
  main.js          # Electron 主进程：窗口 + 键盘鼠标轮询 + 统计
  preload.js       # IPC 桥接
  overlay.html     # Canvas 特效 + 统计面板
  pet.html         # 宠物螃蟹 + 安抚 + 气泡
  icon/            # 托盘图标
```

> ```
> clawslap/
>   main.js          # Electron main process: windows + input polling + stats
>   preload.js       # IPC bridge
>   overlay.html     # Canvas effects + stats panel
>   pet.html         # Pet crab + soothing + speech bubbles
>   icon/            # Tray icon
> ```

## 限制
> *Limitations*

- 只支持 Windows（通过 Win32 API 轮询键盘和鼠标状态）
- 特效覆盖主显示器，当前没有为每个显示器分别创建特效窗口。
- 这不是生产力工具。它不会让你的代码变好。但你会开心一点。

> - *Windows only (keyboard and mouse state are polled through Win32 APIs)*
> - *Effects cover the primary display; the app does not create a separate overlay for each monitor.*
> - *This is not a productivity tool. It won't make your code better. But you might smile.*

---

扇你的屏幕，解你的气。

> *Smack your screen. Feel better.*
