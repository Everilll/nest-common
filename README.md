# @averildwi/nest-common

[![npm version](https://img.shields.io/npm/v/@averildwi/nest-common.svg)](https://www.npmjs.com/package/@averildwi/nest-common)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-v11-red)](https://nestjs.com)

A collection of reusable modules (filters, guards, interceptors, pipes, decorators,
config, helpers) for bootstrapping new [NestJS](https://nestjs.com/)
projects. Built to avoid rewriting the same boilerplate for every new backend—just install,
register in `main.ts`, and you're ready to go.

## Installation

```bash
npx @averildwi/nest-common
```

### Peer dependencies

This package doesn't bundle its dependencies, so make sure your project
also has these installed:

```bash
npm install @nestjs/common @nestjs/core @nestjs/config @nestjs/passport @nestjs/swagger
npm install class-validator class-transformer joi
npm install @prisma/client
```

> `@prisma/client` is only required if you use `PrismaExceptionFilter`.
> If your ORM isn't Prisma, just skip that filter and everything else works fine.

## Package Contents

| Folder | Contents | Purpose |
|---|---|---|
| `config/` | `AppConfigModule`, `baseEnvSchema` | Environment variable validation using Joi, extendable per project |
| `decorators/` | `CurrentUser`, `Roles` | Extract user from request, specify roles allowed to access endpoints |
| `dto/` | `PaginationDto` | Standard pagination query DTO (page, limit, skip) |
| `filters/` | `GlobalExceptionFilter`, `PrismaExceptionFilter` | Standardize error response shape |
| `guards/` | `JwtAuthGuard`, `RolesGuard` | JWT authentication + role-based access control |
| `helpers/` | `buildErrorResponse`, `paginate` | Pure helpers, no dependency injection |
| `hashing/` | `HashingModule`, `HashingService` | Hash & verify passwords using native scrypt |
| `interceptors/` | `LoggerInterceptor`, `TransformInterceptor` | Log requests/responses, wrap successful responses in standard shape |
| `pipes/` | `createValidationPipe` | Standard `ValidationPipe` configuration + per-field error messages |

## Quick Start

### 1. Setup config & env validation

```typescript
// src/config/app-config.module.ts
import * as Joi from 'joi';
// Import from your newly generated local folder!
import { AppConfigModule } from '../common/config/app-config.module';

export const ProjectConfigModule = AppConfigModule.forProject(
  Joi.object({
    // add project-specific env vars here
    CLOUDINARY_CLOUD_NAME: Joi.string().required(),
    CLOUDINARY_API_KEY: Joi.string().required(),
    CLOUDINARY_API_SECRET: Joi.string().required(),
  }),
);
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ProjectConfigModule } from './config/app-config.module';
// Import from your local common folder
import { HashingModule } from './common/hashing/hashing.module';

@Module({
  imports: [ProjectConfigModule, HashingModule /* other modules */],
})
export class AppModule {}
```

### 2. Bootstrap in main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// Import all utilities from your local common folder
import { LoggerInterceptor } from './common/interceptors/logger.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { createValidationPipe } from './common/pipes/validation.pipe.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(
    new LoggerInterceptor(),
    new TransformInterceptor(),
  );

  app.useGlobalPipes(createValidationPipe());

  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new PrismaExceptionFilter(),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

### 3. Use in controller

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
// Import semuanya dari folder common lokal proyek Anda
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Paginated } from '../common/helpers/paginate.helper';

@Controller('users')
export class UsersController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    const [data, total] = await this.usersService.findAll(pagination);
    return new Paginated(data, {
      page: pagination.page,
      limit: pagination.limit,
      total,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}
```

## Response Shape

All responses (success or error) follow a consistent shape, so the
frontend doesn't need to handle different formats:

**Success:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": { "...": "..." },
  "timestamp": "2026-07-15T10:00:00.000Z"
}
```

**Error:**
```json
{
  "statusCode": 400,
  "message": ["email: email must be an email"],
  "data": null,
  "error": "BadRequestException",
  "timestamp": "2026-07-15T10:00:00.000Z"
}
```

## Request Flow

```
Request
   │
   ▼
LoggerInterceptor (log "-->")
   │
   ▼
Guards (JwtAuthGuard → RolesGuard)
   │
   ▼
ValidationPipe (createValidationPipe)
   │
   ▼
Controller/Service
   │
   ├── Success ──► TransformInterceptor ──► Response
   │
   └── Throw ───► GlobalExceptionFilter / PrismaExceptionFilter ──► Response
```

## Important Notes

- **`RolesGuard`** assumes `user.role` is a single string. If your project
  needs multi-role per user (array), extend/override it yourself.
- **`JwtAuthGuard`** must run before `RolesGuard` in the
  `@UseGuards(...)` order, because `RolesGuard` requires `request.user` to be set.
- Error messages in `PrismaExceptionFilter` are still hardcoded in Indonesian.
  If you need multi-language support, override the messages in your project.
- `baseEnvSchema` only covers universal env vars (DATABASE_URL, PORT,
  NODE_ENV, FRONTEND_URL, JWT_SECRET, JWT_EXPIRES_IN). Project-specific env vars
  are added via `AppConfigModule.forProject(extraSchema)`.

## License

MIT License