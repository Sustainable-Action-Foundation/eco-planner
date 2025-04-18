import { calculatePredictedOutcome, firstNonNullValue } from '@/components/graphs/functions/graphFunctions';
import getOneGoal from '@/fetchers/getOneGoal';
import getOneRoadmap from '@/fetchers/getOneRoadmap';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/* TODO: Get rid of react-dom package as its no longer used */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
 
  const [{goal}] = await Promise.all([
    getOneGoal(params.id).then(async goal => { return { goal, roadmap: (goal ? await getOneRoadmap(goal.id) : null) } }),
  ]);

  let predictedOutcome: ReturnType <typeof calculatePredictedOutcome> = [];
  predictedOutcome.length = 31 
  let firstNonNullValueValue;
  if (goal?.dataSeries) {
    firstNonNullValueValue = firstNonNullValue(goal?.dataSeries)
    predictedOutcome = calculatePredictedOutcome(goal?.effects, goal?.baselineDataSeries || firstNonNullValue(goal?.dataSeries) || 0)
  }

  // TODO: Add external datasets?
  const rawData = [ 
    { category: '2020', malbana: goal?.dataSeries?.val2020, baseScenario: goal?.baselineDataSeries?.val2020 || firstNonNullValueValue, forvantat: predictedOutcome[0]?.y },
    { category: '2021', malbana: goal?.dataSeries?.val2021, baseScenario: goal?.baselineDataSeries?.val2021 || firstNonNullValueValue, forvantat: predictedOutcome[1]?.y },
    { category: '2022', malbana: goal?.dataSeries?.val2022, baseScenario: goal?.baselineDataSeries?.val2022 || firstNonNullValueValue, forvantat: predictedOutcome[2]?.y },
    { category: '2023', malbana: goal?.dataSeries?.val2023, baseScenario: goal?.baselineDataSeries?.val2023 || firstNonNullValueValue, forvantat: predictedOutcome[3]?.y },
    { category: '2024', malbana: goal?.dataSeries?.val2024, baseScenario: goal?.baselineDataSeries?.val2024 || firstNonNullValueValue, forvantat: predictedOutcome[4]?.y },
    { category: '2025', malbana: goal?.dataSeries?.val2025, baseScenario: goal?.baselineDataSeries?.val2025 || firstNonNullValueValue, forvantat: predictedOutcome[5]?.y },
    { category: '2026', malbana: goal?.dataSeries?.val2026, baseScenario: goal?.baselineDataSeries?.val2026 || firstNonNullValueValue, forvantat: predictedOutcome[6]?.y },
    { category: '2027', malbana: goal?.dataSeries?.val2027, baseScenario: goal?.baselineDataSeries?.val2027 || firstNonNullValueValue, forvantat: predictedOutcome[7]?.y },
    { category: '2028', malbana: goal?.dataSeries?.val2028, baseScenario: goal?.baselineDataSeries?.val2028 || firstNonNullValueValue, forvantat: predictedOutcome[8]?.y },
    { category: '2029', malbana: goal?.dataSeries?.val2029, baseScenario: goal?.baselineDataSeries?.val2029 || firstNonNullValueValue, forvantat: predictedOutcome[9]?.y },
    { category: '2030', malbana: goal?.dataSeries?.val2030, baseScenario: goal?.baselineDataSeries?.val2030 || firstNonNullValueValue, forvantat: predictedOutcome[10]?.y },
    { category: '2031', malbana: goal?.dataSeries?.val2031, baseScenario: goal?.baselineDataSeries?.val2031 || firstNonNullValueValue, forvantat: predictedOutcome[11]?.y },
    { category: '2032', malbana: goal?.dataSeries?.val2032, baseScenario: goal?.baselineDataSeries?.val2032 || firstNonNullValueValue, forvantat: predictedOutcome[12]?.y },
    { category: '2033', malbana: goal?.dataSeries?.val2033, baseScenario: goal?.baselineDataSeries?.val2033 || firstNonNullValueValue, forvantat: predictedOutcome[13]?.y },
    { category: '2034', malbana: goal?.dataSeries?.val2034, baseScenario: goal?.baselineDataSeries?.val2034 || firstNonNullValueValue, forvantat: predictedOutcome[14]?.y },
    { category: '2035', malbana: goal?.dataSeries?.val2034, baseScenario: goal?.baselineDataSeries?.val2035 || firstNonNullValueValue, forvantat: predictedOutcome[15]?.y },
    { category: '2036', malbana: goal?.dataSeries?.val2036, baseScenario: goal?.baselineDataSeries?.val2036 || firstNonNullValueValue, forvantat: predictedOutcome[16]?.y },
    { category: '2037', malbana: goal?.dataSeries?.val2037, baseScenario: goal?.baselineDataSeries?.val2037 || firstNonNullValueValue, forvantat: predictedOutcome[17]?.y },
    { category: '2038', malbana: goal?.dataSeries?.val2038, baseScenario: goal?.baselineDataSeries?.val2038 || firstNonNullValueValue, forvantat: predictedOutcome[18]?.y },
    { category: '2039', malbana: goal?.dataSeries?.val2039, baseScenario: goal?.baselineDataSeries?.val2039 || firstNonNullValueValue, forvantat: predictedOutcome[19]?.y },
    { category: '2040', malbana: goal?.dataSeries?.val2040, baseScenario: goal?.baselineDataSeries?.val2040 || firstNonNullValueValue, forvantat: predictedOutcome[20]?.y },
    { category: '2041', malbana: goal?.dataSeries?.val2041, baseScenario: goal?.baselineDataSeries?.val2041 || firstNonNullValueValue, forvantat: predictedOutcome[21]?.y },
    { category: '2042', malbana: goal?.dataSeries?.val2042, baseScenario: goal?.baselineDataSeries?.val2042 || firstNonNullValueValue, forvantat: predictedOutcome[22]?.y },
    { category: '2043', malbana: goal?.dataSeries?.val2043, baseScenario: goal?.baselineDataSeries?.val2043 || firstNonNullValueValue, forvantat: predictedOutcome[23]?.y },
    { category: '2044', malbana: goal?.dataSeries?.val2044, baseScenario: goal?.baselineDataSeries?.val2044 || firstNonNullValueValue, forvantat: predictedOutcome[24]?.y },
    { category: '2045', malbana: goal?.dataSeries?.val2045, baseScenario: goal?.baselineDataSeries?.val2045 || firstNonNullValueValue, forvantat: predictedOutcome[25]?.y },
    { category: '2046', malbana: goal?.dataSeries?.val2046, baseScenario: goal?.baselineDataSeries?.val2046 || firstNonNullValueValue, forvantat: predictedOutcome[26]?.y },
    { category: '2047', malbana: goal?.dataSeries?.val2047, baseScenario: goal?.baselineDataSeries?.val2047 || firstNonNullValueValue, forvantat: predictedOutcome[27]?.y },
    { category: '2048', malbana: goal?.dataSeries?.val2048, baseScenario: goal?.baselineDataSeries?.val2048 || firstNonNullValueValue, forvantat: predictedOutcome[28]?.y },
    { category: '2049', malbana: goal?.dataSeries?.val2049, baseScenario: goal?.baselineDataSeries?.val2049 || firstNonNullValueValue, forvantat: predictedOutcome[29]?.y },
    { category: '2050', malbana: goal?.dataSeries?.val2050, baseScenario: goal?.baselineDataSeries?.val2050 || firstNonNullValueValue, forvantat: predictedOutcome[30]?.y },
  ]

  // Dimensions
  const width = 600;
  const offsetY = 50; // TODO: Maybe just use padding here somehow to simplify this
  const heightGraph = 200
  const heightCanvas = heightGraph + offsetY * 2;
  const padding = 40;
  const titleY = offsetY - 5; // a bit above the chart
  const stepX = (width - 2 * padding) / (rawData.length - 1); // Total distance in pixels between x value (~17.33)

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
         }
      </style>
      <rect width="100%" height="100%" fill="white"/>
      
      <text x="${10}" y="${heightCanvas/2}" text-anchor="middle" font-size="12" fill="rgb(55, 61, 63)" transform="translate(4, 0), rotate(-90 10 ${heightCanvas/2})" >
        ${goal?.dataSeries?.unit} 
      </text>
      
      <polyline points="${pointsBase}" fill="none" stroke="#00e396" stroke-width="1"/>
      <polyline points="${pointsMalbana}" fill="none" stroke="#008ffb" stroke-width="1"/>
      <polyline points="${pointsForvantat}" fill="none" stroke="#feb019" stroke-width="1"/>

      <line x1="40" y1="90" x2="560" y2="90" stroke="rgb(182, 182, 182)" stroke-width="1" />
      <text x="${30}" y="${93}" text-anchor="middle" font-size="10" fill="rgb(55, 61, 63)" >
        ${maxVal}
      </text>
      
      <line x1="40" y1="120" x2="560" y2="120" stroke="rgb(182, 182, 182)" stroke-width="1" />
      <text x="${38}" y="${123}" text-anchor="end" font-size="10" fill="rgb(55, 61, 63)" >
        ${((maxVal - minVal) / 4) * 3}
      </text>

      <line x1="40" y1="150" x2="560" y2="150" stroke="rgb(182, 182, 182)" stroke-width="1" />
      <text x="${38}" y="${153}" text-anchor="end" font-size="10" fill="rgb(55, 61, 63)" >
        ${((maxVal - minVal) / 4) * 2}
      </text>

      <line x1="40" y1="180" x2="560" y2="180" stroke="rgb(182, 182, 182)" stroke-width="1" />
      <text x="${38}" y="${183}" text-anchor="end" font-size="10" fill="rgb(55, 61, 63)" >
        ${((maxVal - minVal) / 4)}
      </text>

      <line x1="40" y1="210" x2="560" y2="210" stroke="rgb(182, 182, 182)" stroke-width="1" />
      <text x="${30}" y="${213}" text-anchor="middle" font-size="10" fill="rgb(55, 61, 63)" >
        ${minVal}
      </text>
      <text x="${40}" y="${230}" text-anchor="middle" font-size="10" fill="rgb(55, 61, 63)" >
        2020
      </text>
      <text x="${213}" y="${230}" text-anchor="middle" font-size="10" fill="rgb(55, 61, 63)" >
        2030
      </text>
      <text x="${386}" y="${230}" text-anchor="middle" font-size="10" fill="rgb(55, 61, 63)" >
        2040
      </text>
      <text x="${560}" y="${230}" text-anchor="middle" font-size="10" fill="rgb(55, 61, 63)" >
        2050
      </text>

      <circle cx="${width/2 - 135}" cy="${heightCanvas - 29}" r="5" fill="#008ffb" />
      <text x="${width/2 - 100}" y="${heightCanvas - 25}" font-size="12" text-anchor="middle" fill="rgb(55, 61, 63)">
        Målbana
      </text>

      <circle cx="${width/2 - 43}" cy="${heightCanvas - 29}"  r="5" fill="#00e396" />
      <text x="${width/2}" y="${heightCanvas - 25}" font-size="12" text-anchor="middle" fill="rgb(55, 61, 63)">
        Basscenario
      </text>

      <circle cx="${width/2 + 60}" cy="${heightCanvas - 29}" r="5" fill="#feb019" />
      <text x="${width/2 + 110}" y="${heightCanvas - 25}" font-size="12" text-anchor="middle" fill="rgb(55, 61, 63)">
        Förväntat ufall
      </text>

      <text x="${width/2}" y="${titleY}" text-anchor="middle" font-size="20" fill="black" font-weight="bold">
        ${goal?.name?.charAt(0).toUpperCase() + String(goal?.name).slice(1)} 
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
