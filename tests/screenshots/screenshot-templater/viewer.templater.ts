import fs from "node:fs";

const viewerOutput = "tests/screenshots/index.html";
const screenshotOutputDir = "tests/out/screenshots";
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
const screenshotCategories = fs.globSync(`${screenshotOutputDir}/*`).filter(path => fs.statSync(path).isDirectory());

function createViewPage() {
  const cards: string[] = [];

  // screenshotCategories.forEach(catName => {
  //   // const imgs: string[] = [];
  //   // let card = "";
  //   // let img = "";
  //   // let imgCard = "";

  //   // const thisDir = fs.readdirSync("tests/screenshots/" + catName);
  //   // thisDir.forEach(capture => {
  //   //   card = imgGroupComp.replace("{{HEADER}}", catName);

  //   //   img = imgComp.replace("{{PROJECT}}", capture);
  //   //   img = img.replace("{{SRC}}", "./" + catName + "/" + capture);
  //   //   imgCard = img.replace("{{ALT}}", capture);
  //   //   imgs.push(imgCard);
  //   // });
  //   // card = card.replace("{{IMGS}}", imgs.toString());

  //   // cards.push(card);
  // });
  console.log({ imgTemplate, imgGroupTemplate });

  for (const catName of screenshotCategories) {
    console.log({ catName });
  }

  const page = htmlLayout.replace("{{BODY}}", cards.join(""));
  fs.writeFileSync(viewerOutput, page);
}

createViewPage();