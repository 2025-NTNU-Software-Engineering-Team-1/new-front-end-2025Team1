FROM node:22-alpine

ENV PNPM_HOME="/pnpm"

ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

ENV VITE_APP_API_BASE_URL="/api"

WORKDIR /app

COPY package*.json ./

RUN pnpm install

COPY . .

CMD [ "pnpm", "run", "dev", "--host" ]