import fs from "node:fs";

const viewPage = fs.readFileSync("tests/screenshotViewer/screenshotViewer.html").toString();
const cardComponent = fs.readFileSync("tests/screenshotViewer/components/card.html").toString();
const imgComponent = fs.readFileSync("tests/screenshotViewer/components/img.html").toString();
const screenshotDirs = fs.readdirSync("tests/screenshots");

function createViewPage() {
  let page;

  const cards = [""];

  screenshotDirs.forEach(catName => {
    let card = "";

    let img = "";
    let imgCard = "";
    const imgCards = [""];

    const thisDir = fs.readdirSync("tests/screenshots/" + catName);
    thisDir.forEach(capture => {
      card = cardComponent.replace("{{HEADER}}", catName);

      img = imgComponent.replace("{{PROJECT}}", capture);
      img = img.replace("{{SRC}}", "./" + catName + "/" + capture);
      imgCard = img.replace("{{ALT}}", capture);
      imgCards.push(imgCard);
    });
    card = card.replace("{{IMGS}}", imgCards.toString());

    cards.push(card);
  });
  page = viewPage.replace("{{BODY}}", cards.toString());
  page = page.replaceAll(",", "");
  fs.writeFileSync("tests/screenshots/index.html", page);
}

createViewPage();