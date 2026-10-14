# Enterprise Hub 第一阶段项目初始化设计

## 目标

初始化一个可运行、可测试的企业统一待办平台 monorepo，作为学习 NestJS 企业级后端开发与第三方 SaaS 集成的基础。第一阶段只建立工程骨架、基础设施连接、健康检查、前端占位页面和测试闭环，不实现业务 CRUD、真实鉴权或 SaaS 同步逻辑。

## 范围

本阶段交付：

- 基于 pnpm workspace 的 `apps/web`、`apps/api`、`packages/shared` 三包结构。
- Vue 3 + Vite + TypeScript + Pinia 前端骨架。
- NestJS + TypeScript 后端骨架，按 `common`、`auth`、`users`、`departments`、`tasks`、`integrations`、`sync` 拆分模块。
- 唯一对外业务接口 `GET /health`，检查 API、PostgreSQL 和 Redis 状态。
- Prisma 配置、`User`、`Department`、`Task` 模型及首个 SQL migration。
- PostgreSQL 和 Redis 的 Docker Compose 开发环境。
- 全局参数校验、异常格式、Swagger、环境变量校验和请求日志。
- 基础单元测试、最小接口测试，以及聚合的类型检查、构建和测试命令。
- README 与 `.env.example`。

明确不在本阶段实现：

- 用户、部门和待办 CRUD。
- JWT、会话或权限系统。
- 真实钉钉登录或任何钉钉 SDK 调用。
- SaaS 连接器、同步调度、队列生产者或消费者。
- 微服务、Kubernetes、复杂 DDD、事件总线或可观测性平台。

`auth` 模块只保留结构与本地 Mock 的后续扩展说明，不提供登录接口。

## 技术路线

采用标准 pnpm workspace，各应用保留符合自身生态的工具链。根目录负责依赖工作区声明和聚合脚本，不引入 Turborepo。NestJS 使用 Jest 与 Supertest，Vue 使用 Vitest。`packages/shared` 只发布真正跨端复用的 TypeScript 类型，不承担运行时基础设施或业务逻辑。

此路线比引入额外构建编排器更容易理解，也能在当前规模下保持足够清晰的包边界。

## 目录与职责

```text
enterprise-hub/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── common/
│   │   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   ├── filters/
│   │   │   │   ├── health/
│   │   │   │   ├── interceptors/
│   │   │   │   └── redis/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── departments/
│   │   │   ├── tasks/
│   │   │   ├── integrations/
│   │   │   ├── sync/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── test/
│   └── web/
│       └── src/
│           ├── components/
│           ├── stores/
│           ├── views/
│           ├── App.vue
│           └── main.ts
├── packages/
│   └── shared/
│       └── src/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

空业务模块只包含 Nest module 文件，避免生成无行为的 controller 和 service。`common` 包含全局横切能力与基础设施适配器；health 放在 `common/health`，因为它是平台运行状态而非业务域。

## 后端架构

`AppModule` 导入配置、BullMQ 基础连接、Prisma、Redis、health 和六个业务占位模块。应用启动时：

- 通过 Nest Config 加 Joi 对环境变量进行同步校验，配置不合法则拒绝启动。
- 注册全局 `ValidationPipe`，启用白名单、禁止未声明属性和自动类型转换。
- 注册全局异常过滤器，统一输出 `statusCode`、`message`、`path`、`timestamp`。
- 注册请求日志 interceptor，记录 HTTP 方法、路径、响应状态和耗时。
- 配置 Swagger UI 到 `/docs`。
- 根据 `CORS_ORIGIN` 配置 CORS。

Prisma service 管理数据库连接和应用关闭。Redis service 使用独立的 ioredis 客户端完成健康探测与关闭。BullMQ 复用同一组 Redis 环境配置，但本阶段不注册具体队列。

### 健康检查

`GET /health` 返回共享类型定义的结果：

```ts
type ComponentStatus = 'up' | 'down';

interface HealthResponse {
  status: ComponentStatus;
  timestamp: string;
  services: {
    api: ComponentStatus;
    database: ComponentStatus;
    redis: ComponentStatus;
  };
}
```

health service 并行执行数据库 `SELECT 1` 和 Redis `PING`。两者都成功时返回 HTTP 200 和整体 `up`；任一失败时仍返回完整组件状态，但 HTTP 状态为 503，整体状态为 `down`。具体连接错误不返回给客户端，只由服务端日志记录。

## 数据模型

所有主键使用 PostgreSQL UUID，时间字段由 Prisma 管理。

### Department

- `id`: UUID 主键。
- `name`: 必填。
- `parentId`: 可空，自关联以支持基础组织树。
- `createdAt`, `updatedAt`。
- 关系：一个部门可有多个子部门和用户。

### User

- `id`: UUID 主键。
- `email`: 必填且唯一。
- `name`: 必填。
- `departmentId`: 可空，关联 Department，删除部门时设为 null。
- `createdAt`, `updatedAt`。

### Task

- `id`: UUID 主键。
- `title`: 必填。
- `description`: 可空。
- `status`: `PENDING | IN_PROGRESS | COMPLETED`，默认 `PENDING`。
- `source`: 字符串，默认 `LOCAL`。
- `externalId`: 可空，供未来外部系统映射。
- `assigneeId`: 可空，关联 User，删除用户时设为 null。
- `dueAt`: 可空。
- `createdAt`, `updatedAt`。
- 索引：`assigneeId + status`、`source + externalId`。

首个 migration 直接创建枚举、表、外键、唯一约束和索引。数据库命名由 Prisma 映射保持一致，不引入软删除、多租户、审计历史或乐观锁。

## 前端设计

前端是一个单页占位应用，不引入路由。基本布局包含：

- 顶部产品名称与环境说明。
- 简洁侧栏，显示“我的待办”为当前占位入口。
- 主内容区展示若干静态待办占位行，明确标识尚未接入业务 API。
- 后端连接状态卡片，显示加载中、已连接或不可用。

Pinia health store 负责调用 `/health`、保存加载状态与响应，并将网络错误映射为不可用状态。Vite 开发服务器将 `/health` 代理至 Nest API；前端不硬编码开发环境 API 地址。共享包提供 `HealthResponse` 类型。

## 数据流与故障处理

```text
Vue 页面
  -> Pinia health store
  -> Vite /health 代理
  -> Nest HealthController
  -> HealthService
     -> Prisma -> PostgreSQL
     -> RedisService -> Redis
```

依赖不可用时，health service 汇总结果并抛出可控的 503 响应。全局异常过滤器保留 health 响应需要的结构，同时将其他 Nest HTTP 异常规范化。未知异常只向客户端返回通用消息，避免泄露堆栈或连接信息。

请求日志不记录请求体、凭据或环境变量。前端捕获 fetch 失败和非 2xx 响应，显示不可用状态，不让页面崩溃。

## 环境与本地开发

根目录 `docker-compose.yml` 提供：

- PostgreSQL，带持久化 volume 和健康检查。
- Redis，带持久化 volume 和健康检查。

`.env.example` 提供与 Compose 默认配置匹配的开发值：`PORT`、`DATABASE_URL`、`REDIS_HOST`、`REDIS_PORT`、`CORS_ORIGIN`。真实 `.env` 被 Git 忽略。pnpm lockfile 被提交，以保证依赖解析可复现。

推荐启动顺序：安装依赖、复制环境文件、启动 Compose、生成 Prisma Client、执行 migration、启动前后端开发服务。

## 测试与验收

后端测试：

- health service 单元测试验证全依赖正常与任一依赖失败时的聚合结果。
- Supertest 最小接口测试验证 `/health` 的 HTTP 200、HTTP 503 和响应结构。

前端测试：

- Pinia health store 测试验证成功响应和请求失败的状态映射。

共享包通过 TypeScript 编译验证导出。根目录聚合脚本必须能完成：

- TypeScript 类型检查。
- 所有 workspace 构建。
- 所有测试运行。

验收标准：

1. Docker Compose 能启动 PostgreSQL 和 Redis，并通过各自健康检查。
2. migration 能在空数据库上执行，Prisma Client 能生成。
3. API 启动后 `/health` 在依赖正常时返回 200 和三个 `up` 状态。
4. 停止任一依赖后 `/health` 返回 503，并准确标记故障组件。
5. Web 页面能显示基本布局、待办占位内容和后端连接状态。
6. 类型检查、构建和测试命令全部以退出码 0 完成。
7. Swagger 可通过 `/docs` 访问并列出 health 接口。

## 下一阶段边界

完成初始化后，建议按以下顺序继续：

1. 本地 Mock 登录与当前用户接口。
2. 部门查询与用户归属接口。
3. 待办创建、列表、详情、状态更新接口。
4. 第一种 SaaS 连接器的配置与凭据抽象。
5. BullMQ 同步任务生产者、消费者及幂等处理。

每一步应单独设计和测试，避免在初始化阶段提前生成完整业务逻辑。
