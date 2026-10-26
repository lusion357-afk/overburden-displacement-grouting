# 智能注浆开采模型 · 展示网站

基于协同联动的矿山覆岩位移—注浆补偿试验模型的项目展示网站，含交互式三维演示。

- **在线访问**：`https://lusion357-afk.github.io/overburden-displacement-grouting/`
- **单位**：中国矿业大学（北京）能源与矿业学院，"未来+"大学生创新中心开放项目
- **性质**：交互原型 · 原理演示 · 非试验数据（尚未开展实验）

## 技术栈

纯静态站点，零构建、零外部 CDN 依赖：

- 原生 HTML / CSS / JavaScript（无框架、无依赖）
- 明/暗主题切换（`data-theme` + CSS 变量，跟随系统偏好）
- 响应式布局（桌面 / 移动端）
- 3D 演示为自包含的 Three.js 网页，位于 `demo/`（`vendor/three.min.js` 本地引入）

## 目录结构

```
├── index.html          # 单页展示（项目简介 / 技术原理 / 覆岩三带 / 3D 演示 / 团队 / 文献 / 资料）
├── css/style.css       # 样式与主题变量
├── js/main.js          # 主题切换、滚动高亮、入场动画、灯箱、回到顶部
├── img/                # favicon、OG 封面、研究资料图片
├── demo/               # 华丰 1411 错层位离层注浆减沉 3D 演示（自包含）
│   ├── data/geology.js # 唯一数值来源（文献/公式/设定三态标注 + 出处）
│   ├── docs/           # 几何契约、材料对标表、双巷/三机/三角底煤等考证文档
│   ├── _refs/          # 页面加载即验的几何/数据断言脚本（内部截图与备份未随站发布）
│   └── …               # scene.js / ui.js / geometry.js / lane-section.js / mining-volume.js 等
└── README.md
```

## 本地运行

用浏览器直接打开 `index.html` 即可（页面引用均为相对路径，无需服务器）。

若需通过 HTTP 访问（部分浏览器对 `iframe` 本地文件限制更严格），可在本目录启动一个静态服务器：

```bash
python -m http.server 8080
# 或
npx serve .
```

然后访问 http://localhost:8080/。

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（如 `overburden-displacement-grouting`）。
2. 推送本目录内容到 `main` 分支。
3. 仓库 Settings → Pages → Build and deployment 选择 **Deploy from a branch**，分支选 `main`、目录选 `/ (root)`。
4. 等待构建完成后访问 `https://<用户名>.github.io/<仓库名>/`。

> 页面的 canonical / Open Graph 链接已配置为 `lusion357-afk.github.io/overburden-displacement-grouting`。

## 说明

- 3D 演示为团队既有成果（`"未来+"模型总参 v11.0 / 智能注浆3D演示_v11`，v1.1.0 审计修订版），原样同步其运行文件、`data/` 与 `docs/`；`_refs/` 仅保留页面加载所需的几何/数据断言脚本，内部截图、备份与探针工具未随站发布。
- 演示几何以华丰 1411 工作面的公开参数为基准（倾角 30°、倾向 142 m、走向 2160 m、埋深 960 m，1:200），但覆岩三带、离层、注浆与曲线仍为原理示意；站点所有曲线数值、趋势、时序与设备布局不代表实测参数或真实矿井过程。
