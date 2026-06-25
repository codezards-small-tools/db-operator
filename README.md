# DB Operator

Cross-platform database management client built with Electron, React, and TypeScript.

## Features (MVP)

- Connection profiles for MySQL (5.x+) and PostgreSQL
- Schema browser with lazy-loaded databases/schemas and tables
- Table structure viewer with DDL preview
- SQL editor with syntax highlighting and result grid
- Query result row limit (1000 rows) to protect memory

## Requirements

- Node.js 20+
- npm 9+

## Development (all platforms)

```bash
npm install
npm run check:env   # verify local dev environment
npm run dev         # start Electron + Vite (auto-detects platform)
```

`npm run dev` detects the current OS and applies the right Electron flags:

| Environment   | Detection                        | Notes                                          |
| ------------- | -------------------------------- | ---------------------------------------------- |
| **macOS**     | `darwin`                         | Works out of the box                           |
| **Windows**   | `win32`                          | Works out of the box (PowerShell / CMD)        |
| **Linux**     | native `linux`                   | Install GUI libs once (`npm run setup:linux`)  |
| **WSLg**      | `/mnt/wslg` or `WAYLAND_DISPLAY` | Wayland + no-sandbox auto-enabled              |
| **WSL (X11)** | WSL without WSLg                 | Uses Windows X server; `DISPLAY` auto-fallback |

Utility commands:

```bash
npm run platform      # print detected dev platform
npm run setup:linux       # system install (sudo) or user-local fallback
npm run setup:linux:user  # download libs to .electron-libs/ (no sudo)
npm run check:env     # diagnose Node, Electron, display, libraries
```

### Web 样式调试

不启动 Electron，在浏览器中调试 renderer 样式（Vite HMR）：

```bash
npm run dev:web
```

- 自动打开 `http://localhost:5199`
- 修改 [`src/renderer/src/styles/tokens.css`](src/renderer/src/styles/tokens.css) 或 [`global.css`](src/renderer/src/styles/global.css) 即时热更新
- Chrome DevTools 中编辑 `:root` CSS 变量（如 `--app-bg`、`--sql-panel-height`）可实时预览
- 顶部蓝条提示 **Web Preview** 表示 `dbApi` 已 mock，数据为示例

与 `npm run dev` 对比：

| 命令              | 用途                               |
| ----------------- | ---------------------------------- |
| `npm run dev:web` | 仅 UI / 样式开发，浏览器 + HMR     |
| `npm run dev`     | 完整 Electron 联调，真实数据库连接 |

### macOS

**System requirements:** macOS 12.0 (Monterey) or later, including macOS 15.x (Sequoia) and newer releases. Release builds ship separate DMGs for Apple Silicon (`*-arm64.dmg`) and Intel (`*-x64.dmg`).

**Install from GitHub Release:**

1. Download the DMG matching your Mac from [Releases](https://github.com/codezards-small-tools/db-operator/releases):
   - Apple Silicon (M1/M2/M3/M4): `db-operator-x.y.z-arm64.dmg`
   - Intel: `db-operator-x.y.z-x64.dmg`
2. Open the DMG and drag **DB Operator** to Applications
3. Because the app is not code-signed, macOS may block the first launch. Right-click the app and choose **Open**, or allow it under **System Settings → Privacy & Security**

**Development:**

```bash
npm install
npm run dev
```

Optional debug: VS Code compound launch **Debug All** (`.vscode/launch.json`).

### Windows (native)

Open the project in PowerShell or CMD:

```powershell
npm install
npm run dev
```

Build Windows installer from Windows:

```powershell
npm run build:win
```

### Windows WSL / WSLg

Recommended: **develop inside WSL** with WSLg (Windows 11).

1. On Windows PowerShell:

```powershell
wsl --update
wsl --shutdown
```

2. In WSL:

```bash
npm run setup:linux
npm run check:env
npm run dev
```

WSLg signals: `/mnt/wslg` exists, `WAYLAND_DISPLAY=wayland-0`, `DISPLAY=:0`.

**WSL without WSLg:** install [VcXsrv](https://sourceforge.net/projects/vcxsrv/) on Windows, start XLaunch (display 0), then in WSL:

```bash
export DISPLAY=$(grep nameserver /etc/resolv.conf | awk '{print $2}'):0
npm run dev
```

The app also tries this `DISPLAY` fallback automatically when running under WSL.

### Linux (native)

Ubuntu / Debian:

```bash
npm run setup:linux
npm run check:env
npm run dev
```

Other distros: install the equivalent of `libnspr4`, `libnss3`, `libasound2`, and other Electron GTK dependencies, then run `npm run check:env`.

## Build

```bash
npm run build          # typecheck + bundle
npm run build:win      # Windows installer (run on Windows)
npm run build:mac      # macOS universal dmg (run on macOS)
npm run build:linux    # Linux AppImage/deb
npm run verify:macos   # verify macOS DMG artifact (run on macOS after build)
```

## Project layout

- `src/main` — Electron main process, database adapters, IPC handlers
- `src/main/platform` — cross-platform runtime detection (macOS / Windows / Linux / WSL / WSLg)
- `src/preload` — secure `window.dbApi` bridge
- `src/renderer` — React UI
- `src/shared` — shared TypeScript types
- `scripts/` — cross-platform dev helpers (`run-dev.mjs`, `check-env.mjs`)

## Security notes

- Database drivers run only in the main process
- Connection passwords are stored locally with base64 obfuscation (MVP)
- Renderer has `contextIsolation` enabled and `nodeIntegration` disabled
- `no-sandbox` is enabled only on Linux-based dev targets where Chromium requires it

## Manual test checklist

1. Create and test a MySQL connection
2. Create and test a PostgreSQL connection
3. Expand schema tree and inspect table columns / DDL
4. Run `SELECT` queries and verify result grid
5. Run `INSERT`/`UPDATE` and verify affected row count
