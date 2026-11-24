# ARGUS extension server on Render (free plan friendly): Node only.
FROM node:22-bookworm-slim
WORKDIR /app
# Node dependency: @meta-sam/parser, used by Argus Lens (lens/) to read SAM 3.1's answers.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data/runtime
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.mjs"]
