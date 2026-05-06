import { Redis } from '@upstash/redis'

function getUpstashCredentials() {
  let url = process.env.UPSTASH_REDIS_URL || 'https://dummy.upstash.io'
  let token = process.env.UPSTASH_REDIS_TOKEN || 'dummy'

  if (url.includes('redis-cli')) {
    // Extract url: redis://default:<token>@<host>:<port>
    const match = url.match(/redis:\/\/(?:[^:]+):([^@]+)@([^:]+)/)
    if (match) {
      token = match[1]
      url = `https://${match[2]}`
    } else {
      url = 'https://dummy.upstash.io'
    }
  } else if (url.startsWith('redis://')) {
    const match = url.match(/redis:\/\/(?:[^:]+):([^@]+)@([^:]+)/)
    if (match) {
      token = match[1]
      url = `https://${match[2]}`
    } else {
      url = 'https://dummy.upstash.io'
    }
  }

  return { url, token }
}

const credentials = getUpstashCredentials()

export const redis = new Redis({
  url: credentials.url,
  token: credentials.token
})
