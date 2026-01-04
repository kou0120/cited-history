# Cited History

一个用于可视化论文引用历史趋势的 Web 应用，数据来源为 OpenAlex，展示效果类似 GitHub Star History。

项目目录：
- `web/`：Next.js 应用（App Router）

## 功能

- 输入 JSON（包含 `paper_label` 与 `doi`）
- 从 OpenAlex 拉取每篇论文的 `counts_by_year` 并绘制折线图（Recharts）
- 支持：
  - `log`：Y 轴对数尺度
  - `align`：时间线对齐（相对年份）
  - `cum`：累积引用
  - `legend`：图例位置
- 通过 URL 直接返回静态图片：`/api/render`（服务端 Headless Chromium 截图，尽可能与交互图一致）

## 本地开发（非 Docker）

在 `web/` 目录下：

```bash
npm install
npx playwright install --with-deps chromium
npm run dev
```

打开：
- `http://localhost:3000/`

## API

### POST `/api/citations`

请求体：论文数组

```json
[
  {"paper_label":"MAP2B","doi":"10.1186/s13059-021-02576-9"}
]
```

返回：每篇论文的按年引用数据。

### GET `/api/render`

返回：`image/png`

Query 参数：
- `data`：base64(json)
- `log`：`true|false`
- `align`：`true|false`
- `cum`：`true|false`
- `legend`：`top|bottom|left|right`

说明：
- `/api/render` 会打开 `/embed?render=true&...`，等待页面设置 `window.__CHART_READY__ = true` 后截图。

## Docker 部署

在仓库根目录：

```bash
docker build -t cited-history .
docker run --rm -p 3000:3000 cited-history
```

打开：
- `http://localhost:3000/`

备注：
- Docker 镜像基于 Playwright 官方镜像（已包含 Chromium 与依赖），用于保证 `/api/render` 可用。
