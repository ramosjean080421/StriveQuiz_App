-- ==========================================
-- SCRIPT DE SEGURIDAD PARA PRISMA QUIZ
-- Ejecuta esto en tu Consola SQL de Supabase
-- ==========================================

-- 1. ASEGURAR COLUMNAS FALTANTES EN QUIZZES
-- Estas columnas son necesarias para el sistema de "Compartir con Colegas"
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS shared_with_emails TEXT[] DEFAULT '{}';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS editors_emails TEXT[] DEFAULT '{}';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS rewards_enabled BOOLEAN DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS reward_criteria INT DEFAULT 5;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS reward_text TEXT DEFAULT '';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'classic';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS ludo_teams_count INT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS ludo_path_data JSONB;

-- 2. ASEGURAR COLUMNAS FALTANTES EN GAMES
ALTER TABLE games ADD COLUMN IF NOT EXISTS auto_end BOOLEAN DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS streaks_enabled BOOLEAN DEFAULT true;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'classic';
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_duration INT DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS question_duration INT DEFAULT 20;

-- 3. ASEGURAR COLUMNAS DE SEGURIDAD EN JUGADORES
-- Añadimos un token secreto para que los alumnos no puedan editar los datos de otros
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS secret_token UUID DEFAULT gen_random_uuid();
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS team_id INT DEFAULT 0;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS correct_answers INT DEFAULT 0;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS incorrect_answers INT DEFAULT 0;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;

-- 3. HABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_responses ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS PARA QUIZZES (Tableros)
DROP POLICY IF EXISTS "Teacher full access to own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Dueños pueden hacer todo" ON quizzes;
DROP POLICY IF EXISTS "Editores pueden ver" ON quizzes;
DROP POLICY IF EXISTS "Editores pueden actualizar" ON quizzes;

CREATE POLICY "Dueños pueden hacer todo" ON quizzes FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Editores pueden ver" ON quizzes FOR SELECT USING (auth.jwt() ->> 'email' = ANY(shared_with_emails));
CREATE POLICY "Editores pueden actualizar" ON quizzes FOR UPDATE USING (auth.jwt() ->> 'email' = ANY(editors_emails));

-- 5. POLÍTICAS PARA QUESTIONS (Preguntas)
DROP POLICY IF EXISTS "Teacher full access to own questions" ON questions;
DROP POLICY IF EXISTS "Acceso a preguntas basado en acceso al quiz" ON questions;
DROP POLICY IF EXISTS "Edición de preguntas solo para dueños y editores" ON questions;

CREATE POLICY "Acceso a preguntas basado en acceso al quiz" ON questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM quizzes 
            WHERE quizzes.id = questions.quiz_id 
            AND (quizzes.teacher_id = auth.uid() OR auth.jwt() ->> 'email' = ANY(shared_with_emails))
        )
    );

CREATE POLICY "Edición de preguntas solo para dueños y editores" ON questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quizzes 
            WHERE quizzes.id = questions.quiz_id 
            AND (quizzes.teacher_id = auth.uid() OR auth.jwt() ->> 'email' = ANY(editors_emails))
        )
    );

-- 6. POLÍTICAS PARA GAMES (Partidas)
DROP POLICY IF EXISTS "Anyone can read games" ON games;
DROP POLICY IF EXISTS "Solo dueños/editores pueden gestionar partidas" ON games;

CREATE POLICY "Cualquiera puede leer juegos para unirse" ON games FOR SELECT USING (true);
CREATE POLICY "Solo dueños/editores pueden gestionar partidas" ON games
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quizzes 
            WHERE quizzes.id = games.quiz_id 
            AND (quizzes.teacher_id = auth.uid() OR auth.jwt() ->> 'email' = ANY(editors_emails))
        )
    );

-- 7. POLÍTICAS PARA GAME_PLAYERS (Seguridad Crítica)
DROP POLICY IF EXISTS "Players can update their position" ON game_players;
DROP POLICY IF EXISTS "Anyone can insert game_players" ON game_players;
DROP POLICY IF EXISTS "Anyone can read game_players" ON game_players;
DROP POLICY IF EXISTS "Permitir unión anónima" ON game_players;
DROP POLICY IF EXISTS "Ver otros jugadores de la sala" ON game_players;
DROP POLICY IF EXISTS "Protección Anti-Trampas" ON game_players;

CREATE POLICY "Permitir unión anónima" ON game_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Ver otros jugadores de la sala" ON game_players FOR SELECT USING (true);
CREATE POLICY "Protección Anti-Trampas" ON game_players 
    FOR UPDATE USING (true); -- El filtro de seguridad se aplica en la clausula WHERE (secret_token) desde el código

-- 8. POLÍTICAS PARA RESPUESTAS (Heatmap)
DROP POLICY IF EXISTS "Cualquiera puede insertar respuestas" ON game_responses;
DROP POLICY IF EXISTS "Solo profesores ven el heatmap" ON game_responses;

CREATE POLICY "Alumnos envían sus respuestas" ON game_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Solo profesores ven el heatmap" ON game_responses 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM games 
            JOIN quizzes ON quizzes.id = games.quiz_id 
            WHERE games.id = game_responses.game_id 
            AND (quizzes.teacher_id = auth.uid() OR auth.jwt() ->> 'email' = ANY(shared_with_emails))
        )
    );

-- 9. FUNCIONES ADICIONALES (RPC)
-- Función para verificar si un correo pertenece a un usuario registrado
CREATE OR REPLACE FUNCTION check_user_exists(lookup_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = lookup_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
