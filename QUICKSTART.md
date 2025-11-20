# 🚀 快速启动指南

## 安装与运行

### 1️⃣ 安装依赖

```bash
npm install
```

这将安装以下核心依赖：
- `three` - Three.js WebGL 渲染引擎
- `lil-gui` - 参数调试面板
- `typescript` - TypeScript 编译器
- `vite` - 开发服务器和构建工具

### 2️⃣ 启动开发服务器

```bash
npm run dev
```

浏览器将自动打开 `http://localhost:3000`，您将看到：
- 欢迎页面（点击"开始探索"进入）
- 1000 个无人机在城市上空飞行
- 右侧参数控制面板
- 右上角性能监控面板

### 3️⃣ 开始探索

#### 🎮 基础操作
- **鼠标左键拖拽** - 旋转视角
- **滚轮** - 缩放距离
- **拖拽参数面板** - 调整参数

#### 🎨 快速体验预设

在右侧面板的"预设方案"文件夹中：
1. **🕊️ 平静飞行** - 观察平稳的群体行为
2. **🌪️ 混乱模式** - 体验高速混乱的飞行
3. **🎯 紧密编队** - 看无人机如何保持紧密队形
4. **🔍 探索模式** - 观察随机探索行为

#### 🔧 参数调整技巧

**新手推荐调整顺序：**

1. **无人机数量** (群体参数)
   - 100 - 超流畅，适合细节观察
   - 1000 - 推荐默认值
   - 2000+ - 壮观但可能掉帧

2. **行为权重** (核心参数)
   - 先调整一个参数，观察效果
   - `separationWeight`: 控制间距
   - `cohesionWeight`: 控制聚集程度
   - `alignmentWeight`: 控制方向一致性

3. **运动参数**
   - `maxSpeed`: 速度越快越激进
   - `maxForce`: 转向灵敏度

## 🎯 使用场景示例

### 场景 1：紧密编队
```
separationWeight: 2.0
alignmentWeight: 2.0
cohesionWeight: 2.5
separationDistance: 15
maxSpeed: 2.5
wanderWeight: 0.0
```

**效果**：无人机保持紧密队形，适合模拟军事编队

### 场景 2：自然飞行（鸟群）
```
separationWeight: 1.0
alignmentWeight: 1.5
cohesionWeight: 1.0
maxSpeed: 3.0
wanderWeight: 0.05
```

**效果**：自然流畅，类似真实鸟群

### 场景 3：搜索模式
```
separationWeight: 1.0
alignmentWeight: 0.8
cohesionWeight: 0.5
maxSpeed: 5.0
wanderWeight: 0.8
```

**效果**：无人机分散探索，适合搜救场景

### 场景 4：目标聚集
```
启用目标点: true
目标坐标: (0, 250, 0)
targetWeight: 1.5
cohesionWeight: 1.5
```

**效果**：所有无人机飞向指定位置

## 📊 性能优化建议

### 如果遇到卡顿：

1. **降低无人机数量** → 500 或更少
2. **调整空间网格大小** → 增大到 80-100
3. **限制最大邻居数** → 减少到 30
4. **关闭阴影** - 修改 `Scene.ts` 中的 `shadowMap.enabled = false`

### 获得最佳性能：

```typescript
// src/Scene.ts
this.renderer.shadowMap.enabled = false; // 关闭阴影
this.renderer.setPixelRatio(1); // 降低像素比
```

## 💾 保存与加载配置

### 保存当前配置
1. 调整参数到满意状态
2. 点击 "💾 导出配置"
3. 文件自动下载为 `boid-config-[时间戳].json`

### 加载已保存配置
1. 点击 "📂 导入配置"
2. 选择之前导出的 JSON 文件
3. 参数自动恢复

## 🛠️ 高级功能

### 修改无人机外观

编辑 `src/Scene.ts` 的 `createBoidMesh()` 方法：

```typescript
// 修改颜色
const material = new THREE.MeshStandardMaterial({
  color: 0x00ff00, // 改为绿色
  emissive: 0x003300,
  // ...
});
```

### 修改城市环境

编辑 `src/Scene.ts` 的 `createBuildings()` 方法：

```typescript
// 增加建筑数量
const buildingCount = 100; // 原来是 50

// 调整建筑高度范围
const height = 100 + Math.random() * 400; // 更高的建筑
```

### 添加自定义行为

在 `src/Boid.ts` 中添加新方法：

```typescript
private customBehavior(config: BoidConfig): Vector3 {
  // 您的自定义逻辑
  return new Vector3();
}

// 在 calculateForces() 中调用
const custom = this.customBehavior(config).multiplyScalar(customWeight);
this.applyForce(custom, config);
```

## 📝 常见问题

### Q: 为什么无人机飞出边界了？

**A**: 检查边界设置：
- `boundaryType` 设为 `soft`
- `boundaryForce` 增大到 1.0+
- `boundaryMargin` 设为 50-100

### Q: 无人机聚成一团不动？

**A**: 增强运动性：
- 增加 `wanderWeight` 到 0.5+
- 增加 `maxSpeed` 到 5.0+
- 降低 `cohesionWeight`

### Q: 无人机太分散？

**A**: 增强聚集性：
- 增加 `cohesionWeight` 到 2.0+
- 增加 `cohesionDistance` 到 100+
- 降低 `separationWeight`

### Q: FPS 很低？

**A**: 性能优化：
1. 减少无人机数量到 500
2. 增大 `spatialHashCellSize` 到 80
3. 减少 `maxNeighbors` 到 30
4. 关闭阴影渲染

## 🎓 深入学习

### 推荐阅读
- [Boid算法原理](http://www.red3d.com/cwr/boids/) - Craig Reynolds 原始论文
- [Three.js 文档](https://threejs.org/docs/) - 学习 3D 渲染
- [群体智能](https://en.wikipedia.org/wiki/Swarm_intelligence) - 理论背景

### 扩展方向
1. **添加障碍物** - 实现避障算法
2. **路径规划** - 整合 A* 算法
3. **多物种** - 捕食者-猎物系统
4. **数据分析** - 导出轨迹数据

## 🆘 获取帮助

- **查看代码** - 所有源码都有详细注释
- **性能面板** - 右上角实时监控
- **浏览器控制台** - 查看错误信息

---

**祝您探索愉快！🎉**

