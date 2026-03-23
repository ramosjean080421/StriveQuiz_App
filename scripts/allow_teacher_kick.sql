-- Habilitar DELETE para profesores dueños del quiz de una partida
DROP POLICY IF EXISTS "Solo profesores pueden eliminar alumnos de su sala" ON game_players;

CREATE POLICY "Solo profesores pueden eliminar alumnos de su sala" ON game_players
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM games
            JOIN quizzes ON quizzes.id = games.quiz_id
            WHERE games.id = game_players.game_id
            AND (quizzes.teacher_id = auth.uid() OR auth.jwt() ->> 'email' = ANY(quizzes.editors_emails))
        )
    );
