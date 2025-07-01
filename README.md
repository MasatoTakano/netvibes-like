# Netvibes like app

This is a web application built with Nuxt.js (v3) and TypeScript, providing a customizable dashboard interface where users can add, arrange, and manage various widgets.

## Features

-   **Widget-based Dashboard:** Create and manage a personalized dashboard with various widgets.
-   **User Authentication:** Secure user authentication powered by Lucia Auth.
-   **Layout Persistence:** User-specific widget layouts are saved and loaded.
-   **Multiple Widget Types:** Includes Memo/Note, RSS Reader, and Google Calendar widgets.

## Technologies

-   **Frontend:** Nuxt.js (Vue.js 3), TypeScript, `splitpanes`, `vuedraggable`, `@nuxtjs/i18n`
-   **Backend:** Nuxt.js server routes, Prisma (ORM), Lucia Auth
-   **Database:** Configured via Prisma (e.g., SQLite, PostgreSQL)

## Setup

First, copy and rename the example environment files:

```bash
cp .env.example .env
cp .env.example.docker .env.docker
```

Then, edit `.env` and `.env.docker` to configure your environment variables.

Make sure to install dependencies:

```bash
# npm or yarn or bun
npm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm or yarn or bun
npm run dev
```

## Production

Build the application for production:

```bash
# npm or yarn or bun
npm run build