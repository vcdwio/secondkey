# Codex 任务书 — SecondKey 提交前收尾

仓库：`github.com/vcdwio/secondkey` · 本地：`~/Documents/Codex/projects/verge-contextops-unit-platform`
截止：**2026-08-31 17:00 PT**（阿德莱德 9 月 1 日 09:30）

---

## 0. 现状快照 — 这是事实，任何输出不得与之冲突

| 项 | 真实值 |
|---|---|
| 前端 | https://secondkey.vcdw-io.workers.dev （`/` 封面，`/app` 控制室） |
| Agent 服务 | https://secondkey-agent-689501174668.australia-southeast2.run.app |
| Cloud Run 区域 | `australia-southeast2`，公开访问（`allUsers` / `run.invoker`） |
| 模型 | `gemini-3.7-flash`，Vertex AI，ADC，location `global` |
| 会话状态 | `CONTEXTOPS_STATE_BACKEND=memory`（Vertex 持久层已接线未启用） |
| Agent Registry | 本地 10 个 Unit，`CONTEXTOPS_CLOUD_REGISTRY=false` |
| 遥测 | `CONTEXTOPS_TELEMETRY=gcp`，**但 Cloud Trace 里查不到 span —— 见 Task A** |
| 测试 | **84**：根 36（31 + 5 渲染）+ agent 48 |
| Agent 架构 | 三层舰队，工具集不相交，见 `agent/src/fleet.ts` |
| 可用端点 | `/status` `/fleet` `/registry` `/audit.json` `/audit.csv` POST `/triage` |
| 已知异常 | **`/healthz` 在 Cloud Run 上返回 404**，本地正常，同服务其他路由正常。原因未查明，已用 `/status` 绕开 |

---

## 1. 三条约束 — 任何改动都不得违反

1. **模型只做提取和起草，永不裁决。** 优先级、权限、金额、容量一律由 `lib/contextops/` 的确定性函数决定，模型只能通过 FunctionTool 取值。
2. **`external_write` 恒为 `false`。** 每条返回路径都要保持，且有测试断言。
3. **不写没验证过的话。** 文档里任何能力必须能被一条命令或一个测试证明；不能证明的，标注为"已接线、未验证"。

---

## Task A · 修 OpenTelemetry span 落不到 Cloud Trace（优先级最高）

### 问题

`agent/src/telemetry.ts` 的 `initializeTelemetry()` 在 `gcp` 模式下调用 `getGcpExporters({enableTracing:true})` 并注册 provider，`AuditStore.record()` 每条审计事件建一个 span。服务账号有 `roles/cloudtrace.agent` 和 `roles/telemetry.tracesWriter`。

**但 Cloud Trace 的 Trace Explorer 里 "No rows to display"。**

最可能的原因：Cloud Run min-instances = 0，请求结束后容器被回收，**批量 span 处理器还没把 span 推出去**。

### 要做的

在 `agent/src/server.ts` 的 `/triage` 返回响应之前（以及任何会产生 span 的端点之后），强制刷新一次 tracer provider。

技术路径（已验证 API 存在）：

```ts
import { trace } from "@opentelemetry/api";

// ProxyTracerProvider 本身没有 forceFlush，要拿它的 delegate
async function flushSpans(): Promise<void> {
  const provider = trace.getTracerProvider() as {
    getDelegate?: () => unknown;
    forceFlush?: () => Promise<void>;
  };
  const target = (typeof provider.getDelegate === "function"
    ? provider.getDelegate()
    : provider) as { forceFlush?: () => Promise<void> };
  if (typeof target.forceFlush === "function") await target.forceFlush();
}
```

**要求**：
- flush 失败不能让请求失败（包 try/catch，记录但不抛）
- flush 只在 `CONTEXTOPS_TELEMETRY=gcp` 时有意义，其他模式下是无害空操作
- 放在 `agent/src/telemetry.ts` 里导出，`server.ts` 调用

### 验收

1. 新增测试：`agent/tests/telemetry.test.ts` 断言 flush 函数在 provider 无 `forceFlush` 时不抛错
2. 部署后跑一次 `POST /triage`，**Cloud Trace Explorer（Last 1 hour）能看到 `contextops.audit.*` 的 span**
3. 如果部署后仍然看不到 span → **不要硬撑**。改走 Task B，把文档里的 OTel 表述降级为"已实现、单元测试覆盖，Cloud Run 缩容模型下未验证落库"，并在 `PITFALLS.md` 记录这次排查过程

---

## Task B · 文档与真实状态对齐

### B1 · 测试数字全部过期

以下文件里的测试数还是 **61 / 66 / 69**，最终真实是 **84（根 36 + agent 48）**：

- `PITCH_PREP.md` — 第 19 行配置卡、第 283、289、294、327、356 行
- `DEVPOST_SUBMISSION.md` — "Technologies used" 和 "Accomplishments" 两处
- `ARCHITECTURE_DIAGRAM.md` — core 子图标题
- `README.md`、`CHANGELOG.md`、`docs/hackathon-submission.md` 若有

**每改一处，先跑一次测试确认数字，不要照抄这份文档里的数。**

### B2 · 架构图还画着单 Agent

`ARCHITECTURE_DIAGRAM.md` 第 34 行：

```
RUN["ADK Runner<br/>one LlmAgent + SecurityPlugin"]
```

**已经不是了。** 现在是 `secondkey_fleet`（SequentialAgent）+ 三个 `LlmAgent`，工具集不相交。两张 mermaid 图都要重画，要画出：

- 三层的名字、各自的工具集、`humanGate` 值
- 两道独立的强制机制：构造边界（工具集 + `allowedFunctionNames`）和策略层（`ContextOpsPolicyEngine`）
- DENY 和 CONFIRM 的区别（前者无人可授权，后者等有权限的人点头）

### B3 · 新增的东西没写进文档

- 封面页（`/` 与 `/app` 的分工）
- `/fleet` 端点 —— **这是评委可以自己 curl 验证多 Agent 的入口，应该在 README 显著位置**
- `/status`（以及 `/healthz` 在 Cloud Run 上 404 这个已知异常）
- `lib/contextops/execution.ts` 的拆分原因
- `evidence/live-triage-cloudrun.json`

### B4 · README 要能让评委三分钟跑通

顶部加一段"Verify it yourself"，三条命令：

```bash
curl -s https://secondkey-agent-689501174668.australia-southeast2.run.app/status
curl -s https://secondkey-agent-689501174668.australia-southeast2.run.app/fleet
curl -sX POST https://secondkey-agent-689501174668.australia-southeast2.run.app/triage \
  -H "Content-Type: application/json" -d '{"email_ids":["EM-001","EM-023"]}'
```

第三条的输出要在 README 里贴出来并加注解：`args` 是模型提取的，`result` 是确定性工具返回的，EM-023 的 `tool_call` 是 `null`（注入邮件根本没走到工具）。

---

## Task C · 赛道符合度自查

赛道：**The Fortified Enterprise Fleet**。逐条核对，**给出结论 + 证据（文件路径或命令），不要给意见**。

### C1 · 三条强制要求

| # | 要求 | 要你验证什么 |
|---|---|---|
| 1 | Gemini 3.5+ 经 Gemini API 或 Vertex | 线上确实用 3.7 Flash 走 Vertex，不是本地 key |
| 2 | 至少一个 Google Agent 框架 | `@google/adk` 的哪些 API 真的在运行路径上（不是只 import 了） |
| 3 | 至少一个 GCP 基础设施服务 | Cloud Run 在跑且公网可达 |

### C2 · 赛道点名的七项能力，逐条给状态

`Agent Registry` / `Agent Runtime` / `Memory Bank` / `Agent Identity` / `Agent Gateway` / `Model Armor` / `Agent Observability`

每一项给：**已实现 / 已接线未启用 / 未实现**，加一句证据。**未实现的不要粉饰**——上线清单里明确写出来反而是加分项。

### C3 · 提交规则

- 视频 ≤ 4 分钟，须含"未经剪辑的实时执行"和"Google Cloud 部署可视证明"
- 须披露预先存在的代码/工作：**ContextOps 确定性核心和虚构数据包早于本次黑客松**，git 历史是 8 月 23 日重建的，看不出来 —— 确认 `DEVPOST_SUBMISSION.md` 里有这句披露
- 数据源须披露：虚构数据包，`.example` 域名

---

## Task D · 安全与漏洞排查

**这一项不要走过场，逐条给结论。**

### D1 · 密钥

```bash
git log --all -p | grep -iE "AIza|sk-|BEGIN (RSA|PRIVATE)|api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{20,}" | head
```

仓库是 public。确认 **git 历史里任何一个 commit** 都没有过 key，不只是当前 HEAD。`agent/.env` 必须未跟踪且被 ignore。

### D2 · 三条约束的实际强度

- `external_write` 有没有任何一条路径能变成 true？（搜全仓库）
- 模型有没有任何路径能绕过工具直接给出优先级/权限？
- `draft_agent` 有没有可能拿到写工具？（`agent/src/fleet.ts` + `agent/src/tools.ts`）
- `commit_internal_change` 的 `externalCommunications` 是写死 0 的，确认它**不在参数 schema 里**，任何输入都无法把它改成非 0

### D3 · 公网暴露面

服务现在对 `allUsers` 开放。逐个端点评估：

- `POST /triage` 会触发**真实的 Vertex 调用**，也就是**真实费用**。有没有速率限制？没有的话，一个循环脚本能刷掉多少额度？→ **给出建议方案**（Cloud Run max-instances 已是 1，评估这是否足够，以及是否要加 `--max-instances` 之外的保护）
- `/audit.json` `/audit.csv` 会不会泄露什么？（现在是虚构数据，但确认逻辑上没有真实数据路径）
- CORS：`CONTEXTOPS_UI_ORIGIN` 未设置时的行为是什么？前端在 `secondkey.vcdw-io.workers.dev`，agent 在 run.app，跨源。**确认前端调 agent 时会不会被 CORS 挡住**——如果会，要么设这个环境变量，要么明确说明前端不依赖 agent

### D4 · 依赖

```bash
npm audit --omit=dev && (cd agent && npm audit --omit=dev)
```

高危及以上的给出评估。**不要为了清零而升级大版本**，五天内改依赖是净风险。

### D5 · 干净克隆能跑

```bash
cd /tmp && rm -rf skverify && git clone https://github.com/vcdwio/secondkey.git skverify && cd skverify
npm ci && npm run lint && npm test
cd agent && npm ci && npm test
```

**评委会这么做。** 任何一步失败都是 P0。

---

## Task E · 最终验证与部署

按顺序，每步失败就停：

```bash
npm run lint                    # 0 错误
npm test                        # 36 通过
cd agent && npm test && cd ..   # 46 通过
npm run build                   # 成功
```

部署：

```bash
# 前端
npm run build && npx wrangler deploy --config dist/server/wrangler.json

# Agent（Cloud Shell）
cd ~/secondkey && git pull && gcloud run deploy secondkey-agent \
  --source . --region australia-southeast2 \
  --service-account secondkey-runner@secondkey-hackathon.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=secondkey-hackathon,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.7-flash,CONTEXTOPS_STATE_BACKEND=memory,CONTEXTOPS_TELEMETRY=gcp
```

部署后线上验证：

```bash
curl -s .../status | grep -q '"model_backend":"vertex"'   # 通过
curl -s .../fleet | grep -q 'external_commitment_agent'   # 通过
curl -sX POST .../triage -H "Content-Type: application/json" \
  -d '{"email_ids":["EM-001","EM-023"]}'                  # 两条结果，EM-023 quarantine
```

前端 `https://secondkey.vcdw-io.workers.dev/app` 打开，点导航能换视图，点 Run Monday scenario 有反应。

---

## 交付格式

改完之后给一份报告，四段：

1. **Task A 结果** — Cloud Trace 里有没有 span。有就贴 span 名字；没有就说清楚试了什么、以及文档改成了什么措辞
2. **Task C 逐条结论** — 七项能力的状态表 + 三条强制要求的证据
3. **Task D 逐条结论** — 特别是 D3 的费用暴露评估和 D5 的干净克隆结果
4. **你发现但这份任务书没提到的问题** — 这一段最重要，不要空着

**commit 前跑完 Task E 的全部四条。** 推到 main，报告最终 commit hash。
