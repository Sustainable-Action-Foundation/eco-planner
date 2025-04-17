import getOneGoal from '@/fetchers/getOneGoal';
import getOneRoadmap from '@/fetchers/getOneRoadmap';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/* TODO: Get rid of react-dom package as its no longer used */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const [{goal}] = await Promise.all([
    getOneGoal(params.id).then(async goal => { return { goal, roadmap: (goal ? await getOneRoadmap(goal.id) : null) } }),
  ]);

  // Hardcoded CSV data
  const rawData = [
    { category: '2020', malbana: 1, baseScenario: 1, forvantat: 2 },
    { category: '2021', malbana: 2, baseScenario: 1, forvantat: 3 },
    { category: '2022', malbana: 3, baseScenario: 1, forvantat: 4 },
    { category: '2023', malbana: 4, baseScenario: 1, forvantat: 5 },
    { category: '2024', malbana: 5, baseScenario: 1, forvantat: 6 },
    { category: '2025', malbana: 6, baseScenario: 1, forvantat: 7 },
    { category: '2026', malbana: 7, baseScenario: 1, forvantat: 8 },
    { category: '2027', malbana: 8, baseScenario: 1, forvantat: 9 },
    { category: '2028', malbana: 9, baseScenario: 1, forvantat: 10 },
    { category: '2029', malbana: 10, baseScenario: 1, forvantat: 11 },
    { category: '2030', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2031', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2032', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2033', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2034', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2035', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2036', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2037', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2038', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2039', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2040', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2041', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2042', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2043', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2044', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2045', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2046', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2047', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2048', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2049', malbana: 0, baseScenario: 1, forvantat: 1 },
    { category: '2050', malbana: 0, baseScenario: 1, forvantat: 1 },
  ]

  // Dimensions
  const width = 600;
  const offsetY = 50;
  const heightGraph = 300
  const heightCanvas = heightGraph + offsetY * 2;
  const padding = 40;
  const titleY = offsetY - 5; // a bit above the chart
  const stepX = (width - 2 * padding) / (rawData.length - 1);

  // Find min/max
  const allValues = rawData.flatMap(d => [d.malbana, d.forvantat]);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valueRange = maxVal - minVal || 1;

  const scaleY = (v: number) =>
    offsetY + padding + (1 - (v - minVal) / valueRange) * (heightGraph - 2 * padding);

  // Convert to polyline points
  const pointsMalbana = rawData.map((d, i) =>
    `${padding + i * stepX},${scaleY(d.malbana)}`
  ).join(' ');

  const pointsBase = rawData.map((d, i) =>
    `${padding + i * stepX},${scaleY(d.baseScenario)}`
  ).join(' ');


  const pointsForvantat = rawData.map((d, i) =>
    `${padding + i * stepX},${scaleY(d.forvantat)}`
  ).join(' ');

  // Construct SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${heightCanvas}">
      <style>
        text {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          font-weight: 600;
          text-transform: capitalize;
         }
      </style>
      <polyline points="${pointsMalbana}" fill="none" stroke="#008ffb" stroke-width="3"/>
      <polyline points="${pointsForvantat}" fill="none" stroke="#00e396" stroke-width="3"/>
      <polyline points="${pointsBase}" fill="none" stroke="#feb019" stroke-width="3"/>
      
      <text x="${width/2 - 100}" y="${heightCanvas - 25}" font-size="10" text-anchor="middle" fill="#008ffb">
        Målbana
      </text>
      <text x="${width/2}" y="${heightCanvas - 25}" font-size="10" text-anchor="middle" fill="#00e396">
        Basscenario
      </text>
      <text x="${width/2 + 100}" y="${heightCanvas - 25}" font-size="10" text-anchor="middle" fill="#feb019">
        Förväntat ufall
      </text>
      <text x="${width/2}" y="${titleY}" text-anchor="middle" font-size="20" fill="black">
        Målbana 
      </text>
    </svg>
  `;

  // Render to PNG
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length.toString(),
    },
  });
}
