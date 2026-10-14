# 基于多智能体协同的高效换产管理系统

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node](https://img.shields.io/badge/Node-%3E%3D22.5.0-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/status-production%20ready-10b981)

面向离散制造混线生产场景，构建基于多智能体（Multi-Agent）协同的换产管理系统，实现换产全生命周期的智能化感知、自主决策与高效协同。当前为**生产可用版本（V2.0）**。

## 核心指标（仿真验证，可复现）

| 指标 | 上线前水平 | 运营目标 | 当前达成 |
| --- | --- | --- | --- |
| 换产时间 | 30 分钟 | 15-18 分钟 | 16.6 分钟 |
| OEE | 65%-70% | ≥80% | 82.0% |
| 人员效率 | 人均及时率 100% | 人数减少 20% | 10 → 8 人（-20%） |
| 首件检验合格率 | — | 稳定一致性 | 98.4% |

## 生产级能力

- **数据持久化**：基于 Node 内置 SQLite（`node:sqlite`），数据集与导入数据持久化，服务重启不丢失；首次启动自动播种。
- **真实数据导入**：支持 CSV / JSON 导入产品 BOM、物料、设备、人员、换产工单；逐行校验并返回错误明细，写入导入批次与审计日志；导入工单自动生成换产事件。
- **实时推送**：SSE 实时推送产线状态、智能体状态、换产进度与异常告警。
- **工程化与运维**：环境配置化、结构化 JSON 日志、统一错误处理、请求参数校验（zod）、接口限流、安全响应头、请求 ID 追踪、健康/就绪检查、优雅关闭。
- **自动化测试**：调度引擎单测、数据规模与指标回归、导入解析测试、API 集成测试，共 27 项。
- **容器化部署**：多阶段 Dockerfile + docker-compose，数据卷持久化，内置健康检查。

## 技术栈

- 前端：React 18 + TypeScript + Vite（自研 SVG 图表，无重型依赖）
- 后端：Node.js 22 + Express + TypeScript（协同引擎 + REST + SSE）
- 存储：SQLite（Node 内置，零原生依赖）
- 数据：真实 PCBA BOM 数据 + 受控随机仿真

## 快速开始

安装依赖：

```bash
npm run install:all
```

开发模式（前端 5173，后端 3001，Vite 代理 /api 到后端）：

```bash
npm run dev
```

生产构建与启动（单端口 3001，后端托管前端静态资源）：

```bash
npm run build
npm start
```

启动后访问 http://localhost:3001 打开系统首页。

自动化测试：

```bash
npm test
```

类型检查：

```bash
npm run typecheck
```

## Docker 部署

```bash
docker compose up -d --build
```

默认映射 3001 端口，数据持久化在命名卷 `changeover-data`。配置项见 `.env.example`。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | 3001 | 服务端口 |
| `DATA_DIR` | `./server/data` | 数据持久化目录 |
| `DB_FILE` | `changeover.db` | SQLite 文件名 |
| `SEED_ON_EMPTY` | true | 空库时自动生成仿真数据 |
| `SEED` | 20261002 | 仿真随机种子（固定可复现） |
| `LOG_LEVEL` | info | 日志级别 |
| `RATE_LIMIT_MAX` | 600 | 限流窗口内最大请求数 |
| `ENABLE_LIVE_SIMULATOR` | true | 是否启用实时状态推送 |
| `CORS_ORIGIN` | `*` | 允许的跨域来源 |

## 目录结构

```
server/                后端协同引擎与服务
  src/domain/          领域模型
  src/engine/          调度算法、智能体、仿真、导入解析
  src/store/           SQLite 持久化与仓储
  src/runtime/         启动播种、实时推送、运行时状态
  src/routes/          REST / 导入 / SSE 接口
  src/lib/             配置、日志、错误、校验、中间件、事件总线
  test/                自动化测试
  data/                SQLite 数据目录（运行时生成）
web/                   前端可视化驾驶舱
  src/pages/           七大功能页面
  src/components/      图表、甘特图、智能体、实时面板
docs/                  项目方案书与技术报告
Dockerfile             多阶段生产镜像
docker-compose.yml     容器编排 + 数据卷
```

## 主要接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/health` `/api/ready` | GET | 健康 / 就绪检查 |
| `/api/overview` | GET | 关键指标总览 |
| `/api/compare` | GET | 传统模式与协同模式对比 |
| `/api/agents` | GET | 智能体实时状态 |
| `/api/events` | GET | 换产事件列表（分页 `limit`/`offset`） |
| `/api/events/:id` | GET | 事件详情（消息/时序/偏差） |
| `/api/learning` | GET | 自学习记录 |
| `/api/stream` | GET | SSE 实时事件流 |
| `/api/simulate` | POST | 运行一次带异常注入的换产仿真 |
| `/api/regenerate` | POST | 按随机种子重新生成数据集 |
| `/api/import/:kind` | POST | 导入产品/物料/设备/人员/工单 |
| `/api/import/:kind/template` | GET | 下载导入 CSV 模板 |
| `/api/imports` | GET | 导入批次记录 |
| `/api/audit` | GET | 审计日志 |

## English Summary

**Multi-Agent Changeover OS** — a production-grade, multi-agent collaboration platform for changeover management on discrete PCBA production lines.

- 6 specialized agents (Scheduling / Equipment / Material / Tooling / Quality / Employee) collaborate via a shared blackboard.
- DAG-based scheduling with resource-constrained optimization and dynamic re-planning on exceptions.
- Self-learning loop that tunes pre-load ratio, parallel threshold, operator flexibility, etc., from historical records.
- Single-port deploy (port `3001`), Node.js 22 + built-in `node:sqlite`, Docker-ready, no native dependencies.

See `docs/` for the project proposal, technical report, demo script, application case study, and IP statement (Simplified Chinese).

## License

[MIT](./LICENSE) — see the `LICENSE` file for the full text.
