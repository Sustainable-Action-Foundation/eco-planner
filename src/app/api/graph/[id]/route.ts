import getOneGoal from '@/fetchers/getOneGoal';
import getOneRoadmap from '@/fetchers/getOneRoadmap';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/* TODO: Get rid of react-dom package as its no longer used */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
 
  const [{goal}] = await Promise.all([
    getOneGoal(params.id).then(async goal => { return { goal, roadmap: (goal ? await getOneRoadmap(goal.id) : null) } }),
  ]);
 
  
  // TODO: Add external datasets?
  const rawData = [
    { category: '2020', malbana: goal?.dataSeries?.val2020, baseScenario: goal?.baselineDataSeries?.val2020, forvantat: 2 },
    { category: '2021', malbana: goal?.dataSeries?.val2021, baseScenario: goal?.baselineDataSeries?.val2021, forvantat: 3 },
    { category: '2022', malbana: goal?.dataSeries?.val2022, baseScenario: goal?.baselineDataSeries?.val2022, forvantat: 4 },
    { category: '2023', malbana: goal?.dataSeries?.val2023, baseScenario: goal?.baselineDataSeries?.val2023, forvantat: 5 },
    { category: '2024', malbana: goal?.dataSeries?.val2024, baseScenario: goal?.baselineDataSeries?.val2024, forvantat: 6 },
    { category: '2025', malbana: goal?.dataSeries?.val2025, baseScenario: goal?.baselineDataSeries?.val2025, forvantat: 7 },
    { category: '2026', malbana: goal?.dataSeries?.val2026, baseScenario: goal?.baselineDataSeries?.val2026, forvantat: 8 },
    { category: '2027', malbana: goal?.dataSeries?.val2027, baseScenario: goal?.baselineDataSeries?.val2027, forvantat: 9 },
    { category: '2028', malbana: goal?.dataSeries?.val2028, baseScenario: goal?.baselineDataSeries?.val2028, forvantat: 10 },
    { category: '2029', malbana: goal?.dataSeries?.val2029, baseScenario: goal?.baselineDataSeries?.val2029, forvantat: 11 },
    { category: '2030', malbana: goal?.dataSeries?.val2030, baseScenario: goal?.baselineDataSeries?.val2030, forvantat: 1 },
    { category: '2031', malbana: goal?.dataSeries?.val2031, baseScenario: goal?.baselineDataSeries?.val2031, forvantat: 1 },
    { category: '2032', malbana: goal?.dataSeries?.val2032, baseScenario: goal?.baselineDataSeries?.val2032, forvantat: 1 },
    { category: '2033', malbana: goal?.dataSeries?.val2033, baseScenario: goal?.baselineDataSeries?.val2033, forvantat: 1 },
    { category: '2034', malbana: goal?.dataSeries?.val2034, baseScenario: goal?.baselineDataSeries?.val2034, forvantat: 1 },
    { category: '2035', malbana: goal?.dataSeries?.val2034, baseScenario: goal?.baselineDataSeries?.val2035, forvantat: 1 },
    { category: '2036', malbana: goal?.dataSeries?.val2036, baseScenario: goal?.baselineDataSeries?.val2036, forvantat: 1 },
    { category: '2037', malbana: goal?.dataSeries?.val2037, baseScenario: goal?.baselineDataSeries?.val2037, forvantat: 1 },
    { category: '2038', malbana: goal?.dataSeries?.val2038, baseScenario: goal?.baselineDataSeries?.val2038, forvantat: 1 },
    { category: '2039', malbana: goal?.dataSeries?.val2039, baseScenario: goal?.baselineDataSeries?.val2039, forvantat: 1 },
    { category: '2040', malbana: goal?.dataSeries?.val2040, baseScenario: goal?.baselineDataSeries?.val2040, forvantat: 1 },
    { category: '2041', malbana: goal?.dataSeries?.val2041, baseScenario: goal?.baselineDataSeries?.val2041, forvantat: 1 },
    { category: '2042', malbana: goal?.dataSeries?.val2042, baseScenario: goal?.baselineDataSeries?.val2042, forvantat: 1 },
    { category: '2043', malbana: goal?.dataSeries?.val2043, baseScenario: goal?.baselineDataSeries?.val2043, forvantat: 1 },
    { category: '2044', malbana: goal?.dataSeries?.val2044, baseScenario: goal?.baselineDataSeries?.val2044, forvantat: 1 },
    { category: '2045', malbana: goal?.dataSeries?.val2045, baseScenario: goal?.baselineDataSeries?.val2045, forvantat: 1 },
    { category: '2046', malbana: goal?.dataSeries?.val2046, baseScenario: goal?.baselineDataSeries?.val2046, forvantat: 1 },
    { category: '2047', malbana: goal?.dataSeries?.val2047, baseScenario: goal?.baselineDataSeries?.val2047, forvantat: 1 },
    { category: '2048', malbana: goal?.dataSeries?.val2048, baseScenario: goal?.baselineDataSeries?.val2048, forvantat: 1 },
    { category: '2049', malbana: goal?.dataSeries?.val2049, baseScenario: goal?.baselineDataSeries?.val2049, forvantat: 1 },
    { category: '2050', malbana: goal?.dataSeries?.val2050, baseScenario: goal?.baselineDataSeries?.val2050, forvantat: 1 },
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
  const allValues = rawData.flatMap(d => [
    d.malbana ?? 0,
    d.baseScenario ?? 0,
    d.forvantat ?? 0,
  ]);

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valueRange = maxVal - minVal || 1;

  const scaleY = (v: number) =>
    offsetY + padding + (1 - (v - minVal) / valueRange) * (heightGraph - 2 * padding);

  const pointsMalbana = rawData.map((d, i) =>
    `${padding + i * stepX},${scaleY(d.malbana ?? 0)}`
  ).join(' ');

  const pointsBase = rawData.map((d, i) =>
    `${padding + i * stepX},${scaleY(d.baseScenario ?? 0)}`
  ).join(' ');


  const pointsForvantat = rawData.map((d, i) =>
    `${padding + i * stepX},${scaleY(d.forvantat ?? 0)}`
  ).join(' ');

  // Construct SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${heightCanvas}" >
      <style>
        text {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          font-weight: 600;
          text-transform: capitalize;
         }
      </style>
      <rect width="100%" height="100%" fill="white"/>

      <polyline points="${pointsMalbana}" fill="none" stroke="#008ffb" stroke-width="3"/>
      <polyline points="${pointsForvantat}" fill="none" stroke="#feb019" stroke-width="3"/>
      <polyline points="${pointsBase}" fill="none" stroke="#00e396" stroke-width="3"/>
      
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
