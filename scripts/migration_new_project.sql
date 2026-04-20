-- =============================================
-- STRIVEQUIZ - Script de Migración Completo
-- Ejecutar en el SQL Editor del proyecto NUEVO
-- =============================================

-- 1. CREAR TABLAS
-- ===============

CREATE TABLE public.teacher_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  username text,
  full_name text,
  is_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  is_admin boolean DEFAULT false,
  CONSTRAINT teacher_profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  board_image_url text,
  board_path jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  rewards_enabled boolean DEFAULT false,
  reward_criteria integer DEFAULT 5,
  reward_text text DEFAULT '10 Puntos ClassDojo',
  shared_with_emails text[] DEFAULT '{}'::text[],
  editors_emails text[] DEFAULT '{}'::text[],
  game_mode text DEFAULT 'classic',
  ludo_teams_count integer DEFAULT 4,
  ludo_path_data jsonb,
  CONSTRAINT quizzes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_option_index integer NOT NULL,
  time_limit integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  type text DEFAULT 'multiple_choice',
  correct_answer text,
  matching_pairs jsonb,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE
);

CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  pin character varying(6) NOT NULL,
  status text DEFAULT 'waiting',
  created_at timestamp with time zone DEFAULT now(),
  game_mode text DEFAULT 'classic',
  boss_hp integer DEFAULT 0,
  boss_max_hp integer DEFAULT 0,
  auto_end boolean DEFAULT false,
  tug_of_war_offset integer DEFAULT 0,
  team_distribution_mode text DEFAULT 'random',
  streaks_enabled boolean DEFAULT true,
  game_duration integer DEFAULT 0,
  question_duration integer DEFAULT 20,
  bonus_time_per_match integer,
  started_at timestamp with time zone,
  bomb_holder_id text,
  current_question_index integer DEFAULT 0,
  roulette_state text DEFAULT 'idle',
  roulette_target_player_id text,
  roulette_question_index integer DEFAULT 0,
  roulette_spin_seed double precision DEFAULT 0,
  open_answer_text text,
  word_game_state jsonb,
  CONSTRAINT games_pkey PRIMARY KEY (id),
  CONSTRAINT games_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE
);

CREATE TABLE public.game_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  player_name text NOT NULL,
  avatar_gif_url text NOT NULL,
  score integer DEFAULT 0,
  current_position integer DEFAULT 0,
  joined_at timestamp with time zone DEFAULT now(),
  correct_answers integer DEFAULT 0,
  incorrect_answers integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  damage_dealt integer DEFAULT 0,
  team_id integer DEFAULT 0,
  secret_token uuid DEFAULT gen_random_uuid(),
  is_blocked boolean DEFAULT false,
  last_answer jsonb,
  CONSTRAINT game_players_pkey PRIMARY KEY (id),
  CONSTRAINT game_players_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);

CREATE TABLE public.game_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  player_id uuid NOT NULL,
  question_id uuid NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_responses_pkey PRIMARY KEY (id),
  CONSTRAINT game_responses_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE,
  CONSTRAINT game_responses_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.game_players(id) ON DELETE CASCADE,
  CONSTRAINT game_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE
);

-- 2. HABILITAR RLS
-- ================

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_responses ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS
-- ================

-- teacher_profiles
CREATE POLICY "Public profiles are viewable by everyone." ON public.teacher_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.teacher_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.teacher_profiles FOR UPDATE USING ((auth.uid() = id) OR ((SELECT tp.is_admin FROM teacher_profiles tp WHERE tp.id = auth.uid()) = true));
CREATE POLICY "Admins pueden eliminar profesores" ON public.teacher_profiles FOR DELETE USING (EXISTS (SELECT 1 FROM teacher_profiles tp WHERE tp.id = auth.uid() AND tp.is_admin = true));

-- quizzes
CREATE POLICY "Dueños pueden hacer todo" ON public.quizzes FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Profesores pueden ver sus propios quizzes y compartidos" ON public.quizzes FOR SELECT USING ((auth.uid() = teacher_id) OR ((auth.jwt() ->> 'email') = ANY (shared_with_emails)));
CREATE POLICY "Dueños y editores pueden modificar quizzes" ON public.quizzes FOR UPDATE USING ((auth.uid() = teacher_id) OR ((auth.jwt() ->> 'email') = ANY (editors_emails)));
CREATE POLICY "Editores pueden ver" ON public.quizzes FOR SELECT USING ((auth.jwt() ->> 'email') = ANY (shared_with_emails));
CREATE POLICY "Editores pueden actualizar" ON public.quizzes FOR UPDATE USING ((auth.jwt() ->> 'email') = ANY (editors_emails));
CREATE POLICY "Cualquiera puede leer tableros" ON public.quizzes FOR SELECT USING (true);

-- questions
CREATE POLICY "Acceso a preguntas basado en acceso al quiz" ON public.questions FOR SELECT USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = questions.quiz_id AND ((quizzes.teacher_id = auth.uid()) OR ((auth.jwt() ->> 'email') = ANY (quizzes.shared_with_emails)))));
CREATE POLICY "Edición de preguntas solo para dueños y editores" ON public.questions FOR ALL USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = questions.quiz_id AND ((quizzes.teacher_id = auth.uid()) OR ((auth.jwt() ->> 'email') = ANY (quizzes.editors_emails)))));
CREATE POLICY "Students can read active game questions" ON public.questions FOR SELECT USING (EXISTS (SELECT 1 FROM games WHERE games.quiz_id = questions.quiz_id AND games.status = 'active'));

-- games
CREATE POLICY "Cualquiera puede leer juegos para unirse" ON public.games FOR SELECT USING (true);
CREATE POLICY "Teacher full access to own games" ON public.games FOR ALL USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = games.quiz_id AND quizzes.teacher_id = auth.uid()));
CREATE POLICY "Students can update boss hp" ON public.games FOR UPDATE USING (true);
CREATE POLICY "Solo dueños/editores pueden gestionar partidas" ON public.games FOR ALL USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = games.quiz_id AND ((quizzes.teacher_id = auth.uid()) OR ((auth.jwt() ->> 'email') = ANY (quizzes.editors_emails)))));

-- game_players
CREATE POLICY "Permitir unión anónima" ON public.game_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Ver otros jugadores de la sala" ON public.game_players FOR SELECT USING (true);
CREATE POLICY "Protección Anti-Trampas" ON public.game_players FOR UPDATE USING (true);
CREATE POLICY "Permitir borrar jugadores" ON public.game_players FOR DELETE USING (true);
CREATE POLICY "Permitir al profesor administrar sus jugadores" ON public.game_players FOR ALL USING (EXISTS (SELECT 1 FROM (games JOIN quizzes ON (games.quiz_id = quizzes.id)) WHERE games.id = game_players.game_id AND quizzes.teacher_id = auth.uid()));
CREATE POLICY "Solo profesores pueden eliminar alumnos de su sala" ON public.game_players FOR DELETE USING (EXISTS (SELECT 1 FROM (games JOIN quizzes ON (quizzes.id = games.quiz_id)) WHERE games.id = game_players.game_id AND ((quizzes.teacher_id = auth.uid()) OR ((auth.jwt() ->> 'email') = ANY (quizzes.editors_emails)))));

-- game_responses
CREATE POLICY "Alumnos envían sus respuestas" ON public.game_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert respuestas" ON public.game_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Read respuestas" ON public.game_responses FOR SELECT USING (true);
CREATE POLICY "Solo profesores ven el heatmap" ON public.game_responses FOR SELECT USING (EXISTS (SELECT 1 FROM (games JOIN quizzes ON (quizzes.id = games.quiz_id)) WHERE games.id = game_responses.game_id AND ((quizzes.teacher_id = auth.uid()) OR ((auth.jwt() ->> 'email') = ANY (quizzes.shared_with_emails)))));

-- 4. HABILITAR REALTIME
-- =====================

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_profiles;

-- 5. REPLICA IDENTITY (para eventos DELETE en Realtime)
-- ======================================================

ALTER TABLE public.game_players REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
