# Netvibes like app
Memo and RSS widget management application.

![NetVibesもどき_メイン画面](https://github.com/user-attachments/assets/0b3ef86e-0d44-45cb-aa99-860e47641831)

## Setup

Make sure to install dependencies:

```bash
# npm or yarn or bun
npm install
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
# npm or yarn or bun
npm run dev
```

## Production

Build the application for production:

```bash
# npm or yarn or bun
npm run build
```


## Run on docker container
```bash
docker compose up -d
```
