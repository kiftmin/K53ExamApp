import { db, questions } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function verify() {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(questions);
    console.log(`Total questions in DB: ${result.count}`);
    
    const [lastQ] = await db.select().from(questions).orderBy(sql`question_number DESC`).limit(1);
    if (lastQ) {
        console.log(`Last Question Number: ${lastQ.question_number}`);
    }
    
    process.exit(0);
}

verify();
