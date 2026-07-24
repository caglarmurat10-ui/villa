import { NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFecxccz6SP5tyPW0Mz2BB8h2xVaIu7iaTwZM1eIr8yKcs8ZIf22eoCjfVGUADdwOn-A/exec";

export async function GET(request: Request) {
    try {
        // Forward the request to Google Script
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            cache: 'no-store', // Important: Ensure we always get fresh data
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch from Google' }, { status: response.status });
        }

        const text = await response.text();

        // Parse it here to ensure it's valid JSON before sending to client
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Invalid JSON from Google:", text);
            return NextResponse.json({ error: 'Invalid JSON response from Google Script' }, { status: 502 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Google Script'e isteği ilet
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Google Script redirect dönebilir (302), fetch bunu takip eder.
        // Sonuçta text veya json dönebilir.
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            // Eğer JSON değilse, muhtemelen HTML hata sayfası veya success text dönmüştür
            // Google Apps Script bazen JSON yerine HTML döner (auth vs için)
            console.warn("Google Script non-JSON response:", text);
            // Basit başarı kontrolü
            if (response.ok) {
                return NextResponse.json({ success: true, raw: text });
            }
            return NextResponse.json({ error: 'Invalid response from Google' }, { status: 502 });
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error('Proxy POST Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
