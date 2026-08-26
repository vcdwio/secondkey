# SecondKey — 赛道符合度差距表

对照 `857c8c9`。截止 **2026-08-31 17:00 PT**（阿德莱德 9 月 1 日 09:30）。

---

## 一、三条强制要求（所有赛道）

| # | 要求 | 状态 |
|---|---|---|
| 1 | Gemini 3.5 或更新，走 Gemini API 或 Vertex AI | ✅ `gemini-3.7-flash` / Vertex ADC / `global` |
| 2 | 至少一个 Google Agent 框架 | ✅ `@google/adk` v2 |
| 3 | 至少一个 Google Cloud 基础设施服务 | ⚠️ Cloud Run 已部署且 Ready，**但公网不可达**（见下） |

**强制项没有硬伤。** 下面全部是赛道加分项，不是准入门槛。

---

## 二、Fortified Enterprise Fleet 赛道逐条

赛道原文：*"a scalable network of institutional agents… how agents are cataloged for
cross-department use, how they safely maintain context across weeks of asynchronous
operations, and how they interact with production data without violating enterprise
compliance, data sovereignty, or security policies."*

| 赛道点名的能力 | 当前状态 | 差距 | 8 天内可行？ |
|---|---|---|---|
| **多 Agent 网络** | ❌ `adk.ts` 里是**一个 `LlmAgent` + 一个 `FunctionTool`** | 赛道名字里就有 "Fleet"。这是最大的不符 | ✅ 有设计，重建 Sequential/Coordinator 图 |
| **Agent Registry**（发布/版本/发现） | ⚠️ 10 个 Unit 有版本和契约，但**本地服务**，`CONTEXTOPS_CLOUD_REGISTRY=false` | 不是 GCP 的 Agent Registry | ⚠️ 取决于产品可用性 |
| **Agent Runtime**（长时异步后台执行） | ⚠️ 有 `LongRunningFunctionTool` 和可恢复中断点 | 没有真的跑过一次"等三天再继续" | ✅ 可演示一次跨进程恢复 |
| **Memory Bank**（跨会话持久上下文） | ❌ `CONTEXTOPS_STATE_BACKEND=memory`；Vertex 已接线但关闭 | 赛道点名 "across weeks"，我们现在**演示不了** | ✅ 开 Agent Engine + 改一个环境变量 |
| **Agent Identity**（零信任） | ❌ 角色来自数据包，应用层身份 | 没接 GCP Agent Identity | ❌ 8 天内不现实，写进清单 |
| **Agent Gateway**（统一路由与策略） | ❌ 无 | 完全缺失 | ❌ 写进清单 |
| **Model Armor**（注入/工具投毒/PII 内联护栏） | ❌ 无 | 我们**自己写了**注入隔离，但不是 Model Armor | ⚠️ 值得试，成本未知 |
| **Agent Observability**（OTel 审计与推理链） | ⚠️ OTel span 有，`CONTEXTOPS_TELEMETRY=gcp` 已配 | 缺线上证据 | ✅ 部署通了就有 |

---

## 三、按「每小时收益」排序的行动清单

### P0 — 今天，5 分钟

**Cloud Run 公网 404 的真正原因：Security 标签页选的是 "Require authentication"。**

IAM 要求鉴权时，Cloud Run 对未授权请求返回 **404 而不是 403**（Google 故意不暴露服务是否存在）。
请求在 Google 前置层就被拒了，所以**容器里看不到任何日志**——和排错文档描述的"平台路由问题"症状完全一样，
但原因不是平台，是一个单选按钮。

> 这也解释了为什么 `gcloud auth print-identity-token` 也不行：那个 token 的 audience
> 不是服务 URL，Cloud Run 仍然拒。

**不需要新建项目，不需要额外花钱。**

### P1 — 多 Agent（赛道名字里那个词）

把 `adk.ts` 的单 agent 重建成协调者 + 专业子 Agent：

- `contextops_coordinator`（`SequentialAgent` 或带 `subAgents` 的 `LlmAgent`）
- `intake_triage` — 脏邮件 → 结构化请求
- `evidence_analyst` — Context Packet + 确定性裁决
- `output_composer` — 起草 + 受管控的执行调用（只有它能碰 `commit_changes`）

**约束不变**：模型只提取和起草，绝不裁定优先级/权限/容量；`external_write` 恒为 `false`。

### P2 — 打开 Memory Bank

赛道原文有 "across weeks of asynchronous operations"。我们代码已经接好了，
只差一个 Agent Engine 实例和 `CONTEXTOPS_STATE_BACKEND=vertex`。
打开之后**必须真的验证一次跨进程恢复**，否则仍然只能说"已接线"。

### P3 — 试 Model Armor

时间够就做，不够就写进「还没做」清单。

### 明确不做

Agent Identity、Agent Gateway。8 天内做不出可信的版本，
**写进产品里的上线清单**比做个空壳强。

---

## 四、一条流程建议

Codex 主张「先改完多 Agent 代码再部署，避免部署两遍」。**不同意。**

Cloud Run 部署本身不收费（收的是请求 CPU 和构建分钟，都在免费额度内），
**部署两遍的代价接近零**。而先部署的收益是：现在就发现了那个 404，
而不是 8 月 30 号晚上才发现。

**早部署、多部署。** 每次代码改完就推一次，让线上和仓库一直是同一个东西。
