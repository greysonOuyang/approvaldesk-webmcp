import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Model } from '@strands-agents/sdk'
import { createApprovalAgent } from '../agent/approval-agent'

const MAX_BODY_BYTES = 1_000_000

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.')
    chunks.push(buffer)
  }

  if (!chunks.length) return {}

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'Request body must be a JSON object.')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Request body must contain valid JSON.')
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export interface AgentCoreServerOptions {
  model?: Model
}

export function createAgentCoreServer(options: AgentCoreServerOptions = {}) {
  return createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

    if (request.method === 'GET' && pathname === '/ping') {
      sendJson(response, 200, { status: 'Healthy' })
      return
    }

    if (request.method === 'POST' && pathname === '/invocations') {
      try {
        const body = await readJsonBody(request)
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
        if (!prompt) throw new HttpError(400, 'prompt must be a non-empty string.')

        // Each invocation gets fresh conversation state. ApprovalDesk workflow state remains
        // shared through the existing store, so a later invocation can resume only after a
        // real human decision without leaking model chat history across Runtime requests.
        const agent = createApprovalAgent(options.model ? { model: options.model } : {})
        const result = await agent.invoke(prompt)
        sendJson(response, 200, { result: result.lastMessage })
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(response, error.statusCode, { error: error.message })
          return
        }
        sendJson(response, 500, { error: errorMessage(error) })
      }
      return
    }

    sendJson(response, 404, { error: 'Not found.' })
  })
}
