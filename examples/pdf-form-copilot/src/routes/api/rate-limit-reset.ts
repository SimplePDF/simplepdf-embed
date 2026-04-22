import { createFileRoute } from '@tanstack/react-router'
import { rateLimiter } from '../../server/rate_limit'

export const Route = createFileRoute('/api/rate-limit-reset')({
  server: {
    handlers: {
      POST: async () => {
        if (process.env.NODE_ENV === 'production') {
          return Response.json({ error: 'not_available_in_production' }, { status: 404 })
        }
        const cleared = rateLimiter.reset()
        return Response.json({ cleared })
      },
    },
  },
})
