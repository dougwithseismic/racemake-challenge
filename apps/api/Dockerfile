FROM node:20-slim AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace config + lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for all workspace packages
COPY apps/api/package.json apps/api/package.json
COPY packages/challenge-easy/package.json packages/challenge-easy/package.json
COPY packages/challenge-hard/package.json packages/challenge-hard/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/ui/package.json packages/ui/package.json

# Install deps
RUN pnpm install --frozen-lockfile

# ---- Runtime ----
FROM node:20-slim AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy dependency artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/ ./packages/

# Copy source code for all workspace packages
COPY packages/challenge-easy/ ./packages/challenge-easy/
COPY packages/challenge-hard/ ./packages/challenge-hard/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY apps/api/ ./apps/api/

# Install tsx globally for TypeScript execution
RUN corepack enable && pnpm add -g tsx

ENV PORT=3000
EXPOSE 3000

CMD ["tsx", "apps/api/src/index.ts"]
