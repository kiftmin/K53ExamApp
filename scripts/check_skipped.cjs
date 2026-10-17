const fs = require('fs');
const path = require('path');

// Configuration - can be overridden via command line arguments
const CONFIG = {
    startNumber: 485,
    category: 1,
    licenseCode: "00",
    inputFile: 'freek_questions_raw.txt',
    outputFile: 'freek_questions_checked.json'
};

// Parse command line arguments
process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    if (key && value) {
        if (key === 'startNumber') CONFIG.startNumber = parseInt(value, 10);
        else if (key === 'category') CONFIG.category = parseInt(value, 10);
        else if (key === 'licenseCode') CONFIG.licenseCode = value;
    }
});

// Read the raw file with error handling
const rawFilePath = path.join(__dirname, '..', 'data', CONFIG.inputFile);
let rawContent;
try {
    rawContent = fs.readFileSync(rawFilePath, 'utf-8');
} catch (err) {
    console.error(`Error reading file "${rawFilePath}": ${err.message}`);
    process.exit(1);
}

// Normalize line endings
rawContent = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const skipped = [];
const converted = [];
const startNumber = CONFIG.startNumber;

// Pattern to find all question blocks
const questionPattern = /###\s*\*?Question\s*(\d+)(?:\s*\(Revised\))?\*?\s*\n([\s\S]*?)(?=\n---\n|\n###\s*\*?Question\s*\d|$)/g;

let match;
while ((match = questionPattern.exec(rawContent)) !== null) {
    const questionNum = match[1];
    const questionBlock = match[2].trim();

    // Skip thank you notes and very short content
    if (questionBlock.includes('Thank you for providing') || questionBlock.length < 30) {
        skipped.push({ num: questionNum, reason: 'Too short or thank you note' });
        continue;
    }

    // Extract question text (bold text)
    const questionTextMatch = questionBlock.match(/\*\*([^*]+)\*\*/);
    let questionText = questionTextMatch ? questionTextMatch[1].trim() : '';

    if (!questionText) {
        skipped.push({ num: questionNum, reason: 'No question text found (no bold text)' });
        continue;
    }

    // Remove the question text from the block
    let remainingBlock = questionBlock.replace(questionTextMatch[0], '').trim();

    // Check for image
    const imageMatch = remainingBlock.match(/\[Image:[^\]]+\]/);
    const containsImage = imageMatch !== null;

    // Extract correct answer - use consistent pattern for both formats
    const answerPattern = /^Answer:\s*([A-Ca-c])\.\s*([^*.\n][^*.\n]*)/im;
    const answerMatch = remainingBlock.match(/\*\*Answer:\*\*\s*\*\*?([A-Ca-c])\.\s*([^**]+?)\*\*?/i) ||
        remainingBlock.match(answerPattern);

    let correctAnswer = '';
    if (answerMatch) {
        correctAnswer = answerMatch[1].toUpperCase();
    }

    // Extract options
    const options = [];
    const lines = remainingBlock.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        const optionMatch = trimmed.match(/^([A-Ca-c])[.)]\s+(.+)$/);

        if (optionMatch) {
            const answerLetter = optionMatch[1].toUpperCase();
            let answerText = optionMatch[2].trim();

            // Skip the answer line - check both with and without asterisks
            if (trimmed.includes('**Answer:**') || trimmed.startsWith('Answer:') ||
                trimmed.match(/\*\*Answer/i) || trimmed.match(/^Answer:/i)) {
                continue;
            }

            // Skip note lines - more flexible matching
            if (answerText.startsWith('*(Note:') || answerText.startsWith('(Note:') ||
                answerText.includes('*(Note:') || answerText.includes('(Note:')) {
                continue;
            }

            // Clean up answer text - handle multiple asterisks
            answerText = answerText.replace(/\*\*+$/, '').trim();

            if (answerText && answerText.length > 0) {
                options.push({
                    answer_number: answerLetter,
                    answer_text: answerText,
                    correct_answer: answerLetter === correctAnswer
                });
            }
        }
    }

    // Check for duplicate note
    const isDuplicate = remainingBlock.includes('duplicate') ||
        remainingBlock.includes('repeat') ||
        remainingBlock.includes('This is a repeat');

    // Clean up question text
    questionText = questionText.replace(/\s+/g, ' ').trim();

    if (!(questionText && options.length >= 2)) {
        skipped.push({
            num: questionNum,
            reason: `Only ${options.length} options found (need at least 2)`,
            questionText: questionText.substring(0, 50)
        });
        continue;
    }

    converted.push({
        question_number: startNumber + converted.length,
        question_text: questionText,
        category: CONFIG.category,
        license_code: CONFIG.licenseCode,
        contains_image: containsImage,
        image_link: null,
        options: options,
        is_duplicate: isDuplicate,
        is_official: false,
        source_id: null
    });
}

console.log('=== SKIPPED QUESTIONS ===');
console.log('Total skipped:', skipped.length);
console.log('');

for (const s of skipped) {
    console.log(`Q${s.num}: ${s.reason}`);
    if (s.questionText) {
        console.log(`   Text: ${s.questionText}...`);
    }
}

console.log('\n=== CONVERSION SUMMARY ===');
console.log(`Total converted: ${converted.length}`);
console.log(`Question numbers: ${converted.length > 0 ? converted[0].question_number : 'N/A'} to ${converted.length > 0 ? converted[converted.length - 1].question_number : 'N/A'}`);

// Write results to output file
const outputPath = path.join(__dirname, '..', 'data', CONFIG.outputFile);
try {
    fs.writeFileSync(outputPath, JSON.stringify({ converted, skipped }, null, 2));
    console.log(`\nResults written to: ${outputPath}`);
} catch (err) {
    console.error(`Error writing output file: ${err.message}`);
    process.exit(1);
}
