export async function fetchImpactCampaigns() {
  const sid = process.env.IMPACT_ACCOUNT_SID
  const token = process.env.IMPACT_AUTH_TOKEN
  if (!sid || !token) throw new Error('Missing impact.com credentials')

  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  
  const res = await fetch(`https://api.impact.com/Mediapartners/${sid}/Campaigns/`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    }
  })
  
  if (!res.ok) {
    throw new Error(`Failed to fetch campaigns: ${res.statusText}`)
  }
  
  return res.json()
}

export async function fetchImpactCatalogItems(catalogId: string, page: number = 0, size: number = 100) {
  const sid = process.env.IMPACT_ACCOUNT_SID
  const token = process.env.IMPACT_AUTH_TOKEN
  if (!sid || !token) throw new Error('Missing impact.com credentials')

  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  
  const res = await fetch(`https://api.impact.com/Mediapartners/${sid}/Catalogs/${catalogId}/Items/?PageSize=${size}&PageIndex=${page}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    }
  })
  
  if (!res.ok) {
    throw new Error(`Failed to fetch items for catalog ${catalogId}: ${res.statusText}`)
  }
  
  return res.json()
}
