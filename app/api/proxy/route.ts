import { NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFecxccz6SP5tyPW0Mz2BB8h2xVaIu7iaTwZM1eIr8yKcs8ZIf22eoCjfVGUADdwOn-A/exec";

// MENTÖRLÜK DOKUNUŞU: Vercel'in bu API'yi asla önbelleğe almaması (cache) için zorluyoruz.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            cache: 'no-store'
        });
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Proxy GET Error:", error);
        return NextResponse.json({ error: 'Veri çekilemedi' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Vercel, Google'a veriyi "text/plain" formatında sorunsuzca iletir ve engellere takılmaz.
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Proxy POST Error:", error);
        return NextResponse.json({ error: 'Veri gönderilemedi' }, { status: 500 });
    }
}
