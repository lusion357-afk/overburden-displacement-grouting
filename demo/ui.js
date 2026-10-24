(function () {
  'use strict';
  // 控件在本页生命周期内保持不变，复用引用，避免播放时反复查询整页。
  const elements = new Map(), groups = new Map();
  const $ = (id) => { if (!elements.has(id)) elements.set(id, document.getElementById(id)); return elements.get(id); };
  const qAll = (selector) => { if (!groups.has(selector)) groups.set(selector, Array.from(document.querySelectorAll(selector))); return groups.get(selector); };
  const chartDefinitions = [
    { id: 'chart-settlement', series: [{ key: 'settlement', color: '#36917a' }, { key: 'untreated', color: '#d69c6c', dashed: true, comparison: true }] },
    { id: 'chart-strain', series: [{ key: 'strain', color: '#9d8db4' }, { key: 'untreatedStrain', color: '#b96570', dashed: true, comparison: true }] },
    { id: 'chart-pump', series: [{ key: 'pressure', color: '#36917a' }, { key: 'flow', color: '#6399b2' }] }
  ];
  let api = null;
  let lastState = null;
  let samples = [];
  let stageStarts = [];
  let chartFrame = 0;
  let initialized = false;
  let lastSyncKey = '', lastChartKey = '', measureCharts = true;
  const text = (id, value) => { const element = $(id); if (element && element.textContent !== String(value)) element.textContent = value; };
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const format = (value) => finite(value).toFixed(2);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function invoke(method, ...args) { if (api && typeof api[method] === 'function') { api[method](...args); sync(api.getState()); } }

  function status(id, label, style) {
    const element = $(id);
    if (element.dataset.label !== label) {
      element.replaceChildren(document.createElement('i'), document.createTextNode(label));
      element.dataset.label = label;
    }
    element.className = style || '';
  }
  function sync(state) {
    if (!state) return;
    lastState = state;
    const progress = clamp(finite(state.progress), 0, 1);
    const stageIndex = clamp(Math.round(finite(state.stageIndex)), 0, 6);
    const options = state.options || {};
    const metrics = state.metrics || {};
    // 暂停后的旋转仍会发出场景状态，但无需写控件或重绘响应曲线。
    const syncKey = JSON.stringify([progress, stageIndex, state.stageTitle, state.stageText,
      state.playing, state.speed, state.mode, state.camera, state.triggered, state.pumpOn, options, metrics]);
    if (syncKey === lastSyncKey) return;
    lastSyncKey = syncKey;
    text('stage-title', state.stageTitle || '结构与布置');
    text('stage-text', state.stageText || '观察开采、岩层运动与注浆控制之间的关系。');
    text('stage-number', String(stageIndex + 1).padStart(2, '0') + ' / 07');
    text('play-label', state.playing ? '暂停' : progress >= 1 ? '重播' : '播放');
    $('play-button').setAttribute('aria-label', state.playing ? '暂停动画' : progress >= 1 ? '重新播放动画' : '播放动画');
    $('play-button').setAttribute('aria-pressed', String(!!state.playing));
    const desiredIcon = state.playing ? 'M6 4h3v12H6ZM12 4h3v12h-3Z' : 'm7 4 9 6-9 6Z';
    if ($('play-icon').firstElementChild.getAttribute('d') !== desiredIcon) $('play-icon').firstElementChild.setAttribute('d', desiredIcon);
    $('progress-slider').value = Math.round(progress * 1000);
    $('progress-slider').style.setProperty('--range-progress', (progress * 100) + '%');
    $('progress-slider').setAttribute('aria-valuetext', '进度 ' + Math.round(progress * 100) + '%，' + (state.stageTitle || ''));
    text('progress-label', Math.round(progress * 100) + '%');
    $('speed-select').value = String(state.speed || 1);
    $('previous-button').disabled = stageIndex === 0 && progress === 0;
    $('next-button').disabled = stageIndex === 6 && progress >= 1;
    qAll('[data-stage]').forEach((button) => {
      const index = Number(button.dataset.stage);
      button.classList.toggle('active', index === stageIndex);
      button.classList.toggle('complete', index < stageIndex);
      if (index === stageIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    qAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    qAll('[data-camera]').forEach((button) => {
      const active = !options.autoCamera && button.dataset.camera === state.camera;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('auto-camera').classList.toggle('active', !!options.autoCamera);
    $('auto-camera').setAttribute('aria-pressed', String(!!options.autoCamera));
    qAll('[data-option]').forEach((input) => { if (typeof options[input.dataset.option] === 'boolean') input.checked = options[input.dataset.option]; });
    $('comparison-legend').style.display = options.comparison === false ? 'none' : '';
    $('strain-comparison-legend').style.display = options.comparison === false ? 'none' : '';
    $('scene-viewport').classList.toggle('is-comparison', options.comparison !== false);
    text('treated-summary', progress < .12 ? '同步开采 · 待机监测' : progress < .54 ? '开采推进 · 共同初始响应' : progress < .90 ? '注浆干预 · 抑制后续下沉' : '已有下沉保留 · 发展受控');
    text('untreated-summary', progress < .12 ? '同步开采 · 持续监测' : progress < .54 ? '开采推进 · 共同初始响应' : progress < .84 ? '下沉持续 · 杆件形变增大' : '局部塌陷发展 · 候选情形');
    if (state.triggered) status('monitor-state', stageIndex === 6 ? '响应趋于稳定' : '已触发干预', stageIndex === 6 ? 'active' : 'alert');
    else if (stageIndex > 0) status('monitor-state', '持续监测', 'active');
    else status('monitor-state', '等待岩层运动', '');
    if (state.pumpOn) status('pump-state', stageIndex >= 5 ? '反馈调节中' : '定向注浆中', 'active');
    else status('pump-state', stageIndex === 6 ? '已自动停止' : '待机', '');
    const groutLabel=progress<.54?'尚未注入':progress<.67?'流入并扩散':progress<.90?'积聚与填充':progress<1?'停泵后逐渐凝固':'凝固示意完成';
    status('grout-state',groutLabel,progress>=.54?'active':'');
    text('metric-settlement', format(metrics.settlement));
    text('metric-strain', format(metrics.strain));
    text('metric-pressure', format(metrics.pressure));
    text('metric-flow', format(metrics.flow));
    const chartKey = JSON.stringify([progress, options.comparison !== false, metrics]);
    if (chartKey !== lastChartKey) { lastChartKey = chartKey; scheduleCharts(); }
  }

  function scheduleCharts() {
    if (!chartFrame) chartFrame = requestAnimationFrame(() => { chartFrame = 0; drawCharts(); });
  }

  function prepareSamples() {
    samples = [];
    stageStarts = Array(7).fill(null);
    for (let i = 0; i <= 400; i++) {
      const p = i / 400;
      const result = api.sample(p) || {};
      const metrics = result.metrics || result;
      samples.push({ p, ...metrics });
      if (Number.isFinite(result.stageIndex) && stageStarts[result.stageIndex] === null) stageStarts[result.stageIndex] = p;
    }
    stageStarts = stageStarts.map((value, i) => value === null ? i / 7 : value);
    chartDefinitions.forEach((definition) => {
      // 全程共用同一纵轴范围，切换对照时不会改变曲线的视觉尺度。
      let maxValue = 1;
      for (const point of samples) for (const series of definition.series) maxValue = Math.max(maxValue, finite(point[series.key]));
      definition.yMax = Math.ceil(maxValue * 10) / 10;
      definition.canvas = $(definition.id);
      definition.ctx = definition.canvas.getContext('2d');
      definition.primarySeries = definition.series.filter((series) => !series.comparison);
    });
  }

  function drawCharts() {
    if (!lastState || !samples.length) return;
    const progress = clamp(finite(lastState.progress), 0, 1);
    const comparison = (lastState.options || {}).comparison !== false;
    const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
    const visible = samples.slice(0, Math.floor(progress * 400) + 1);
    if (visible.length && visible[visible.length - 1].p < progress) visible.push({ p: progress, ...(lastState.metrics || {}) });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const needsMeasurement = measureCharts;
    measureCharts = false;
    chartDefinitions.forEach((definition) => {
      const canvas = definition.canvas;
      if (needsMeasurement || !definition.rect) definition.rect = canvas.getBoundingClientRect();
      const rect = definition.rect;
      if (rect.width < 1 || rect.height < 1) return;
      const width = rect.width, height = rect.height;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      }
      const ctx = definition.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const plot = { x: 26, y: 10, w: width - 34, h: height - 30 };
      const series = comparison ? definition.series : definition.primarySeries;
      const yMax = definition.yMax;
      const px = (p) => plot.x + p * plot.w;
      const py = (v) => plot.y + plot.h * (1 - clamp(finite(v) / yMax, 0, 1));
      ctx.font = '9px ' + font;
      ctx.textBaseline = 'middle';
      [0, .5, 1].forEach((ratio) => {
        const y = py(yMax * ratio);
        ctx.strokeStyle = '#edf0e8';ctx.lineWidth = 1;ctx.setLineDash([]);
        ctx.beginPath();ctx.moveTo(plot.x, y);ctx.lineTo(plot.x + plot.w, y);ctx.stroke();
        ctx.fillStyle = '#b0b8a7';ctx.textAlign = 'right';ctx.fillText((yMax * ratio).toFixed(1), plot.x - 7, y);
      });
      ctx.fillStyle = '#b0b8a7';ctx.textAlign = 'left';ctx.fillText('开始', plot.x, height - 7);
      ctx.textAlign = 'right';ctx.fillText('演示进程', plot.x + plot.w, height - 7);
      if (progress > 0 && progress < 1) {
        ctx.fillStyle = '#f6f9f1';ctx.fillRect(px(progress), plot.y, plot.w * (1 - progress), plot.h);
      }
      series.forEach((s) => {
        if (!visible.length) return;
        if (!s.dashed && definition.id === 'chart-settlement' && visible.length > 1) {
          const gradient = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);gradient.addColorStop(0, '#36917a18');gradient.addColorStop(1, '#36917a02');
          ctx.beginPath();ctx.moveTo(px(visible[0].p), py(0));visible.forEach((point) => ctx.lineTo(px(point.p), py(point[s.key])));ctx.lineTo(px(progress), py(0));ctx.closePath();ctx.fillStyle = gradient;ctx.fill();
        }
        ctx.beginPath();visible.forEach((point, index) => { if (!index) ctx.moveTo(px(point.p), py(point[s.key]));else ctx.lineTo(px(point.p), py(point[s.key])); });
        ctx.strokeStyle = s.color;ctx.lineWidth = s.dashed ? 1.65 : 1.9;ctx.lineJoin = 'round';ctx.lineCap = 'round';ctx.setLineDash(s.dashed ? [4, 4] : []);ctx.stroke();ctx.setLineDash([]);
        const last = visible[visible.length - 1];ctx.beginPath();ctx.arc(px(last.p), py(last[s.key]), 2.6, 0, Math.PI * 2);ctx.fillStyle = s.color;ctx.fill();
      });
      if (progress > .005 && progress < .995) {ctx.strokeStyle = '#b6c6b488';ctx.setLineDash([2, 3]);ctx.lineWidth = 1;ctx.beginPath();ctx.moveTo(px(progress), plot.y);ctx.lineTo(px(progress), plot.y + plot.h);ctx.stroke();ctx.setLineDash([]);}
    });
  }

  function initialize() {
    if (initialized || !window.mineDemo) return;
    initialized = true;api = window.mineDemo;
    $('scene-loading').hidden = true;
    prepareSamples();
    $('play-button').addEventListener('click', () => {
      const state = api.getState();
      if (state.progress >= 1 && !state.playing) { invoke('reset'); invoke('play'); }
      else invoke('togglePlay');
    });
    $('reset-button').addEventListener('click', () => invoke('reset'));
    $('previous-button').addEventListener('click', () => invoke('step', -1));
    $('next-button').addEventListener('click', () => {
      if (api.getState().stageIndex === 6) { invoke('pause'); invoke('setProgress', 1); }
      else invoke('step', 1);
    });
    $('progress-slider').addEventListener('input', (event) => invoke('setProgress', Number(event.target.value) / 1000));
    $('speed-select').addEventListener('change', (event) => invoke('setSpeed', Number(event.target.value)));
    qAll('[data-mode]').forEach((button) => button.addEventListener('click', () => invoke('setMode', button.dataset.mode)));
    qAll('[data-camera]').forEach((button) => button.addEventListener('click', () => invoke('setCamera', button.dataset.camera)));
    $('auto-camera').addEventListener('click', () => invoke('setOption', 'autoCamera', true));
    qAll('[data-option]').forEach((input) => input.addEventListener('change', () => invoke('setOption', input.dataset.option, input.checked)));
    qAll('[data-stage]').forEach((button) => button.addEventListener('click', () => { invoke('pause'); invoke('setProgress', Math.min(stageStarts[Number(button.dataset.stage)] + .001, 1)); }));
    const resizeCharts = () => { measureCharts = true; scheduleCharts(); };
    window.addEventListener('resize', resizeCharts);
    // 侧栏或布局宽度改变也可能改变图表尺寸，不一定触发窗口 resize。
    if (window.ResizeObserver) {
      const chartObserver = new ResizeObserver(resizeCharts);
      chartDefinitions.forEach((definition) => chartObserver.observe(definition.canvas));
    }
    document.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
      event.preventDefault();invoke('togglePlay');
    });
    sync(api.getState());
  }
  document.addEventListener('mine:update', (event) => { if (!initialized) initialize(); sync(event.detail); });
  document.addEventListener('mine:ready', initialize);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
