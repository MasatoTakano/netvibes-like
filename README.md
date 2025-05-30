# Netvibes like app

## Setup

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

## Copy .env.example to .env.local, .env.example.docker to .env.docker
```bash
cp .env.example .env.local
cp .env.example.docker .env.docker
```

## Set AUTH_SECRET on .env files
Edit .env.local and .env.docker and set your own strings on AUTH_SECRET

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

## Run on docker container
```bash
docker compose up -d
```
