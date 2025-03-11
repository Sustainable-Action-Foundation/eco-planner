import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lng = searchParams.get('lng');
    const ns = searchParams.get('ns');

    // Validate parameters
    if (!lng || !ns) {
      return NextResponse.json(
        { error: 'Missing required parameters: lng and ns' },
        { status: 400 }
      );
    }

    // Sanitize parameters to prevent directory traversal
    const sanitizedLng = lng.replace(/[^a-zA-Z0-9-]/g, '');
    const sanitizedNs = ns.replace(/[^a-zA-Z0-9-_]/g, '');

    // Define the path to the locale file
    const filePath = path.join(
      process.cwd(),
      'public',
      'locales',
      sanitizedLng,
      `${sanitizedNs}.json`
    );

    console.debug(filePath);

    // Read the file
    const fileContent = await fs.readFile(filePath, 'utf8');
    const localeData = JSON.parse(fileContent);

    // Return the locale data with caching headers
    return NextResponse.json(localeData, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error loading locale file:', error);

    // Check if file not found
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'Locale file not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to load locale file' },
      { status: 500 }
    );
  }
}