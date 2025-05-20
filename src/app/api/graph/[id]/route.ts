/*
import { calculatePredictedOutcome, firstNonNullValue } from '@/components/graphs/functions/graphFunctions';
import getOneGoal from '@/fetchers/getOneGoal';
import getOneRoadmap from '@/fetchers/getOneRoadmap';
import { dataSeriesDataFieldNames } from '@/types';
import sharp from 'sharp';
*/
import { NextRequest, NextResponse } from 'next/server';

/* TODO METADATA: Get rid of react-dom package as its no longer used */
/* TODO METADATA: Re add all of this once functional */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return
  /*
  const params = await props.params
  const [{ goal }] = await Promise.all([
    getOneGoal(params.id).then(async goal => { return { goal, roadmap: (goal ? await getOneRoadmap(goal.id) : null) } }),
  ]);

  if (!goal?.dataSeries) {
    return
  }

  const firstNonNullValueValue = firstNonNullValue(goal.dataSeries)
  const predictedOutcome = calculatePredictedOutcome(goal.effects, goal.baselineDataSeries || firstNonNullValue(goal.dataSeries) || 0)

  const rawData = dataSeriesDataFieldNames.map((field, index) => {
    return {
      category: field.replace('val', ''),
      malbana: goal.dataSeries?.[field],
      baseScenario: goal.baselineDataSeries ? goal.baselineDataSeries[field] : firstNonNullValueValue,
      forvantat: predictedOutcome[index].y,
    }
  })

  // Dimensions
  const width = 600;
  const offsetY = 50; // TODO: Maybe just use padding here somehow to simplify this
  const heightGraph = 200
  const heightCanvas = heightGraph + offsetY * 2;
  const padding = 40;
  const titleY = offsetY - 5; // a bit above the chart
  const stepX = (width - 2 * padding) / (rawData.length - 1); // Total distance in pixels between x value (~17.33)

  // Find min/max
  const allValues = rawData.map(d => [
    d.malbana ?? 0,
    d.baseScenario ?? 0,
    d.forvantat ?? 0,
  ]).flat()

  const minVal = Math.min(...allValues, 0);
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
      
      <text x="${10}" y="${heightCanvas / 2}" text-anchor="middle" font-size="12" fill="rgb(55, 61, 63)" transform="translate(4, 0), rotate(-90 10 ${heightCanvas / 2})" >
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

      <circle cx="${width / 2 - 135}" cy="${heightCanvas - 29}" r="5" fill="#008ffb" />
      <text x="${width / 2 - 100}" y="${heightCanvas - 25}" font-size="12" text-anchor="middle" fill="rgb(55, 61, 63)">
        Målbana
      </text>

      <circle cx="${width / 2 - 43}" cy="${heightCanvas - 29}"  r="5" fill="#00e396" />
      <text x="${width / 2}" y="${heightCanvas - 25}" font-size="12" text-anchor="middle" fill="rgb(55, 61, 63)">
        Basscenario
      </text>

      <circle cx="${width / 2 + 60}" cy="${heightCanvas - 29}" r="5" fill="#feb019" />
      <text x="${width / 2 + 110}" y="${heightCanvas - 25}" font-size="12" text-anchor="middle" fill="rgb(55, 61, 63)">
        Förväntat ufall
      </text>

      <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-size="20" fill="black" font-weight="bold">
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
  */
}
