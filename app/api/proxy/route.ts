import { NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFecxccz6SP5tyPW0Mz2BB8h2xVaIu7iaTwZM1eIr8yKcs8ZIf22eoCjfVGUADdwOn-A/exec";

export async function GET(request: Request) {
    try {
        // Forward the request to Google Script
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=villa`, {
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
