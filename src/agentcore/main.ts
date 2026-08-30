import { createAgentCoreServer } from './server'

const port = Number.parseInt(process.env.PORT ?? '8080', 10)
if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT ?? ''}`)
}

const server = createAgentCoreServer()
server.listen(port, '0.0.0.0', () => {
  console.log(`ApprovalDesk AgentCore Runtime listening on port ${port}`)
})

function shutdown(signal: string) {
  console.log(`Received ${signal}; closing AgentCore Runtime.`)
  const fallback = setTimeout(() => process.exit(1), 5_000)
  fallback.unref()
  server.close(() => {
    clearTimeout(fallback)
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
