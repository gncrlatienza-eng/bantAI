# bantAI Backend

Backend API for the **bantAI** Anti-Smishing Detection System.

Built with **NestJS**, **Prisma ORM**, and **PostgreSQL**.

---

## Tech Stack

- NestJS
- Prisma ORM
- PostgreSQL
- Docker
- TypeScript
- Bcrypt

---

## Project Structure

```
src/
├── auth/
├── users/
├── sms/
├── ai/
├── analytics/
├── campaigns/
├── reports/
├── health/
└── main.ts

database/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── prisma.service.ts
```

---

## Getting Started

### Install dependencies

```bash
npm install
```

### Start PostgreSQL

```bash
docker compose up -d
```

### Run database migrations

```bash
npx prisma migrate dev
```

### Generate Prisma Client

```bash
npx prisma generate
```

### Start the development server

```bash
npm run start:dev
```

The API will be available at:

```
http://localhost:3000/api
```

---

## Environment Variables

Create:

```
backend/database/.env
```

Example:

```env
DATABASE_URL="postgresql://<username>:<password>@localhost:<port>/bantai_db"
SHADOW_DATABASE_URL="postgresql://<username>:<password>@localhost:<port>/bantai_shadow_db"
```

---

## Current Features

### Backend Foundation
- ✅ NestJS project setup
- ✅ PostgreSQL with Docker
- ✅ Prisma ORM integration
- ✅ Health endpoint
- ✅ Global validation
- ✅ CORS configuration

### Authentication
- ✅ User registration
- ✅ User login
- ✅ Password hashing (bcrypt)
- ✅ Request validation (DTOs)

---

## API Endpoints

### Health

```
GET /api/health
```

### Authentication

```
POST /api/auth/register
POST /api/auth/login
```

---

## Development Workflow

Branch strategy:

```
main
│
develop
│
feature/<feature-name>
│
bugfix/<bug-name>

---

## Authors
BS Computer Science Thesis Project
De La Salle Lipa