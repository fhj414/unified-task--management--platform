# 从 0 到可运行：企业统一待办平台工程底座与 Mock JWT 登录

> 本文是“企业统一待办平台实战”系列第一篇。我们暂时不急着写任务 CRUD，而是先搭建一个可以运行、验证和持续演进的工程底座。

## 前言

在企业里，“待办”通常散落在 OA、审批、项目管理、客服、采购和自研业务系统中。员工每天需要打开多个系统，寻找今天要处理的事情；管理者也很难得到统一的任务视图。

我准备从零实现一个企业统一待办平台：把不同系统中的任务映射为统一模型，在一个工作台中完成查询、筛选、处理和追踪。

但第一步不是接入钉钉，也不是一次性设计几十张业务表。第一步应该建立一个足够简单、可以实际运行、具备测试闭环的项目骨架。

本文对应的代码仓库：

[https://github.com/fhj414/unified-task--management--platform](https://github.com/fhj414/unified-task--management--platform)

## 本阶段完成了什么

第一阶段交付以下能力：

- pnpm workspace 管理的 TypeScript Monorepo；
- Vue 3 + Vite + Pinia 前端；
- NestJS + Prisma 后端；
- PostgreSQL 和 Redis 本地环境；
- API、数据库、Redis 健康检查；
- 本地模拟账号和 JWT 登录；
- 浏览器会话恢复与退出登录；
- Swagger、统一参数校验、异常处理和请求日志；
- 单元测试、前端测试和 API 端到端测试。

需要特别说明：当前任务列表还是前端静态预览数据，尚未实现真正的待办 CRUD。这种边界必须在文章和产品界面中明确，避免把“数据库模型已经存在”误写成“业务功能已经完成”。

## 为什么先做工程底座

统一待办平台后续会涉及：

- 用户身份和数据权限；
- 多个外部系统的认证与字段映射；
- 定时拉取、Webhook 和消息队列；
- 重试、幂等、审计和故障恢复；
- 前后端共享的数据契约。

如果一开始就把这些能力同时加入项目，问题很难定位，架构也容易被尚未验证的需求拖复杂。

因此这一阶段只回答三个问题：

1. 前后端、数据库和 Redis 能否稳定地一起运行？
2. 一个用户能否通过明确的身份边界进入工作台？
3. 后续业务模块是否已经拥有一致的配置、错误和测试基础？

## 技术选型

### Monorepo：pnpm workspace

项目规模还不大，没有引入额外的构建编排器。根目录只负责工作区声明和聚合命令：

```text
.
├── apps/
│   ├── api/          # NestJS API 与 Prisma
│   └── web/          # Vue 3 前端
├── packages/
│   └── shared/       # 前后端共享 TypeScript 契约
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

根目录可以统一执行：

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
```

这个结构的价值不在于“看起来像大项目”，而在于共享契约可以由 TypeScript 编译器直接校验，同时 API 和 Web 仍然保留独立的构建工具。

### 前端：Vue 3 + Vite + Pinia

前端目前只有两个明确职责：

- 管理本地模拟登录状态；
- 展示服务健康状态和待办工作台预览。

因此没有过早引入复杂路由、组件库和请求框架。原生 `fetch` 已足以完成当前请求，Pinia 用于管理认证与健康状态。

### 后端：NestJS + Prisma

NestJS 提供清晰的模块边界，Prisma 负责类型安全的数据访问和数据库迁移。API 按领域拆分：

```text
common/
auth/
users/
departments/
tasks/
integrations/
sync/
```

`users`、`departments`、`tasks`、`integrations` 和 `sync` 当前只是空模块。先声明边界，等真实用例出现后再添加 Controller 和 Service，可以减少无意义样板代码。

### 基础设施：PostgreSQL + Redis

PostgreSQL 保存业务数据，Redis 为后续 BullMQ 同步队列提供基础。开发环境通过 Docker Compose 启动，并只绑定到本机地址：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6379:6379"
```

这里已经配置 BullMQ 的 Redis 连接，但还没有注册任何业务队列。连接配置存在，不代表同步能力已经实现。

## 统一健康检查

一个多依赖应用必须能明确告诉我们“自己为什么不可用”。当前 `/health` 会并行检查 PostgreSQL 和 Redis：

```ts
const [databaseResult, redisResult] = await Promise.allSettled([
  this.database.checkConnection(),
  this.redis.ping(),
]);
```

健康时返回：

```json
{
  "status": "up",
  "timestamp": "2026-10-19T08:00:00.000Z",
  "services": {
    "api": "up",
    "database": "up",
    "redis": "up"
  }
}
```

如果数据库或 Redis 不可用，接口返回 HTTP 503，并准确标记异常组件。具体连接地址和异常堆栈只进入服务端日志，不发送给客户端。

前端健康卡片消费共享类型：

```ts
export interface HealthResponse {
  status: 'up' | 'down';
  timestamp: string;
  services: {
    api: 'up' | 'down';
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}
```

这样可以避免前端根据“猜测的 JSON 结构”开发。

## 先用 Mock JWT 建立身份边界

真实企业登录通常需要钉钉 OAuth、企业微信、OIDC 或内部 SSO。第一阶段直接接入真实平台，会让本地开发依赖企业应用配置、回调域名和网络环境。

因此我们先实现一个明确标注为“仅限本地开发”的模拟认证流程。

### 三个认证接口

| 接口 | 权限 | 用途 |
| --- | --- | --- |
| `GET /auth/mock-users` | 公开 | 获取预置的本地模拟用户 |
| `POST /auth/mock-login` | 公开 | 选择用户并签发短期 JWT |
| `GET /auth/me` | Bearer JWT | 验证令牌并返回当前用户 |

登录接口只允许代码中声明的模拟身份。即使数据库里存在其他用户，也不能通过模拟接口登录。这一限制能防止开发辅助入口悄悄演变成不安全的生产登录方案。

### 为什么 `/auth/me` 重新查询数据库

JWT 中只保存最小身份信息：

```ts
{
  sub: user.id,
  email: user.email
}
```

访问 `/auth/me` 时，服务端验证签名后重新读取用户。这样，当用户被删除或部门关系发生变化时，接口不会长期返回令牌签发时的旧信息。

### 会话只保存在 `sessionStorage`

前端把访问令牌保存在 `sessionStorage`：

- 当前浏览器标签会话可以刷新恢复；
- 关闭会话后不会长期保留；
- 令牌失效时自动清除并回到账号选择页。

这不是生产环境的最终方案。真实系统还需要评估 HttpOnly Cookie、刷新令牌轮换、CSRF、防重放和单点退出。

## 数据模型只做必要预留

当前 Prisma Schema 包含 `Department`、`User` 和 `Task`。

```prisma
enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

model Task {
  id          String     @id @default(uuid()) @db.Uuid
  title       String
  description String?
  status      TaskStatus @default(PENDING)
  source      String     @default("LOCAL")
  externalId  String?
  assigneeId  String?    @db.Uuid
  dueAt       DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([assigneeId, status])
  @@index([source, externalId])
}
```

`source + externalId` 为后续接入外部系统预留映射位置，`assigneeId + status` 支持常见的“查询某人的未完成任务”。

当前没有急着加入租户、抄送人、复杂审批流、软删除和几十种状态。等真实用例明确后再扩展，迁移成本通常低于维护错误抽象的成本。

## 全局工程约束

应用启动时统一注册：

```ts
app.enableCors({ origin });
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
app.useGlobalFilters(new HttpExceptionFilter(...));
app.useGlobalInterceptors(new RequestLoggingInterceptor());
app.enableShutdownHooks();
```

这些约束让后续模块天然获得：

- DTO 白名单和未知字段拒绝；
- 一致的错误响应；
- 不记录请求体和凭证的请求日志；
- 可配置的跨域来源；
- 数据库和 Redis 的优雅关闭；
- `/docs` Swagger 文档。

环境变量也会在启动时校验。比如 JWT 密钥至少 24 个字符，有效期限制为 1 分钟到 24 小时；配置错误时应用直接拒绝启动，而不是运行到某个请求才暴露问题。

## 本地运行

### 环境要求

- Node.js 22 或更高版本；
- pnpm 8.3.1 或兼容的 pnpm 8；
- Docker Desktop 与 Docker Compose v2。

### 第一次启动

```bash
pnpm install
cp .env.example .env
docker compose up -d --wait --wait-timeout 60
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

启动后可以访问：

- Web：`http://localhost:5173`
- 健康检查：`http://localhost:3000/health`
- Swagger：`http://localhost:3000/docs`

### 验证工程状态

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
```

除了正常路径，还可以停止 Redis 验证降级行为：

```bash
docker compose stop redis
curl -i http://localhost:3000/health
docker compose start redis
```

预期第一次请求返回 HTTP 503，并且只把 Redis 标记为 `down`。

## 这一阶段值得记录的几个取舍

### 1. 空业务模块优于伪业务实现

模块目录可以表达未来边界，但不需要为了“代码看起来完整”生成空 Controller 和 Service。没有真实行为就没有真实接口。

### 2. 数据表存在不等于产品功能完成

`Task` 表已经迁移，只说明数据层具备基础结构。只有创建、查询、授权、状态流转和前端交互形成闭环后，才能称为待办功能。

### 3. Mock 登录也要有安全边界

本地工具不能接受数据库中的任意邮箱登录，也不能使用生产凭证。明确的模拟身份白名单让这套能力容易识别和移除。

### 4. 健康检查必须体现依赖状态

只返回 `{ status: "ok" }` 无法区分数据库、Redis 和 API 本身的问题。组件级状态能直接支持容器探针和故障定位。

### 5. 先建立测试闭环，再快速增加业务

当前测试覆盖健康服务、Redis 与 Prisma 适配、环境校验、异常处理、认证服务、JWT Guard、Pinia Store 和 API 端点。后续每个功能都可以沿用相同测试层次。

## 下一阶段计划

下一阶段不会立刻接入多个 SaaS，而是先实现组织和用户只读接口：

1. 查询部门列表和部门详情；
2. 查询部门成员；
3. 查询用户列表和用户详情；
4. 为接口加入 JWT 保护、分页和搜索；
5. 补齐 Swagger、单元测试和端到端测试。

完成身份与组织基础后，再实现本地待办的创建、列表、详情和状态更新，用真实 API 替换静态预览数据。

## 系列预告

下一篇将进入真正的业务开发：

> 《NestJS + Prisma 实现组织架构和用户只读 API》

后续还会继续记录统一待办 CRUD、权限边界、钉钉连接器、BullMQ 同步队列、幂等处理和生产化实践。

如果你也在设计企业内部平台，希望这个从“小而可运行”开始的过程，能比一张过度完整的架构图更有参考价值。
