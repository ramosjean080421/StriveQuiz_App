"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: "success" | "error" } | null>(null);

    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);

    // Form fields
    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/");
                return;
            }
            setUser(user);
            setEmail(user.email || "");

            // Fetch public profile if exists
            const { data: prof } = await supabase.from("teacher_profiles").select("*").eq("id", user.id).single();
            if (prof) {
                setProfile(prof);
                setFullName(prof.full_name || "");
                setUsername(prof.username || "");
            } else {
                setFullName(user.user_metadata?.full_name || "");
                setUsername(user.user_metadata?.username || "");
            }
            setLoading(false);
        };
        loadProfile();
    }, [router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            // Update Profile Table
            if (profile) {
                const { error: profErr } = await supabase.from("teacher_profiles").update({
                    full_name: fullName,
                    username: username.toLowerCase().trim()
                }).eq("id", user.id);
                if (profErr) throw profErr;
            } else {
                // Si el perfil no existía (usuario antiguo)
                const { error: insertErr } = await supabase.from("teacher_profiles").insert({
                    id: user.id,
                    email: user.email,
                    full_name: fullName,
                    username: username.toLowerCase().trim()
                });
                if (insertErr) throw insertErr;
                setProfile(true);
            }

            // Update user metadata
            await supabase.auth.updateUser({
                data: { full_name: fullName, username: username.toLowerCase().trim() }
            });

            // Update Email / Password Auth settings
            let needsEmailVerification = false;

            if (email !== user.email || password.length > 0) {
                const updatePayload: any = {};
                if (email !== user.email) updatePayload.email = email;
                if (password.length > 0) updatePayload.password = password;

                const { error: authErr } = await supabase.auth.updateUser(updatePayload);
                if (authErr) throw authErr;

                if (email !== user.email) needsEmailVerification = true;
            }

            if (needsEmailVerification) {
                setMessage({ text: "¡Perfil actualizado! Te hemos enviado un correo de verificación a tu nueva dirección de correo para confirmar el cambio. (Puede estar en Spam)", type: "success" });
            } else {
                setMessage({ text: "¡Perfil actualizado correctamente!", type: "success" });
                setPassword(""); // Limpiar contraseña por seguridad
            }

        } catch (error: any) {
            setMessage({ text: error.message || "Asegúrate que el usuario no esté en uso por otro profesor.", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <span className="text-xl font-bold text-indigo-500 animate-pulse">Cargando Ajustes...</span>
        </div>
    );

    return (
        <div className="h-screen overflow-hidden bg-gray-50 flex flex-col font-sans">
            {/* Header Mágico */}
            <header className="bg-white px-6 sm:px-10 py-5 flex items-center justify-between border-b border-gray-100 shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link
                        href="/teacher/dashboard"
                        className="group flex items-center gap-2 px-3 sm:px-4 py-2 bg-white hover:bg-gray-50 rounded-xl text-gray-500 hover:text-indigo-600 transition-all border border-gray-200 shadow-sm"
                        title="Volver al Panel"
                    >
                        <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="font-bold text-sm hidden sm:block">Volver</span>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900 border-l-4 border-indigo-500 pl-4 py-1">
                            Ajustes de Perfil
                        </h1>
                    </div>
                </div>
            </header>

            {/* Dashboard Content */}
            <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-4 flex flex-col justify-center min-h-0">

                <div className="bg-white rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden flex flex-col max-h-full">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-6 relative overflow-hidden shrink-0">
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white rounded-full opacity-10"></div>
                        <div className="absolute top-2 right-6 text-5xl opacity-20 filter drop-shadow-md">🛡️</div>
                        <h2 className="text-2xl font-black text-white drop-shadow-sm mb-1 relative z-10">Tu Identidad</h2>
                        <p className="text-indigo-100 text-sm font-medium relative z-10">Gestiona cómo te ven los demás en la plataforma.</p>
                    </div>

                    <div className="px-6 py-4 flex-1 overflow-auto custom-scrollbar">
                        {message && (
                            <div className={`p-3 rounded-xl mb-4 text-sm font-bold border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {message.type === 'success' ? "✅ " : "⚠️ "} {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            {/* Identidad de Usuario */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><span className="text-sm text-gray-600">📝</span> Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold text-gray-800"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><span className="text-sm text-gray-600">👤</span> Nombre de Usuario</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Ej. profesor_mario"
                                        className="w-full px-3 py-2.5 text-indigo-700 text-sm lowercase rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                        required
                                    />
                                    <p className="text-[10px] text-gray-400 font-medium leading-tight">Puedes usar esto para iniciar sesión en vez de tu correo.</p>
                                </div>
                            </div>

                            {/* Seguridad */}
                            <div className="space-y-4 pt-1">
                                <p className="text-xs font-bold text-indigo-900 border-l-2 border-indigo-400 pl-2 bg-indigo-50 py-1.5 uppercase tracking-wider">
                                    Seguridad de la Cuenta
                                </p>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><span className="text-sm text-gray-600">✉️</span> Correo Electrónico</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold text-gray-800"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><span className="text-sm text-gray-600">🔑</span> Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Déjalo en blanco si no deseas cambiarla"
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold text-gray-800 placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving || !username || !fullName || !email}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg shadow-[0_5px_15px_rgba(79,70,229,0.3)] hover:shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
                                >
                                    {saving ? "Procesando..." : "✅ Guardar Cambios"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>

            {/* Scrollbar CSS */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(99, 102, 241, 0.2);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
