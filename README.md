# 智能注浆开采模型 · 展示网站

基于协同联动的矿山覆岩位移—注浆补偿试验模型的项目展示网站，含交互式三维演示。

- **在线访问**：`https://lusion357-afk.github.io/intelligent-grouting/`
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
├── demo/               # 覆岩三带与沉降对照 3D 演示（自包含）
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

1. 在 GitHub 新建仓库（如 `intelligent-grouting`）。
2. 推送本目录内容到 `main` 分支。
3. 仓库 Settings → Pages → Build and deployment 选择 **Deploy from a branch**，分支选 `main`、目录选 `/ (root)`。
4. 等待构建完成后访问 `https://<用户名>.github.io/<仓库名>/`。

> 页面的 canonical / Open Graph 链接已配置为 `lusion357-afk.github.io/intelligent-grouting`。

## 说明

- 3D 演示为团队既有成果（`Desktop\22\智能注浆3D演示_v04`），原样复制，未改动其内容与免责声明。
- 站点所有曲线数值、趋势、时序、尺寸与设备布局均为示意，不代表实测参数或真实矿井过程。
