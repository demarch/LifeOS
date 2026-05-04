import { NextResponse } from 'next/server';
import { syncPluggy } from '@/lib/pluggy';

export async function POST() {
  try {
    const result = await syncPluggy();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
