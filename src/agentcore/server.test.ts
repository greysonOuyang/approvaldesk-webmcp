import { describe, expect, test } from 'bun:test'
import {
  Model,
  type BaseModelConfig,
  type Message,
  type ModelStreamEvent,
  type StreamOptions,
} from '@strands-agents/sdk'
import { createAgentCoreServer } from './server'

class StaticModel extends Model<BaseModelConfig> {
  private config: BaseModelConfig = {
    modelId: 'approvaldesk-agentcore-contract-test',
    contextWindowLimit: 8_000,
  }

  updateConfig(config: BaseModelConfig) {
    this.config = { ...this.config, ...config }
  }

  getConfig() {
    return { ...this.config }
  }

  async *stream(_messages: Message[], _options?: StreamOptions): AsyncIterable<ModelStreamEvent> {
    yield { type: 'modelMessageStartEvent', role: 'assistant' }
    yield { type: 'modelContentBlockStartEvent' }
    yield {
      type: 'modelContentBlockDeltaEvent',
      delta: { type: 'textDelta', text: 'agentcore-runtime-ok' },
    }
    yield { type: 'modelContentBlockStopEvent' }
    yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' }
  }
}

async function listen() {
  const server = createAgentCoreServer({ model: new StaticModel() })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP test address.')
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

describe('AgentCore Runtime HTTP contract', () => {
  test('serves health and invokes the existing Strands agent through the documented endpoints', async () => {
    const { server, baseUrl } = await listen()
    try {
      const ping = await fetch(`${baseUrl}/ping`)
      expect(ping.status).toBe(200)
      expect(await ping.json()).toEqual({ status: 'Healthy' })

      const invocation = await fetch(`${baseUrl}/invocations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'Confirm the AgentCore HTTP wrapper is alive.' }),
      })
      expect(invocation.status).toBe(200)
      const body = await invocation.json() as { result: unknown }
      expect(JSON.stringify(body.result)).toContain('agentcore-runtime-ok')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test('rejects an invocation without a real prompt', async () => {
    const { server, baseUrl } = await listen()
    try {
      const response = await fetch(`${baseUrl}/invocations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: '   ' }),
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'prompt must be a non-empty string.' })
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
