# Memo App

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
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.