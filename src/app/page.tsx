"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// Lista de memes populares hospedados de forma segura en nuestro propio servidor
const MEME_GIFS = Array.from({ length: 30 }, (_, i) => `/avatars/meme${i + 1}.gif`);

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");

  // --- Student State ---
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selectedGif, setSelectedGif] = useState(MEME_GIFS[0]);

  // Si envíamos el link a un alumno ?pin=ABCDEF
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get('pin');
      if (urlPin) {
        setPin(urlPin.toUpperCase());
        setActiveTab("student");
      }
    }
  }, []);

  // --- Teacher State ---
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // --- Shared State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStudentJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, status")
        .eq("pin", pin.toUpperCase())
        .single();

      if (gameError || !game) throw new Error("PIN de sala no válido o partida no encontrada.");
      if (game.status === "finished") throw new Error("La partida ya ha finalizado.");

      const { data: player, error: playerError } = await supabase
        .from("game_players")
        .insert([{ game_id: game.id, player_name: playerName, avatar_gif_url: selectedGif, current_position: 0, score: 0 }])
        .select()
        .single();

      if (playerError) throw playerError;

      localStorage.setItem("currentPlayerId", player.id);
      router.push(`/player/play/${game.id}`);
    } catch (err: any) {
      setError(err.message || "Error al intentar entrar a la sala.");
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        let authEmail = identifier.trim();

        // Si no tiene '@', asumimos que es un nombre de usuario y buscamos el correo real
        if (!authEmail.includes("@")) {
          const { data: profile, error: profileError } = await supabase
            .from("teacher_profiles")
            .select("email")
            .eq("username", authEmail.toLowerCase())
            .single();

          if (profileError || !profile) {
            throw new Error("Usuario no encontrado.");
          }
          authEmail = profile.email;
        }

        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName,
              username: username.toLowerCase().trim()
            }
          }
        });
        if (error) throw error;
        alert("¡Registro exitoso! Por favor verifica tu correo para continuar.");
      }

      router.push("/teacher/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al autenticar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans bg-gray-50">

      {/* Lado Izquierdo - Logo Gigante */}
      <div className="hidden lg:flex w-1/2 bg-white items-center justify-center relative overflow-hidden shadow-[20px_0_40px_rgba(0,0,0,0.06)] z-10 border-r border-gray-100">
        <div className="relative z-20 w-11/12 h-11/12 max-w-[800px] flex items-center justify-center">
          {/* Logo con escala masiva priorizando altura disponible */}
          <img
            src="/logo.png"
            alt="Logo Prisma Quiz"
            className="w-full h-auto max-h-[85vh] object-contain transition-transform duration-700 hover:scale-[1.02] mix-blend-multiply"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallbackText = document.getElementById('logo-fallback');
              if (fallbackText) fallbackText.style.display = 'flex';
            }}
          />
          <div id="logo-fallback" className="hidden flex-col items-center justify-center h-full w-full" style={{ display: 'none' }}>
            <h1 className="text-7xl lg:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 mb-6 drop-shadow-xl text-center leading-none">
              Prisma<br />Quiz
            </h1>
            <p className="text-2xl lg:text-3xl text-gray-400 font-bold tracking-widest text-center mt-4">JUEGA Y APRENDE</p>
          </div>
        </div>
      </div>

      {/* Lado Derecho - Formulario Híbrido */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 shrink-0 bg-gradient-to-tr from-indigo-50 via-white to-purple-50">
        <div className="max-w-[28rem] w-full space-y-5 bg-white/95 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] shadow-2xl shadow-indigo-100/60 border border-white relative">

          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500 rounded-full blur-[70px] opacity-20 pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500 rounded-full blur-[70px] opacity-20 pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight text-center">
              Bienvenido a Prisma Quiz
            </h2>

            {/* Selector de Pestañas */}
            <div className="flex mt-6 bg-gray-100/80 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => { setActiveTab("student"); setError(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "student" ? "bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.1)]" : "text-gray-500 hover:text-gray-700"}`}
              >
                🎓 Soy Estudiante
              </button>
              <button
                onClick={() => { setActiveTab("teacher"); setError(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "teacher" ? "bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.1)]" : "text-gray-500 hover:text-gray-700"}`}
              >
                👨‍🏫 Soy Profesor
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-5">
            {error && (
              <div className="bg-red-50 backdrop-blur-sm border-2 border-red-200 p-3 rounded-xl flex items-center shadow-sm mb-4">
                <span className="text-red-500 mr-2 text-xl">⚠️</span>
                <p className="text-sm text-red-700 font-bold leading-tight">{error}</p>
              </div>
            )}

            {/* FORMULARIO DE ESTUDIANTE */}
            {activeTab === "student" && (
              <form onSubmit={handleStudentJoin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">PIN de la Sala</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                    placeholder="Ej. A1B2C3"
                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-black font-mono tracking-widest text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Tu Apodo</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ej. ProGamer99"
                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex justify-between items-center uppercase tracking-wider">
                    <span>Elige tu Avatar</span>
                  </label>
                  {/* Grid Scrolleable Mágico para Avatares */}
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 pr-2 p-1 max-h-36 overflow-y-auto custom-scrollbar-avatar bg-gray-50/50 rounded-xl border border-gray-200">
                    {MEME_GIFS.map((gif, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedGif(gif)}
                        className={`cursor-pointer rounded-lg overflow-hidden border-[3px] transition-all aspect-square flex items-center justify-center bg-gray-200 shrink-0 ${selectedGif === gif
                          ? "border-emerald-400 scale-[1.15] shadow-lg shadow-emerald-300/50 z-10 rotate-3"
                          : "border-transparent hover:border-indigo-300 hover:scale-105 opacity-80 hover:opacity-100"
                          }`}
                      >
                        <img
                          src={gif}
                          alt={`Avatar Animado ${index}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !pin || !playerName}
                  className="w-full flex justify-center py-4 px-4 mt-2 border border-transparent text-sm font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all duration-300 shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 active:scale-95 uppercase tracking-wider"
                >
                  {loading ? "Conectando..." : "¡ENTRAR AL JUEGO!"}
                </button>
              </form>
            )}

            {/* FORMULARIO DE PROFESOR */}
            {activeTab === "teacher" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 font-bold text-center">
                  {isLogin ? "¿No tienes cuenta? " : "¿Ya eres parte? "}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="font-black text-indigo-600 hover:text-indigo-500 transition-colors underline decoration-indigo-200 underline-offset-4 ml-1"
                  >
                    {isLogin ? "Regístrate ahora" : "Inicia sesión"}
                  </button>
                </p>

                <form onSubmit={handleTeacherAuth} className="space-y-4">
                  {!isLogin && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          required
                          className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm shadow-inner"
                          placeholder="Tu nombre y apellido"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                          Nombre de Usuario
                        </label>
                        <input
                          type="text"
                          required
                          className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm shadow-inner lowercase"
                          placeholder="profesor_pro123"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      {isLogin ? "Usuario o Correo" : "Correo Electrónico"}
                    </label>
                    <input
                      type={isLogin ? "text" : "email"}
                      required
                      className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm shadow-inner"
                      placeholder={isLogin ? "profesor / correo@ejemplo.com" : "tu@correo.com"}
                      value={isLogin ? identifier : email}
                      onChange={(e) => isLogin ? setIdentifier(e.target.value) : setEmail(e.target.value)}
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm shadow-inner pr-10"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-lg text-gray-400 hover:text-indigo-600 transition-colors focus:outline-none"
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-4 px-4 mt-2 border border-transparent text-sm font-black uppercase tracking-wider rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all duration-300 shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 active:scale-95"
                  >
                    {loading ? "Procesando..." : (isLogin ? "Acceder al Panel" : "Crear mi cuenta")}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Scrollbar especial para el contenedor de avatares memes */
        .custom-scrollbar-avatar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar-avatar::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.05);
            border-radius: 10px;
        }
        .custom-scrollbar-avatar::-webkit-scrollbar-thumb {
            background-color: rgba(99, 102, 241, 0.4);
            border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
