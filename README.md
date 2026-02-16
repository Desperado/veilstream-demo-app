# VeilStream Demo App

A simple user management dashboard built with Express and PostgreSQL. Used as a demo environment for QualityMax integration testing.

## Quick Start

```bash
docker-compose up
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Demo Scenario

**"Make the users table sortable"** — the `main` branch has a static users table. The `feature/sortable-table` branch adds client-side column sorting with visual indicators.

## Stack

- **Backend**: Express (Node.js 20)
- **Database**: PostgreSQL 16
- **Frontend**: Vanilla HTML/JS
- **Infra**: Docker Compose
