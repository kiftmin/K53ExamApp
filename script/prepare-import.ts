import fs from 'fs/promises';
import { InsertQuestion, Option } from '../shared/schema.js';

async function prepareImport() {
    const sourceFilePath = './data/questiondata5_imp2.txt';
    const targetFilePath = './data/questiondata5_mapped.json';

    try {
        console.log(`Reading source file: ${sourceFilePath}`);
        const rawData = await fs.readFile(sourceFilePath, 'utf-8');
        // Handle potential BOM and parse JSON
        const data = JSON.parse(rawData.replace(/^\uFEFF/, ''));

        console.log(`Mapping ${data.length} records starting from question number 237...`);

        let currentQuestionNumber = 237;

        const mappedQuestions: InsertQuestion[] = data.map((item: any) => {
            // Determine if image exists
            const hasImage = item.ImageUrl && item.ImageUrl !== 'NULL' && item.ImageUrl.trim() !== '';
            
            // Map options
            let options: Option[] = [];
            try {
                const sourceAnswers = JSON.parse(item.TestAnswer);
                options = sourceAnswers.map((ans: any, index: number) => ({
                    answer_number: String.fromCharCode(65 + index), // A, B, C...
                    answer_text: ans.AnswerText,
                    correct_answer: ans.IsCorrect
                }));
            } catch (err) {
                console.warn(`Failed to parse TestAnswer for record Id ${item.Id}`);
            }

            const mapped = {
                question_number: currentQuestionNumber,
                question_text: item.Tq || '',
                category: parseInt(item.CategoryId) || 0,
                license_code: item.VehicleCodeId || '00',
                contains_image: !!hasImage,
                image_link: hasImage ? item.ImageUrl : null,
                options: options,
                is_duplicate: false,
                is_official: false,
                source_id: null
            };

            currentQuestionNumber++;
            return mapped;
        });

        console.log(`Writing mapped data to: ${targetFilePath}`);
        await fs.writeFile(targetFilePath, JSON.stringify(mappedQuestions, null, 2));
        console.log('Done!');

    } catch (error) {
        console.error('Error during data preparation:', error);
        process.exit(1);
    }
}

prepareImport();
