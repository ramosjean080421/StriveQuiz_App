-- Añadir columna de bloqueo a la tabla de jugadores
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
