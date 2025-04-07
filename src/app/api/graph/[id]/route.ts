import getOneGoal from '@/fetchers/getOneGoal';
import getOneRoadmap from '@/fetchers/getOneRoadmap';
import { NextRequest, NextResponse } from 'next/server';

/* TODO: Get rid of react-dom package as its no longer used */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const [{goal}] = await Promise.all([
    getOneGoal(params.id).then(async goal => { return { goal, roadmap: (goal ? await getOneRoadmap(goal.id) : null) } }),
  ]);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Canvas Image for ${id}</title>
      </head>
      <body>
        <canvas id="myCanvas" width="300" height="150" style="border:1px solid #000;"></canvas>
        <script>
          const canvas = document.getElementById('myCanvas');
          const ctx = canvas.getContext('2d');

          ctx.fillStyle = 'lightyellow';
          ctx.fillRect(0, 0, 300, 150);

          ctx.fillStyle = 'black';
          ctx.font = '20px sans-serif';
          ctx.fillText('Name: ${goal?.name}', 100, 75);
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
