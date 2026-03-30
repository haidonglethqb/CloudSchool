const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

// Graceful shutdown
const shutdown = async () => {
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

module.exports = prisma
