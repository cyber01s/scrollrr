import * as dotenv from 'dotenv'
dotenv.config()
dotenv.config({ path: '.env.local' })

async function main() {
  const url = 'http://localhost:3000/api/admin/revalidate'
  const secret = process.env.CRON_SECRET || 'your_secret'
  
  console.log(`Triggering ${url} with secret ${secret}`)
  try {
    const fetch = (await import('node-fetch')).default
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`
      }
    })
    console.log(res.status)
    const json = await res.json()
    console.log(json)
  } catch (err) {
    console.error(err)
  }
}
main()
