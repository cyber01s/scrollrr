import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 100,
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
      width: 192,
      height: 192,
    }
  )
}
