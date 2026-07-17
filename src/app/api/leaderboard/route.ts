import { NextRequest, NextResponse } from 'next/server';

// Leaderboard entries stored in memory (for free tier - no external DB required for basic functionality)
// For Turso integration, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars
let leaderboardEntries: Array<{
  id: string;
  playerName: string;
  scene: string;
  score: number;
  time: number;
  date: string;
}> = [];

// Try to use Turso if configured
let tursoClient: any = null;
try {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    // Dynamic import for Turso
    import('@libsql/client').then((mod) => {
      tursoClient = mod.createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      initTursoDB();
    }).catch(() => {
      console.log('Turso not available, using in-memory storage');
    });
  }
} catch {
  console.log('Turso not available, using in-memory storage');
}

async function initTursoDB() {
  if (!tursoClient) return;
  try {
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playerName TEXT NOT NULL,
        scene TEXT NOT NULL,
        score INTEGER NOT NULL,
        time REAL NOT NULL,
        date TEXT NOT NULL
      )
    `);
    console.log('Turso database initialized');
  } catch (e) {
    console.log('Turso init error:', e);
  }
}

// Seed some default entries
if (leaderboardEntries.length === 0) {
  const names = [
    'ProGamer', 'BlockMaster', 'SpeedKing', 'ObbyGod', 'ExplorerX',
    'BuildPro', 'ArenaStar', 'NinjaRun', 'CoinHunter', 'JumpKing',
    'PhantomX', 'SkyWalker', 'DiamondQ', 'FireBolt', 'IceQueen',
  ];
  const scenes = ['lobby', 'obby', 'battle', 'speedrun', 'explorer', 'builder'];
  names.forEach((name, i) => {
    const scene = scenes[i % scenes.length];
    leaderboardEntries.push({
      id: `seed_${i}`,
      playerName: name,
      scene,
      score: Math.max(100, 2000 - i * 120 + Math.floor(Math.random() * 200)),
      time: 30 + i * 12 + Math.floor(Math.random() * 20),
      date: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    });
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scene = searchParams.get('scene');

  try {
    // Try Turso first
    if (tursoClient) {
      const query = scene
        ? 'SELECT * FROM leaderboard WHERE scene = ? ORDER BY score DESC LIMIT 50'
        : 'SELECT * FROM leaderboard ORDER BY score DESC LIMIT 50';
      const params = scene ? [scene] : [];
      const result = await tursoClient.execute({ sql: query, args: params });
      const entries = result.rows.map((row: any, i: number) => ({
        id: String(row.id || i),
        playerName: row.playerName,
        scene: row.scene,
        score: Number(row.score),
        time: Number(row.time),
        date: row.date,
      }));
      return NextResponse.json({ entries, source: 'turso' });
    }

    // Fallback to in-memory
    let filtered = leaderboardEntries;
    if (scene) {
      filtered = leaderboardEntries
        .filter((e) => e.scene === scene)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);
    } else {
      filtered = [...leaderboardEntries].sort((a, b) => b.score - a.score).slice(0, 50);
    }
    return NextResponse.json({ entries: filtered, source: 'memory' });
  } catch (error) {
    console.error('Leaderboard GET error:', error);
    return NextResponse.json(
      { entries: leaderboardEntries.slice(0, 50), source: 'fallback' },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerName, scene, score, time } = body;

    if (!playerName || !scene || score === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const entry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      playerName: playerName.slice(0, 20),
      scene: scene.slice(0, 20),
      score: Math.max(0, Math.floor(Number(score))),
      time: Math.max(0, Number(time) || 0),
      date: new Date().toISOString(),
    };

    // Try Turso first
    if (tursoClient) {
      try {
        await tursoClient.execute({
          sql: 'INSERT INTO leaderboard (playerName, scene, score, time, date) VALUES (?, ?, ?, ?, ?)',
          args: [entry.playerName, entry.scene, entry.score, entry.time, entry.date],
        });
        return NextResponse.json({ success: true, entry, source: 'turso' });
      } catch {
        // Fall through to memory
      }
    }

    // Fallback to in-memory
    leaderboardEntries.push(entry);
    // Keep max 500 entries
    if (leaderboardEntries.length > 500) {
      leaderboardEntries = leaderboardEntries.sort((a, b) => b.score - a.score).slice(0, 500);
    }

    return NextResponse.json({ success: true, entry, source: 'memory' });
  } catch (error) {
    console.error('Leaderboard POST error:', error);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}