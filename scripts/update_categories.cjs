const fs = require('fs');

const inputFile = 'C:\\projects\\K53ExamApp\\data\\questiondata5_mapped.json';

const controlImages = new Set([
  "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1769790677/C2_Controls_n8gfk3.png",
  "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1769791439/C3_Controls_eevskm.png",
  "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1769790677/C2_Controls111"
]);

const raw = fs.readFileSync(inputFile, 'utf-8');
const data = JSON.parse(raw);

const countsBefore = { 1: 0, 2: 0, 3: 0 };
const countsAfter = { 1: 0, 2: 0, 3: 0 };

for (const entry of data) {
  const oldCat = entry.category;
  if (countsBefore[oldCat] !== undefined) countsBefore[oldCat]++;

  if (!entry.contains_image) {
    entry.category = 1;
  } else if (controlImages.has(entry.image_link)) {
    entry.category = 3;
  } else {
    entry.category = 2;
  }

  const newCat = entry.category;
  if (countsAfter[newCat] !== undefined) countsAfter[newCat]++;
}

fs.writeFileSync(inputFile, JSON.stringify(data, null, 2), 'utf-8');

console.log('Update successful!');
console.log('Categories Before:', countsBefore);
console.log('Categories After: ', countsAfter);
