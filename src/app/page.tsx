"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");

  // --- Student State ---
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [shuffledMemes, setShuffledMemes] = useState<string[]>([]);
  const [selectedGif, setSelectedGif] = useState("");

  useEffect(() => {
    const loadAvatars = async () => {
      try {
        const res = await fetch("/api/avatars");
        const data = await res.json();
        if (data.avatars && data.avatars.length > 0) {
          const shuffled = [...data.avatars].sort(() => Math.random() - 0.5);
          setShuffledMemes(shuffled);
          setSelectedGif(shuffled[0]);
        }
      } catch (err) {
        console.error("Error loading avatars:", err);
      }
    };
    loadAvatars();
  }, []);

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
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean, title: string, message: string } | null>(null);

  const handleStudentJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validación de nombre y apellido
    const trimmedName = playerName.trim();
    if (trimmedName.split(/\s+/).length < 2) {
      setError("Debes colocar al menos tu nombre y un apellido.");
      return;
    }

    // Filtro básico anti-groserías
    const BAD_WORDS = ["puta", "puto", "mierd", "pendej", "cabron", "cabrón", "coño", "zorra", "perra", "idiot", "estupid", "estúpid", "imbecil", "imbécil", "maricon", "maricón"];
    const nameLower = trimmedName.toLowerCase();
    if (BAD_WORDS.some(word => nameLower.includes(word))) {
      setError("Por favor, usa un nombre apropiado y respetuoso.");
      return;
    }

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
            emailRedirectTo: `${window.location.origin}/teacher/dashboard`,
            data: {
              full_name: fullName,
              username: username.toLowerCase().trim()
            }
          }
        });
        if (error) throw error;
        setSuccessModal({
          isOpen: true,
          title: "¡Registro Exitoso! 📧",
          message: "Hemos enviado un enlace de verificación a tu correo. Por favor, revísalo (y mira en Spam si no lo ves) para activar tu cuenta de profesor."
        });
        return; // Detener flujo para no redirigir ni refrescar
      }

      router.push("/teacher/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al autenticar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          redirectTo: `${window.location.origin}/teacher/dashboard`
        }
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Error al conectar con Google.");
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans bg-gray-50">

      {/* Lado Izquierdo - Logo Gigante */}
      <div className="hidden lg:flex w-1/2 bg-white items-center justify-center relative overflow-hidden z-10 border-r border-gray-100">
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
            <h1 className="text-7xl lg:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 mb-6 text-center leading-none">
              Prisma<br />Quiz
            </h1>
            <p className="text-2xl lg:text-3xl text-gray-400 font-bold tracking-widest text-center mt-4">JUEGA Y APRENDE</p>
          </div>
        </div>
      </div>

      {/* Lado Derecho - Formulario Híbrido */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 shrink-0 bg-gradient-to-tr from-indigo-50 via-white to-purple-50">
        <div className="max-w-[28rem] w-full space-y-5 bg-white/95 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] border border-white relative">

          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500 rounded-full blur-[70px] opacity-20 pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500 rounded-full blur-[70px] opacity-20 pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight text-center">
              Bienvenido a Prisma Quiz
            </h2>

            {/* Selector de Pestañas */}
            <div className="flex mt-6 bg-gray-100/80 rounded-xl p-1">
              <button
                onClick={() => { setActiveTab("student"); setError(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "student" ? "bg-white text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                🎓 Soy Estudiante
              </button>
              <button
                onClick={() => { setActiveTab("teacher"); setError(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "teacher" ? "bg-white text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                👨‍🏫 Soy Profesor
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-5">
            {error && (
              <div className="bg-red-50 backdrop-blur-sm border-2 border-red-200 p-3 rounded-xl flex items-center mb-4">
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
                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-black font-mono tracking-widest text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Tu Nombre</label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex justify-between items-center uppercase tracking-wider">
                    <span>Elige tu Avatar</span>
                    <button
                      type="button"
                      onClick={() => setShuffledMemes([...shuffledMemes].sort(() => Math.random() - 0.5))}
                      className="text-[10px] text-indigo-500 hover:text-indigo-700 font-black flex items-center gap-1"
                    >
                      <span>🔄</span> Aleatorio
                    </button>
                  </label>
                  {/* Grid Scrolleable Mágico para Avatares */}
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 pr-2 p-1 max-h-36 overflow-y-auto custom-scrollbar-avatar bg-gray-50/50 rounded-xl border border-gray-200">
                    {shuffledMemes.map((gif, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedGif(gif)}
                        className={`cursor-pointer rounded-lg overflow-hidden border-[3px] transition-all aspect-square flex items-center justify-center bg-gray-200 shrink-0 ${selectedGif === gif
                          ? "border-emerald-400 scale-[1.15] z-10 rotate-3"
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
                  className="w-full flex justify-center py-4 px-4 mt-2 border border-transparent text-sm font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 active:scale-95 uppercase tracking-wider"
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
                          className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
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
                          className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm lowercase"
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
                      className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
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
                        className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm pr-10"
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
                    className="w-full flex justify-center py-4 px-4 mt-2 border border-transparent text-sm font-black uppercase tracking-wider rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                  >
                    {loading ? "Procesando..." : (isLogin ? "Acceder al Panel" : "Crear mi cuenta")}
                  </button>

                  <div className="mt-6 flex items-center justify-center">
                    <div className="border-t border-gray-200 flex-grow"></div>
                    <span className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      O entra con
                    </span>
                    <div className="border-t border-gray-200 flex-grow"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex justify-center items-center gap-3 py-3 px-4 border-2 border-gray-100 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                    Google
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

      {/* MODAL DE ÉXITO PREMIUM */}
      {successModal && successModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full transform transition-all animate-bounce-short text-center border border-white/20 relative overflow-hidden">
            {/* Decoración de fondo del modal */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>

            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 rotate-3">
                <span className="text-4xl text-white">📮</span>
              </div>

              <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
                {successModal.title}
              </h3>

              <p className="text-gray-500 font-medium leading-relaxed mb-8">
                {successModal.message}
              </p>

              <button
                onClick={() => setSuccessModal(null)}
                className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm"
              >
                Entendido, lo revisaré
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
