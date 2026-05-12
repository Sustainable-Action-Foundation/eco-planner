import fs from "node:fs";

const viewerOutput = "tests/out/index.html";
const screenshotOutputDir = "tests/out/screenshots";
const distRelOutput = "./screenshots";
const workingDir = "tests/screenshots";
const layoutPath = `${workingDir}/screenshot-templater/viewer.layout.html`;
const imgPath = `${workingDir}/screenshot-templater/components/img.html`;
const imgGroupPath = `${workingDir}/screenshot-templater/components/img-group.html`;

if (
  !fs.existsSync(workingDir)
  || !fs.existsSync(layoutPath)
  || !fs.existsSync(imgPath)
  || !fs.existsSync(imgGroupPath)
) {
  console.error("Required files or directories are missing. Please ensure the following exist:");
  console.error(`- Directory: ${workingDir}`);
  console.error(`- Layout template: ${layoutPath}`);
  console.error(`- Image component template: ${imgPath}`);
  console.error(`- Image group component template: ${imgGroupPath}`);
  process.exit(1);
}

const htmlLayout = fs.readFileSync(layoutPath, "utf-8");
const imgTemplate = fs.readFileSync(imgPath, "utf-8");
const imgGroupTemplate = fs.readFileSync(imgGroupPath, "utf-8");
const screenshotCategories = fs.globSync(`${screenshotOutputDir}/*`).filter(path => fs.statSync(path).isDirectory()).map(path => path.split("/").pop() || "");

function createViewPage() {
  const cards: string[] = [];

  for (const catName of screenshotCategories) {
    const page = fs.globSync(`${screenshotOutputDir}/${catName}/*`).filter(path => fs.statSync(path).isFile()).map(path => path.split("/").pop() || "");
    const imgs = page.map(img =>
      imgTemplate
        .replace("{{PROJECT}}", img)
        .replace("{{SRC}}", `${distRelOutput}/${catName}/${img}`)
        .replace("{{ALT}}", img),
    ).join("");
    const card = imgGroupTemplate
      .replace("{{HEADER}}", catName)
      .replace("{{IMGS}}", imgs);
    cards.push(card);
  }

  const page = htmlLayout.replace("{{BODY}}", cards.join(""));
  fs.writeFileSync(viewerOutput, page);
}

createViewPage();