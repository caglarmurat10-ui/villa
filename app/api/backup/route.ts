import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { data } = await request.json();

        if (!data) {
            return NextResponse.json({ success: false, error: 'No data provided' }, { status: 400 });
        }

        // Path to the backup file
        const backupFilePath = path.join(process.cwd(), 'public', 'villa.html');

        if (!fs.existsSync(backupFilePath)) {
            return NextResponse.json({ success: false, error: 'Backup file not found' }, { status: 404 });
        }

        let htmlContent = fs.readFileSync(backupFilePath, 'utf-8');

        // Robust replacement using regex to find the script tag content
        // We look for <script id="villa-data" type="application/json">...</script>
        const regex = /(<script id="villa-data" type="application\/json">)([\s\S]*?)(<\/script>)/;

        if (regex.test(htmlContent)) {
            const newContent = JSON.stringify(data); // Minified JSON for storage
            htmlContent = htmlContent.replace(regex, `$1${newContent}$3`);

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
