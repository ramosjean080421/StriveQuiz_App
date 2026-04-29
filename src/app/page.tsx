"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

function MeshGradient() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10 bg-white">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[120px] animate-mesh-1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-200/40 rounded-full blur-[120px] animate-mesh-2" />
      <div className="absolute top-[20%] right-[10%] w-[35%] h-[35%] bg-pink-100/40 rounded-full blur-[100px] animate-mesh-3" />
      <div className="absolute bottom-[10%] left-[20%] w-[30%] h-[30%] bg-blue-100/40 rounded-full blur-[100px] animate-mesh-4" />
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");

  // --- Student State ---
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [showNameTooltip, setShowNameTooltip] = useState(false);
  const [shuffledMemes, setShuffledMemes] = useState<string[]>([]);
  const [selectedGif, setSelectedGif] = useState("");
  const [waitingGameId, setWaitingGameId] = useState<string | null>(null);

  useEffect(() => {
    const loadAvatars = async () => {
      try {
        const res = await fetch("/api/avatars");
        const data = await res.json();
        if (data.avatars && data.avatars.length > 0) {
          setShuffledMemes(prev => {
            const currentUrls = new Set(data.avatars);
            const filteredPrev = prev.filter(url => currentUrls.has(url));
            const prevUrls = new Set(filteredPrev);
            const newItems = data.avatars.filter((url: string) => !prevUrls.has(url));
            
            if (newItems.length > 0 || filteredPrev.length !== prev.length) {
              return [...newItems.sort(() => Math.random() - 0.5), ...filteredPrev];
            }
            return prev;
          });
          setSelectedGif(prev => prev || data.avatars[0]);
        }
      } catch (err) {
        console.error("Error loading avatars:", err);
      }
    };
    
    loadAvatars();
    const interval = setInterval(loadAvatars, 30000); // Polling cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get('pin');
      if (urlPin) {
        setPin(urlPin.toUpperCase());
        setActiveTab("student");
      }
      
      if (urlParams.get('kicked') === 'true') {
        setActiveTab("student");
        setError("⚠️ Has sido expulsado de la sala (Posible nombre duplicado o interacción detectada). Por favor vuelve a ingresar.");
        window.history.replaceState({}, document.title, "/");
        sessionStorage.removeItem("isKicked");
      }
    }
  }, []);

  useEffect(() => {
    if (!waitingGameId) return;

    const playerId = sessionStorage.getItem("currentPlayerId");
    if (!playerId) return;

    const channel = supabase.channel(`waiting_room_${playerId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'game_players', 
        filter: `game_id=eq.${waitingGameId}` 
      }, (payload) => {
        if (payload.new.id === playerId) {
          if (payload.new.current_position >= 0) {
             router.push(`/player/play/${waitingGameId}`);
          } else if (payload.new.current_position === -999) {
             setError("No se te permitió el ingreso.");
             setWaitingGameId(null);
             isJoiningRef.current = false;
          }
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${waitingGameId}`
      }, (payload) => {
        if (payload.old.id === playerId) {
           setError("No se te permitió el ingreso.");
           setWaitingGameId(null);
           isJoiningRef.current = false;
        }
      })
      .subscribe();

    const intervalId = setInterval(async () => {
      const { data, error } = await supabase
        .from("game_players")
        .select("current_position")
        .eq("id", playerId); 
        
      if (error) return;

      if (!data || data.length === 0) {
         setError("No se te permitió el ingreso.");
         setWaitingGameId(null);
         isJoiningRef.current = false;
      } else {
         const player = data[0];
         if (player.current_position >= 0) {
            router.push(`/player/play/${waitingGameId}`);
         } else if (player.current_position === -999) {
            setError("No se te permitió el ingreso.");
            setWaitingGameId(null);
            isJoiningRef.current = false;
         }
      }
    }, 2000);

    const handleBeforeUnload = () => {
        fetch('/api/leave_game', {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [waitingGameId, router]);

  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean, title: string, message: string } | null>(null);
  const isJoiningRef = useRef(false);

  const handleStudentJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJoiningRef.current) return;
    isJoiningRef.current = true;
    setError(null);

    const trimmedName = playerName.trim().replace(/\s+/g, ' ');

    if (trimmedName.split(/\s+/).length < 2) {
      setError("Debes colocar al menos tu nombre y un apellido.");
      isJoiningRef.current = false;
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
      if (game.status !== "waiting") throw new Error("No puedes ingresar, la partida ya ha iniciado o finalizado.");

      const { data: playersFound } = await supabase
        .from("game_players")
        .select("id")
        .eq("game_id", game.id)
        .ilike("player_name", trimmedName);

      const existingPlayer = playersFound && playersFound.length > 0 ? playersFound[0] : null;

      const savedPlayerId = sessionStorage.getItem("currentPlayerId");

      if (existingPlayer) {
        if (savedPlayerId === existingPlayer.id) {
          router.push(`/player/play/${game.id}`);
          return;
        }
        throw new Error("Ya hay un alumno con ese nombre en esta sala.");
      }

      const { data: player, error: playerError } = await supabase
        .from("game_players")
        .insert([{ game_id: game.id, player_name: trimmedName, avatar_gif_url: selectedGif, current_position: -100, score: 0 }])
        .select()
        .single();

      if (playerError) throw playerError;

      sessionStorage.setItem("currentPlayerId", player.id);
      setWaitingGameId(game.id);
    } catch (err: any) {
      setError(err.message || "Error al entrar a la sala.");
      isJoiningRef.current = false;
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
        if (!authEmail.includes("@")) {
          const { data: profile, error: profileError } = await supabase
            .from("teacher_profiles")
            .select("email")
            .eq("username", authEmail.toLowerCase())
            .single();

          if (profileError || !profile) throw new Error("Usuario no encontrado.");
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
            data: { full_name: fullName, username: username.toLowerCase().trim() }
          }
        });
        if (error) throw error;
        setSuccessModal({ isOpen: true, title: "¡Registro Exitoso! 📧", message: "Revisa tu correo para verificar tu cuenta." });
        return;
      }
      router.push("/teacher/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al autenticar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/teacher/dashboard` }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Error al conectar con Google.");
    }
  };

  return (
    <div className="flex min-h-screen lg:h-screen w-screen overflow-x-hidden font-sans bg-white relative">
      <MeshGradient />
      
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden z-10 border-r border-gray-100/50"
      >
        <p className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-gray-300 font-light italic z-20 opacity-60 select-none">
          Creado y dedicado para Elizabeth Guevara <span className="not-italic">♥</span>
        </p>
        <div className="relative z-20 w-11/12 h-11/12 max-w-[800px] flex items-center justify-center">
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
            src="/logotransparente.png"
            alt="Logo StriveQuiz"
            className="w-full h-auto max-h-[85vh] object-contain transition-transform duration-700 hover:scale-[1.02]"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      </motion.div>
 
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 shrink-0 bg-transparent"
      >
        <div className="max-w-[28rem] w-full space-y-5 bg-white/70 backdrop-blur-2xl p-6 sm:p-8 rounded-[2.5rem] border border-white/50 shadow-2xl shadow-indigo-100/50 relative">
          <div className="relative z-10">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight text-center">Bienvenido a StriveQuiz</h2>
            {!waitingGameId && (
              <div className="flex mt-6 bg-gray-100/80 rounded-xl p-1">
                <button
                  onClick={() => { setActiveTab("student"); setError(null); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "student" ? "bg-white text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
                >🎓 Soy Estudiante</button>
                <button
                  onClick={() => { setActiveTab("teacher"); setError(null); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "teacher" ? "bg-white text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
                >👨‍🏫 Soy Profesor</button>
              </div>
            )}
          </div>

          <div className="relative z-10 mt-5">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 p-3 rounded-xl flex items-center mb-4">
                <span className="text-red-500 mr-2 text-xl">⚠️</span>
                <p className="text-sm text-red-700 font-bold leading-tight">{error}</p>
              </div>
            )}

            {activeTab === "student" && waitingGameId && (
              <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                 <span className="text-6xl animate-bounce-short">⏳</span>
                 <h3 className="text-2xl font-black text-indigo-900 tracking-tight">Esperando aprobación</h3>
              </div>
            )}

            {activeTab === "student" && !waitingGameId && (
              <form onSubmit={handleStudentJoin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">PIN Sala</label>
                  <input
                    type="text" required maxLength={6} value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-black font-mono tracking-widest text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">Tu Nombre</label>
                  <input
                    type="text" required maxLength={40} value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex justify-between items-center uppercase">
                    <span>Avatar</span>
                    <button type="button" onClick={() => setShuffledMemes([...shuffledMemes].sort(() => Math.random() - 0.5))} className="text-[10px] text-indigo-500 font-black">🔄 Aleatorio</button>
                  </label>
                  <div className="grid grid-cols-5 gap-2 p-1 max-h-36 overflow-y-auto bg-gray-50/50 rounded-xl border border-gray-200 custom-scrollbar-avatar">
                    {shuffledMemes.map((gif, index) => (
                      <div key={index} onClick={() => setSelectedGif(gif)} className={`cursor-pointer rounded-lg overflow-hidden border-[3px] transition-all aspect-square flex items-center justify-center ${selectedGif === gif ? "border-emerald-400 scale-110 z-10" : "border-transparent opacity-80"}`}>
                        <img src={gif} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all active:scale-95 uppercase tracking-wider">
                  {loading ? "Conectando..." : "¡ENTRAR!"}
                </button>
              </form>
            )}

            {activeTab === "teacher" && (
              <form onSubmit={handleTeacherAuth} className="space-y-4">
                {!isLogin && (
                  <>
                    <input type="text" required placeholder="Nombre Completo" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold text-sm" />
                    <input type="text" required placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold text-sm lowercase" />
                  </>
                )}
                <input type={isLogin ? "text" : "email"} required placeholder={isLogin ? "Usuario o Correo" : "Correo"} value={isLogin ? identifier : email} onChange={(e) => isLogin ? setIdentifier(e.target.value) : setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold text-sm" />
                <input type={showPassword ? "text" : "password"} required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold text-sm" />
                <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all uppercase tracking-wider">
                  {loading ? "..." : (isLogin ? "Acceder" : "Registrar")}
                </button>
                <div className="flex items-center gap-2 py-2">
                  <div className="h-px bg-gray-200 flex-grow" />
                  <span className="text-[10px] font-bold text-gray-400">O ENTRA CON</span>
                  <div className="h-px bg-gray-200 flex-grow" />
                </div>
                <button type="button" onClick={handleGoogleLogin} className="w-full flex justify-center py-3 border-2 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all">Google</button>
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-xs font-bold text-indigo-600 underline text-center">{isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}</button>
              </form>
            )}
          </div>
        </div>
      </motion.div>

      <style jsx global>{`
        @keyframes mesh-1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20%, 15%); } }
        @keyframes mesh-2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-20%, -10%); } }
        @keyframes mesh-3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-10%, 20%); } }
        @keyframes mesh-4 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(15%, -15%); } }
        .animate-mesh-1 { animation: mesh-1 20s infinite; }
        .animate-mesh-2 { animation: mesh-2 25s infinite; }
        .animate-mesh-3 { animation: mesh-3 18s infinite; }
        .animate-mesh-4 { animation: mesh-4 22s infinite; }
        .custom-scrollbar-avatar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-avatar::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 10px; }
      `}</style>
      <p className="fixed bottom-3 right-4 text-xs text-gray-400 select-none">2026</p>
    </div>
  );
}
