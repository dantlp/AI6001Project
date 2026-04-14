FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY client ./client
COPY server ./server
COPY .env.example ./.env.example

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
