import { Hono } from 'hono'
import { z } from 'zod'
import { handleRouteError } from '../../lib/handle-route-error'
import {
  getPlaygroundSchema,
  runPlaygroundQuery,
  testPlaygroundConnection,
} from '../../services/playground-service'

const playgroundConnectionSchema = z.object({
  connectionString: z.string().optional(),
  databaseEngine: z.enum(['postgresql', 'mysql', 'sqlite', 'sqlserver']).optional(),
  host: z.string().optional(),
  port: z.number().int().positive().max(65535).optional(),
  databaseName: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  filePath: z.string().optional(),
  sslMode: z
    .enum(['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'])
    .optional(),
})

const playgroundQuerySchema = playgroundConnectionSchema.extend({
  sqlText: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().min(0).optional(),
  timeoutMs: z.number().int().positive().max(30000).optional(),
})

export const playgroundRoutes = new Hono()
  .post('/test-connection', async (c) => {
    try {
      const payload = playgroundConnectionSchema.parse(await c.req.json())
      const testResult = await testPlaygroundConnection(payload)
      return c.json({ testResult })
    } catch (error) {
      return handleRouteError(c, error)
    }
  })
  .post('/schema', async (c) => {
    try {
      const payload = playgroundConnectionSchema.parse(await c.req.json())
      const result = await getPlaygroundSchema(payload)
      return c.json(result)
    } catch (error) {
      return handleRouteError(c, error)
    }
  })
  .post('/query', async (c) => {
    try {
      const payload = playgroundQuerySchema.parse(await c.req.json())
      const result = await runPlaygroundQuery(payload)
      return c.json(result)
    } catch (error) {
      return handleRouteError(c, error)
    }
  })
