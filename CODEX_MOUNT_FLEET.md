# Codex 任务 — 验证并上线舰队生产端点

前置：仓库 `main` 在 `9b6997d`。已有四个文件被覆盖（不是你写的，是外部提供的）：

```
agent/src/fleet.ts          新增 createFleetRuntime() 和 run()
agent/src/server.ts         新增 POST /fleet/run；引入 buildGeminiModel 和 AUTHORITY_MATRIX
agent/src/adk.ts            抽出 buildGeminiModel()，triage 与 fleet 共用
agent/tests/fleet.test.ts   新增 2 个测试（端点已挂载、未知角色 400）
```

---

## 背景：这一改在补什么

你在上一轮审计里报告的第一条：

> 生产 `/triage` 没有运行三层舰队，`createFleet()` 目前只由测试引用。

**你是对的。** `GET /fleet` 只返回"三层被允许做什么"的元数据，没有任何生产路径真的运行过协调器。赛道评分明确检查 *intelligent delegation to specialist sub-agents*，元数据不算证据。

新端点 `POST /fleet/run` 通过 ADK Runner 真实运行 `secondkey_fleet`（SequentialAgent），从事件流里按 `event.author` 归集每个 agent 实际调用了哪些工具，返回 `delegation` 数组。

**关键性质**：`delegation` 里 agent 名字旁边不可能出现它那一层没有的工具——因为工具集在构造时就是不相交的。这就是 live delegation 的证据。

---

## 三条不可违反的约束（沿用）

1. 模型只做提取和起草，永不裁决优先级／权限／金额／容量
2. `external_write` 恒为 `false`
3. 不写没验证过的话

---

## 要做的

### 1 · 静态验证

```bash
npm run lint                    # 0 错误
npm test                        # 根 36 通过
cd agent && npm test && cd ..   # agent 50 通过
npx tsc --noEmit -p agent/tsconfig.json
```

数字对不上就先停下报告，不要自己改测试去凑。

### 2 · 本地真实 LLM 验证（这一步只有你能做，外部协作方没有 key）

用 `agent/.env` 里的 Gemini key 起本地服务，然后：

```bash
curl -sX POST http://localhost:3001/fleet/run \
  -H "Content-Type: application/json" \
  -d '{"account_id":"CL-BH","role":"Delivery Manager"}' | jq .
```

**验收标准**：

- `delegation` 数组里出现 **三个** agent：`draft_agent`、`internal_commit_agent`、`external_commitment_agent`
- 每个 agent 的 `tools` **只包含它那一层的工具**：
  - `draft_agent` → 只能有 `list_queue`、`build_context_packet`
  - `internal_commit_agent` → 只能有 `list_queue`、`commit_internal_change`、`rollback_changes`
  - `external_commitment_agent` → 只能有 `list_queue`、`release_external_commitment`
- `external_write` 为 `false`
- 任何一个 agent 旁边出现了不属于它那层的工具 → **这是严重问题，立刻停下报告**

### 3 · 如果模型没走完三层

允许你调整 `agent/src/fleet.ts` 里三个 agent 的 `instruction` 文本，让它们更明确地各自完成本层工作。

**不允许**改动：
- 三个工具数组的划分（`DRAFT_TOOLS` / `INTERNAL_TOOLS` / `EXTERNAL_TOOLS`）
- `allowedFunctionNames` 的构造方式
- `ContextOpsPolicyEngine` 的任何判定逻辑
- `commit_internal_change` 里写死的 `externalCommunications: 0`

调 instruction 之后重跑第 2 步。

### 4 · 兜底（重要）

**如果两轮调整后仍然跑不通三层，不要硬撑。**

- 保留 `POST /fleet/run`（它多存在一个端点没有风险，503/400 分支已有测试）
- 在 `README.md` 和 `DEVPOST_SUBMISSION.md` 里如实写明当前状态
- 报告里说清楚失败在哪一步、模型的实际行为是什么

**已经跑通的 `/triage` 不要动。** 它是好的，是视频的主证据。

### 5 · 部署与线上验证

```bash
git add -A && git commit -m "feat: mount the agent fleet on a production endpoint" && git push
```

Cloud Shell：

```bash
cd ~/secondkey && git pull && gcloud run deploy secondkey-agent \
  --source . --region australia-southeast2 \
  --service-account secondkey-runner@secondkey-hackathon.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=secondkey-hackathon,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.7-flash,CONTEXTOPS_STATE_BACKEND=memory,CONTEXTOPS_TELEMETRY=gcp
```

线上再验一次：

```bash
curl -sX POST https://secondkey-agent-689501174668.australia-southeast2.run.app/fleet/run \
  -H "Content-Type: application/json" \
  -d '{"account_id":"CL-BH","role":"Delivery Manager"}'
```

**注意速率限制**：你上一轮加了全局 10 请求/10 分钟。确认 `/fleet/run` 也在限流覆盖内——如果没有，加进去；如果限流会挡住录屏时的连续演示，**把窗口调宽到够录一遍**（例如 30 请求/10 分钟），并在 README 注明。

### 6 · 文档同步

- `README.md` 的 "Verify it yourself" 加上 `/fleet/run` 这条命令和它的输出
- `ARCHITECTURE_DIAGRAM.md` 把"已构建未挂载舰队"改成实际状态
- 测试数从 84 更新为实测值
- `evidence/` 下存一份线上 `/fleet/run` 的脱敏返回

---

## 报告格式

1. **第 2 步的完整 `delegation` 数组**（原样贴出）
2. 是否调过 instruction，调了什么
3. 线上 `/fleet/run` 的返回
4. 限流窗口的最终设置
5. **你发现但这份任务书没提到的问题**

跑完第 1 步的四条检查再 commit。报告最终 commit hash。
