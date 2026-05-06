import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 300,
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FF6321',
          fontWeight: 800,
        }}
      >
        S
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  )
}
