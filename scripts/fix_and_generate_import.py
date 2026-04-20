"""
Script para generar SQL de importación con encoding corregido.
Coloca los CSV exportados de Supabase en la misma carpeta que este script
y ejecútalo con: python fix_and_generate_import.py
"""

import csv
import io
import os

def fix_encoding(text):
    """Corrige el Mojibake: texto UTF-8 leído como Latin-1"""
    if text is None or text == 'NULL' or text == 'null':
        return None
    try:
        return text.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text

def extract_inserts_from_csv(filepath):
    """Extrae los INSERT statements del CSV exportado por Supabase"""
    inserts = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i == 0:
                continue  # skip header
            if row and row[0] and row[0].strip().upper().startswith('INSERT'):
                inserts.append(row[0].strip())
    return inserts

def fix_insert(insert_sql):
    """Corrige el encoding en un INSERT statement"""
    try:
        return insert_sql.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return insert_sql

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Busca los archivos CSV
    quiz_files = []
    question_files = []

    for f in os.listdir(script_dir):
        lower = f.lower()
        if f.endswith('.csv'):
            if 'quiz' in lower and 'question' not in lower:
                quiz_files.append(os.path.join(script_dir, f))
            elif 'question' in lower:
                question_files.append(os.path.join(script_dir, f))

    if not quiz_files:
        print("ERROR: No se encontró CSV de quizzes. Renómbralo para que contenga 'quiz' en el nombre.")
        return
    if not question_files:
        print("ERROR: No se encontró CSV de questions. Renómbralo para que contenga 'question' en el nombre.")
        return

    print(f"Procesando quizzes: {quiz_files[0]}")
    print(f"Procesando questions: {question_files[0]}")

    quiz_inserts = extract_inserts_from_csv(quiz_files[0])
    question_inserts = extract_inserts_from_csv(question_files[0])

    print(f"Quizzes encontrados: {len(quiz_inserts)}")
    print(f"Questions encontradas: {len(question_inserts)}")

    output_path = os.path.join(script_dir, 'import_data.sql')

    with open(output_path, 'w', encoding='utf-8') as out:
        out.write('-- =============================================\n')
        out.write('-- STRIVEQUIZ - Import de Datos al Proyecto Nuevo\n')
        out.write('-- Ejecutar en el SQL Editor del proyecto NUEVO\n')
        out.write('-- =============================================\n\n')

        out.write('-- 1. QUIZZES\n')
        out.write('-- ===========\n')
        for insert in quiz_inserts:
            fixed = fix_insert(insert)
            out.write(fixed + '\n')

        out.write('\n-- 2. QUESTIONS\n')
        out.write('-- =============\n')
        for insert in question_inserts:
            fixed = fix_insert(insert)
            out.write(fixed + '\n')

    print(f"\n✓ Archivo generado: {output_path}")
    print("Ahora copia el contenido de import_data.sql y ejecútalo en el SQL Editor del proyecto NUEVO de Supabase.")

if __name__ == '__main__':
    main()
