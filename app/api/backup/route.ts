import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const backupFilePath = path.join(process.cwd(), 'public', 'villa.html');

        if (!fs.existsSync(backupFilePath)) {
            return NextResponse.json({ reservations: [], prices: [] });
        }

        const htmlContent = fs.readFileSync(backupFilePath, 'utf-8');

        const regex = /(<script id="villa-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
        const match = htmlContent.match(regex);

        if (match && match[2]) {
            try {
                const parsed = JSON.parse(match[2]);
                if (Array.isArray(parsed)) {
                    return NextResponse.json({ reservations: parsed, prices: [] });
                }
                return NextResponse.json(parsed);
            } catch (e) {
                console.error("Backup JSON Parse Error:", e);
                return NextResponse.json({ reservations: [], prices: [] });
            }
        }

        return NextResponse.json({ reservations: [], prices: [] });

    } catch (error) {
        console.error('Backup GET Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const payload = await request.json();

        if (!payload) {
            return NextResponse.json({ success: false, error: 'No data provided' }, { status: 400 });
        }

        const backupFilePath = path.join(process.cwd(), 'public', 'villa.html');

        if (!fs.existsSync(backupFilePath)) {
            return NextResponse.json({ success: false, error: 'Backup file not found' }, { status: 404 });
        }

        let htmlContent = fs.readFileSync(backupFilePath, 'utf-8');
        const regex = /(<script id="villa-data" type="application\/json">)([\s\S]*?)(<\/script>)/;

        if (regex.test(htmlContent)) {
            const newContent = JSON.stringify(payload);
            htmlContent = htmlContent.replace(regex, `$1${newContent}$3`);

            const dateRegex = /(<span id="last-updated">)(.*?)(<\/span>)/;
            if (dateRegex.test(htmlContent)) {
                htmlContent = htmlContent.replace(dateRegex, `$1${new Date().toLocaleString('tr-TR')}$3`);
            }

            fs.writeFileSync(backupFilePath, htmlContent, 'utf-8');

            return NextResponse.json({ success: true, message: 'Backup successful' });
        } else {
            return NextResponse.json({ success: false, error: 'Data script tag not found in template' }, { status: 500 });
        }

    } catch (error) {
        console.error('Backup Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
