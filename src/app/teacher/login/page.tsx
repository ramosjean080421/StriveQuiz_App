"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TeacherLogin() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });
                if (error) throw error;
                alert("¡Registro exitoso! Por favor verifica tu correo para continuar.");
            }

            router.push("/teacher/dashboard");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Ocurrió un error.");
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
        <div className="flex min-h-screen font-sans bg-gray-50">
            {/* Lado Izquierdo - Logo (Blanco) */}
            <div className="hidden lg:flex w-1/2 bg-white items-center justify-center p-12 relative overflow-hidden z-10">
                {/* Elemento decorativo de fondo */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 blur-3xl opacity-50"></div>

                <div className="text-center relative z-20">
                    <img
                        src="/logo.png"
                        alt="Logo StriveQuiz"
                        className="w-full max-w-[320px] mx-auto object-contain transition-transform duration-700 hover:scale-105"
                        onError={(e) => {
                            // Fallback temporal si el usuario aún no coloca el archivo logo.png
                            e.currentTarget.style.display = 'none';
                            const fallbackText = document.getElementById('logo-fallback');
                            if (fallbackText) fallbackText.style.display = 'block';
                        }}
                    />
                    <div id="logo-fallback" className="hidden" style={{ display: 'none' }}>
                        <h1 className="text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 mb-4">
                            StriveQuiz
                        </h1>
                        <p className="text-xl text-gray-400 font-medium tracking-wide">Plataforma Educativa Gamificada</p>
                    </div>
                </div>
            </div>

            {/* Lado Derecho - Formulario (Moderno/Vibrante) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-gradient-to-tr from-indigo-50 via-white to-purple-50">
                <div className="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-xl p-10 sm:p-14 rounded-[2rem] border border-white/50 relative overflow-hidden">

                    {/* Decoración dentro de la tarjeta */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-20 pointer-events-none"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500 rounded-full blur-[60px] opacity-20 pointer-events-none"></div>

                    <div className="relative z-10">
                        <Link href="/" className="inline-flex items-center text-sm font-bold text-indigo-500 hover:text-indigo-700 transition-colors mb-6 group">
                            <span className="transform group-hover:-translate-x-1 transition-transform mr-2">&larr;</span> Volver al inicio
                        </Link>

                        <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                            {isLogin ? "Bienvenido de nuevo" : "Crea tu cuenta"}
                        </h2>
                        <p className="mt-3 text-sm text-gray-500">
                            {isLogin ? "¿No tienes cuenta en StriveQuiz? " : "¿Ya eres parte de StriveQuiz? "}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors underline decoration-indigo-200 underline-offset-4"
                            >
                                {isLogin ? "Regístrate ahora" : "Inicia sesión"}
                            </button>
                        </p>
                    </div>

                    <form className="mt-8 space-y-6 relative z-10" onSubmit={handleAuth}>
                        {error && (
                            <div className="bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 p-4 rounded-xl flex items-center">
                                <span className="text-red-500 mr-3 text-lg">⚠️</span>
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <div className="space-y-5">
                            {!isLogin && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1 pointer-events-none">
                                        Nombre Completo
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="block w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
                                        placeholder="Tu nombre y apellido"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 pointer-events-none">
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    required
                                    className="block w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
                                    placeholder="tu@correo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="relative">
                                <label className="block text-sm font-semibold text-gray-700 mb-1 pointer-events-none">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="block w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm pr-12"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-lg text-gray-400 hover:text-indigo-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? "🙈" : "👁️"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-4 px-4 border border-transparent text-base font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Procesando...
                                    </span>
                                ) : (
                                    isLogin ? "Acceder al Panel" : "Crear mi cuenta"
                                )}
                            </button>
                        </div>

                        <div className="mt-6 flex items-center justify-center">
                            <div className="border-t border-gray-200 flex-grow"></div>
                            <span className="px-4 text-sm font-bold text-gray-400 uppercase tracking-widest">
                                O entra con
                            </span>
                            <div className="border-t border-gray-200 flex-grow"></div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full flex justify-center items-center gap-3 py-4 px-4 border-2 border-gray-100 text-base font-bold rounded-2xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all duration-300 transform hover:-translate-y-0.5"
                        >
                            <svg className="w-6 h-6" viewBox="0 0 24 24">
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
            </div>
            <p className="fixed bottom-3 right-4 text-xs text-gray-400 select-none z-50">2026</p>
        </div>
    );
}
