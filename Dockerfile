FROM mcr.microsoft.com/playwright:v1.57.0-jammy AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build


FROM mcr.microsoft.com/playwright:v1.57.0-jammy AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]
