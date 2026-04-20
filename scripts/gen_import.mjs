import { readFileSync, writeFileSync } from 'fs';

/**
 * Parses a CSV file that may contain multiline fields (RFC 4180).
 * Returns an array of rows, where each row is an array of field strings.
 */
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row = [];
    // Parse one row
    while (i < n) {
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < n) {
          if (text[i] === '"') {
            if (i + 1 < n && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i++];
          }
        }
        row.push(field);
      } else {
        // Unquoted field
        let field = '';
        while (i < n && text[i] !== ',' && text[i] !== '\n') {
          if (text[i] !== '\r') field += text[i];
          i++;
        }
        row.push(field);
      }
      // After field: comma means next field, newline/end means end of row
      if (i < n && text[i] === ',') {
        i++; // next field
      } else {
        break; // end of row
      }
    }
    // Skip newline
    if (i < n && text[i] === '\r') i++;
    if (i < n && text[i] === '\n') i++;

    rows.push(row);
  }
  return rows;
}

function extractInserts(csv) {
  const rows = parseCSV(csv);
  const inserts = [];
  for (let i = 1; i < rows.length; i++) { // skip header row
    const row = rows[i];
    if (!row || !row[0]) continue;
    const cell = row[0].trim();
    if (cell.toUpperCase().startsWith('INSERT')) {
      inserts.push(cell);
    }
  }
  return inserts;
}

const quizCSV = readFileSync('quizzes_export.csv', 'utf8');
const qCSV = readFileSync('questions_export.csv', 'utf8');

const quizInserts = extractInserts(quizCSV);
const allQuestionInserts = extractInserts(qCSV);

// Extract quiz IDs from the quiz inserts
const quizIds = new Set(quizInserts.map(ins => {
  const match = ins.match(/VALUES \('([0-9a-f-]{36})'/i);
  return match ? match[1] : null;
}).filter(Boolean));

console.log('Quiz IDs exported:', [...quizIds]);

// Only keep questions whose quiz_id is in the exported quizzes
const questionInserts = allQuestionInserts.filter(ins => {
  const match = ins.match(/VALUES \('([0-9a-f-]{36})',\s*'([0-9a-f-]{36})'/i);
  return match && quizIds.has(match[2]);
});

console.log('Questions filtered out:', allQuestionInserts.length - questionInserts.length);

let sql = '-- STRIVEQUIZ Import Data\n\n';
sql += '-- QUIZZES\n';
quizInserts.forEach(i => { sql += i + '\n'; });
sql += '\n-- QUESTIONS\n';
questionInserts.forEach(i => { sql += i + '\n'; });

writeFileSync('import_data.sql', sql, 'utf8');
console.log('Quizzes:', quizInserts.length);
console.log('Questions:', questionInserts.length);
console.log('Generado: import_data.sql');
