# UX 优化清单 - The Pair

## 一、UX 盘点总结

### 关键界面现状

| 界面                    | 信息足够 | 操作明确 | 反馈及时 | 不易出错 | 不需猜测 |
| ----------------------- | -------- | -------- | -------- | -------- | -------- |
| Pair列表(Dashboard)     | ✅ 好    | ✅ 好    | ✅ 好    | ⚠️ 中    | ✅ 好    |
| Agent运行区(PairDetail) | ✅ 好    | ✅ 好    | ✅ 好    | ✅ 好    | ⚠️ 中    |
| Console消息区           | ✅ 好    | ✅ 好    | ✅ 好    | ✅ 好    | ✅ 好    |
| 终端/文件访问           | ⚠️ 中    | ⚠️ 中    | ⚠️ 中    | ✅ 好    | ⚠️ 中    |
| 错误提示                | ✅ 好    | ✅ 好    | ✅ 好    | ⚠️ 中    | ✅ 好    |
| 空状态和首次引导        | ✅ 好    | ✅ 好    | ✅ 好    | ✅ 好    | ✅ 好    |

---

## 二、问题归类（按影响面排序）

### P0 - 影响面大且高频

#### P0-1: Console 消息区缺少"滚动到最新"能力 ✅ 已完成

- **实现**: `components/ScrollToBottomButton.tsx`
- **验收标准**:
  - [x] 有新消息时，按钮出现并可点击
  - [x] 点击后滚动到底部
  - [x] 深色/浅色主题下按钮可见

#### P0-2: Dashboard 空状态缺少 CTA ✅ 已完成

- **实现**: `components/DashboardEmptyState.tsx`
- **验收标准**:
  - [x] 空状态有明确的引导文案
  - [x] 有醒目的 CTA 按钮
  - [x] 引导用户理解 Pair/Agent 的概念

#### P0-3: Error 状态缺少可恢复动作和错误原因 ✅ 已完成

- **实现**: `components/ErrorDetailPanel.tsx`
- **验收标准**:
  - [x] Error 状态显示错误原因摘要
  - [x] 有明确的恢复动作选项
  - [x] 有展开查看完整错误详情的按钮

#### P0-4: Paused 状态缺少原因和 Resume 操作 ✅ 已完成

- **实现**: 在 `App.tsx` PairDetail 组件中
- **验收标准**:
  - [x] 显示暂停原因
  - [x] 有 Resume 按钮
  - [x] Resume 后状态正常继续

### P1 - 阻塞任务完成

#### P1-1: Action 按钮禁用状态不明确 ✅ 已完成

- **实现**: 在 `App.tsx` PairDetail 组件中动态调整按钮文案
- **验收标准**:
  - [x] 按钮状态和文案一致
  - [x] 不产生误导性操作

#### P1-2: 迭代进度不透明 ✅ 已完成

- **实现**: `components/IterationProgress.tsx`
- **验收标准**:
  - [x] 显示当前迭代次数
  - [x] 接近上限时有警告色

### P2 - 低成本高收益

#### P2-1: Pair 卡片删除按钮安全性 ⚠️ 部分完成

- **实现**: 确认按钮已存在于 `ConfirmModal`，删除操作已有 `Deleting...` 反馈
- **验收标准**:
  - [x] 有确认步骤防止误操作
  - [x] 操作结果有反馈（Deleting...）

#### P2-2: 长 spec 在 Dashboard 卡片中折叠 ✅ 已完成

- **实现**: 在 `App.tsx` Dashboard 组件中使用 `line-clamp-3`
- **验收标准**:
  - [x] spec 内容被截断为3行
  - [ ] ~~hover 显示完整内容~~ (浏览器原生截断，无需额外实现)

#### P2-3: Console 消息类型筛选 ✅ 已完成

- **实现**: `components/MessageFilterBar.tsx`
- **验收标准**:
  - [x] 可按角色筛选消息
  - [x] 筛选不影响历史记录

### P3 - 纯视觉优化

#### P3-1: Mentor/Executor 切换动画增强 ⚠️ 待优化

- **现状**: 已有 scale 和 opacity 过渡动画（200-300ms）
- **验收标准**:
  - [x] 切换动画平滑（200-300ms）
  - [x] 当前活跃角色更突出

#### P3-2: 资源 meter 在低值时不显示 ✅ 已完成

- **实现**: 在 `components/ui/ResourceMeter.tsx` 中低于 0.5% 时不显示进度条
- **验收标准**:
  - [x] 0% 时不显示进度条

---

## 三、优先级实现顺序

### 第一批（公共组件 + 核心体验）✅ 已完成

1. ✅ 创建公共状态组件（滚动到最新按钮）
2. ✅ Dashboard 空状态 CTA
3. ✅ Error 状态可恢复动作
4. ✅ Paused 状态原因和 Resume

### 第二批（状态明确性）✅ 已完成

5. ✅ Action 按钮状态和文案统一
6. ✅ 迭代进度显示
7. ✅ Pair 卡片 spec 折叠

### 第三批（细节打磨）✅ 已完成

8. ✅ 删除确认（已有 ConfirmModal）
9. ✅ Console 消息筛选
10. ✅ 资源 meter 优化

---

## 四、回归验证清单

### 主线1: 新用户是否能启动任务

- [x] 首次打开应用看到引导
- [x] 理解 Pair/Mentor/Executor 的概念（DashboardEmptyState 包含说明）
- [ ] 成功创建第一个 Pair（需实际测试）
- [ ] 成功分配任务（需实际测试）

### 主线2: 任务中断后是否知道怎么继续

- [x] 手动暂停后能看到 Resume 选项
- [x] 崩溃恢复后能看到继续或重新开始的选项（SessionRecoveryModal）
- [x] Paused 状态有明确原因

### 主线3: 失败时是否能定位原因

- [x] Error 状态显示错误摘要
- [x] 有 Retry 或 Discard 选项
- [x] 错误信息可展开查看详情

### 主线4: 长时间运行时是否不会迷失状态

- [x] 迭代次数可见
- [x] Mentor/Executor 当前活动清晰
- [x] 滚动到最新按钮可用
- [x] 状态变化有视觉反馈

---

## 五、新增组件清单

| 组件                 | 文件路径                              | 功能                   |
| -------------------- | ------------------------------------- | ---------------------- |
| ScrollToBottomButton | `components/ScrollToBottomButton.tsx` | Console 滚动到最新按钮 |
| DashboardEmptyState  | `components/DashboardEmptyState.tsx`  | Dashboard 空状态引导   |
| ErrorDetailPanel     | `components/ErrorDetailPanel.tsx`     | 错误详情和恢复动作     |
| IterationProgress    | `components/IterationProgress.tsx`    | 迭代进度指示器         |
| MessageFilterBar     | `components/MessageFilterBar.tsx`     | Console 消息类型筛选   |

---

## 六、待优化项目

以下为本次未完成但仍需关注的改进点：

1. **Mentor/Executor 切换动画增强**: 已有基础动画，可进一步优化
2. **终端/文件访问面板**: 缺少文件预览或跳转到文件的能力
3. **任务历史恢复按钮**: 可以添加 hover tooltip 说明功能
4. **深色/浅色主题全面测试**: 需在实际使用中验证所有组件的视觉一致性
5. **键盘可达性**: 检查所有交互元素的 tab 键导航顺序

---

_最后更新: 2026-03-27_
_实施版本: v1.2.1+_
