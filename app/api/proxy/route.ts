import { NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw1BYl27EHMBWqmz_1AegfZWLGmm-u-Qkdn8zrrcwDjyO-JOA0HTu966Bce_felgEXvQQ/exec";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            cache: 'no-store'
        });
        const text = await response.text();
        try {
            return NextResponse.json(JSON.parse(text));
        } catch {
            return NextResponse.json({ reservations: [], raw: text });
        }
    } catch (error) {
        console.error("Proxy GET Error:", error);
        return NextResponse.json({ error: 'Veri çekilemedi' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        });
        
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { success: true, message: text };
        }
        
        return NextResponse.json(data);
    } catch (error) {
        console.error("Proxy POST Error:", error);
        return NextResponse.json({ error: 'Veri gönderilemedi' }, { status: 500 });
    }
}
