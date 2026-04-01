import fs from "node:fs"
import path, { dirname } from "node:path"


const viewPage = fs.readFileSync("tests/screenshotViewer/screenshotViewer.html").toString();
const cardComponent = fs.readFileSync("tests/screenshotViewer/components/card.html").toString();
const imgComponent = fs.readFileSync("tests/screenshotViewer/components/img.html").toString();
const screenshotDirs = fs.readdirSync("tests/screenshots");



function createViewPage() {
  let page = "";

  let head = "";
  let card = "";
  let cards = [""];

  let img = "";
  let imgCard = "";
  let imgs = [""];

  screenshotDirs.forEach(catName => {

    head = cardComponent.replace("{{HEADER}}", catName);

    const thisDir = fs.readdirSync("tests/screenshots/" + catName);
    thisDir.forEach(picture => {
      img = imgComponent.replace("{{SRC}}", "../screenshots/" + catName + "/" + picture);
      imgCard = img.replace("{{ALT}}", picture);
      imgs.push(imgCard);
    });
    card = head.replace("{{IMGS}}", imgs.toString())

    // card = card.replaceAll(",", "")
    cards.push(card)
  });
  page = viewPage.replace("{{BODY}}", cards.toString())
  page = page.replaceAll(",", "")
  fs.writeFileSync("tests/screenshotViewer/screenshotViewPage.html", page)
}

createViewPage();



fs.globSync("tests/screenshots/**/*.jpeg")