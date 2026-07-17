import { NextRequest, NextResponse } from 'next/server';

// Player data API - simple in-memory storage
// For Turso integration, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars
let playerData: Record<string, {
  name: string;
  coins: number;
  totalScore: number;
  gamesPlayed: number;
  level: number;
  xp: number;
  highScores: Record<string, number>;
}> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || 'player_1';

  const player = playerData[id] || {
    name: 'BlockPlayer',
    coins: 0,
    totalScore: 0,
    gamesPlayed: 0,
    level: 1,
    xp: 0,
    highScores: { lobby: 0, obby: 0, battle: 0, speedrun: 0, explorer: 0, builder: 0 },
  };

  return NextResponse.json(player);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    const playerId = id || 'player_1';
    playerData[playerId] = {
      ...playerData[playerId],
      ...data,
    };

    return NextResponse.json({ success: true, player: playerData[playerId] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save player data' }, { status: 500 });
  }
}